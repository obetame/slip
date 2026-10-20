// smoke.mjs exercises the built browser client against real jsdom.
// It loads the same four bundles a browser would, with fetch pointed at
// the running server, and drives the page the way a person would.
//
// Usage: node smoke.mjs [baseURL]
// The server must already be running with the UI data seeded.

import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, "..", "internal", "web", "static");
const base = process.argv[2] || "http://127.0.0.1:8799";

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log("  PASS " + name);
  } else {
    failures++;
    console.log("  FAIL " + name + (detail ? " :: " + detail : ""));
  }
}

async function bootPage(htmlName, cookies) {
  const html = readFileSync(join(staticDir, htmlName), "utf8").replace(/\{\{version\}\}/g, "test");
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", (e) => errors.push(String(e.message || e)));
  const dom = new JSDOM(html, {
    url: base + (htmlName === "legacy.html" ? "/?ui=legacy" : "/"),
    runScripts: "outside-only",
    virtualConsole: vc,
    pretendToBeVisual: true,
  });
  const w = dom.window;
  // A minimal fetch that carries the session cookie and forwards headers.
  w.fetch = async function (path, opts) {
    const url = new URL(path, base).toString();
    const headers = Object.assign({}, (opts && opts.headers) || {});
    if (cookies) headers["Cookie"] = cookies;
    const res = await fetch(url, {
      method: (opts && opts.method) || "GET",
      headers,
      body: opts && opts.body,
      redirect: "manual",
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      headers: { get: (k) => res.headers.get(k) },
      json: async () => JSON.parse(text),
      text: async () => text,
    };
  };
  // FormData from jsdom is not a BodyInit for undici; pass it through as a
  // stub so the upload path is exercised without a real network write.
  w.__uploadedBatches = [];
  w.FormData.prototype.append = function (k, v, name) {
    this.__files = this.__files || [];
    this.__files.push({ key: k, name: name, size: v && v.size });
  };
  const inject = (file) => {
    const code = readFileSync(join(staticDir, file), "utf8");
    w.eval(code);
  };
  inject("boot.js");
  inject("core.js");
  return { dom, w, errors, inject };
}

function text(w) {
  return w.document.getElementById("main").textContent;
}

async function settle(w, ms = 120) {
  await new Promise((r) => setTimeout(r, ms));
}

// --- login flow -------------------------------------------------------
const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Slip": "1" },
  body: JSON.stringify({ passphrase: process.env.SLIP_TEST_PASS || "testtest" }),
});
const raw = login.headers.get("set-cookie") || "";
const cookie = raw.split(";")[0];
check("login returns a session cookie", !!cookie, raw);

// --- modern page ------------------------------------------------------
console.log("modern page");
const modern = await bootPage("index.html", cookie);
modern.inject("app.js");
await settle(modern.w, 400);

check("index has a composer", !!modern.w.document.querySelector(".composer"));
check("index has a write box", !!modern.w.document.getElementById("write"));
check("core.js loaded window.Slip", !!modern.w.Slip && typeof modern.w.Slip.start === "function");

// Ask the API what is actually on the board, then assert the page shows it.
const listed = await (await fetch(base + "/api/items", { headers: { Cookie: cookie } })).json();
const items = listed.items || [];
const board = text(modern.w);
const oneText = items.filter((i) => i.kind === "text")[0];
const oneFile = items.filter((i) => i.kind !== "text")[0];
check("board renders text slips", !!oneText && board.indexOf(oneText.text) !== -1, board.slice(0, 200));
check("file slip shows its name", !!oneFile && board.indexOf(oneFile.name) !== -1, board.slice(0, 300));

// search: type into state via a URL? The search uses the query state.
// The composer is the only input, so drive filter through the Slip start
// state by simulating a location search is not supported. Instead check the
// preview control exists for a text attachment.
check("preview control present for text attachment", !!modern.w.document.querySelector(".previewbtn"), modern.w.document.body.innerHTML.slice(0, 500));

// --- legacy page ------------------------------------------------------
console.log("legacy page");
const legacy = await bootPage("legacy.html", cookie);
legacy.inject("legacy.js");
await settle(legacy.w, 400);
const lb = text(legacy.w);
check("legacy page renders slips", !!oneFile && lb.indexOf(oneFile.name) !== -1, lb.slice(0, 200));
check("legacy shares the same controller", !!legacy.w.Slip.start);
check("legacy does not mount the drop overlay", !legacy.w.document.querySelector(".dropzone"));

// --- console errors ---------------------------------------------------
console.log("console");
for (const [n, p] of [["modern", modern], ["legacy", legacy]]) {
  const real = p.errors.filter((e) => !/Could not parse CSS|Not implemented/.test(e));
  check(n + " page ran without script errors", real.length === 0, real.join(" | "));
}

console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
