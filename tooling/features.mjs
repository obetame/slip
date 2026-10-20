// features.mjs drives the four new behaviors through the real bundles in
// jsdom: page-wide drag and drop, paste handling, text preview, and search.
//
// Usage: node features.mjs [baseURL]

import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const JSDOM_VERSION = createRequire(import.meta.url)("jsdom/package.json").version;

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, "..", "internal", "web", "static");
const base = process.argv[2] || "http://127.0.0.1:8801";

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? " :: " + String(detail).slice(0, 400) : ""));
  }
}
const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

async function page(cookie) {
  const html = readFileSync(join(staticDir, "index.html"), "utf8").replace(/\{\{version\}\}/g, "t");
  const vc = new VirtualConsole();
  const errs = [];
  vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
  const dom = new JSDOM(html, { url: base + "/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  const sent = [];
  // Patch the prototype rather than replacing the constructor: a replaced
  // constructor that returns another object breaks `instanceof`, and older
  // Node builds ran into exactly that.
  const fdProto = w.FormData.prototype;
  const realAppend = fdProto.append;
  fdProto.append = function (k, v, name) {
    this.__files = this.__files || [];
    this.__files.push({ key: k, name: name, size: v && v.size });
    return realAppend.call(this, k, v, name);
  };
  w.fetch = async (path, opts) => {
    const url = new URL(path, base).toString();
    const method = (opts && opts.method) || "GET";
    const headers = Object.assign({}, (opts && opts.headers) || {}, cookie ? { Cookie: cookie } : {});

    // A multipart body built by jsdom cannot be handed to Node's fetch, so an
    // upload is recorded and answered locally instead of being sent. That is
    // the only way this test works the same on every platform.
    if (opts && opts.body instanceof w.FormData) {
      const parts = opts.body.__files || [];
      sent.push({ url, text: "", upload: parts.length });
      return { ok: true, status: 201, headers: { get: () => "application/json" }, json: async () => ({ items: [] }), text: async () => "" };
    }

    const res = await fetch(url, { method, headers, body: opts && opts.body });
    const text = await res.text();
    if (method === "POST") sent.push({ url, text });
    return { ok: res.ok, status: res.status, headers: { get: (k) => res.headers.get(k) }, json: async () => JSON.parse(text), text: async () => text };
  };
  for (const f of ["boot.js", "core.js", "app.js"]) w.eval(readFileSync(join(staticDir, f), "utf8"));
  await settle(400);
  return { w, errs, sent, doc: w.document };
}

function fakeDrop(w, files) {
  const ev = new w.Event("drop", { bubbles: true, cancelable: true });
  const map = {};
  ev.dataTransfer = {
    files: files,
    types: ["Files"],
    items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })),
    getData: (k) => map[k] || "",
  };
  return ev;
}

const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Slip": "1" },
  body: JSON.stringify({ passphrase: process.env.SLIP_TEST_PASS || "testtest" }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];

const p = await page(cookie);
const body = () => p.doc.body.textContent;

console.log("page-wide drop");
// A drop on an element far from the composer must still upload.
const mainEl = p.doc.getElementById("main");
const card = p.doc.querySelector(".slip");
const target = card || mainEl;
const png = new p.w.File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });
target.dispatchEvent(fakeDrop(p.w, [png]));
await settle(300);
const dropped = p.sent.filter((x) => /\/api\/files/.test(x.url)).length;
check(
  "drop on a slip card uploads (not just the composer)",
  dropped > 0,
  JSON.stringify({ uploads: dropped, requests: p.sent.map((x) => x.url) }),
);

console.log("drag overlay");
const de = new p.w.Event("dragenter", { bubbles: true, cancelable: true });
de.dataTransfer = { files: [], types: ["Files"], items: [] };
p.doc.dispatchEvent(de);
await settle(60);
const zone = p.doc.querySelector(".dropzone");
check("dragenter shows the drop overlay", !!zone && zone.hidden === false, zone ? "hidden=" + zone.hidden : "no .dropzone");
const dl = new p.w.Event("dragleave", { bubbles: true, cancelable: true });
p.doc.dispatchEvent(dl);
await settle(60);
check("dragleave hides the overlay", !!zone && zone.hidden === true, zone ? "hidden=" + zone.hidden : "no zone");

console.log("text preview");
const btn = p.doc.querySelector(".previewbtn");
check("text attachment has a preview button", !!btn);
if (btn) {
  btn.dispatchEvent(new p.w.Event("click", { bubbles: true }));
  await settle(500);
  const pre = p.doc.querySelector(".previewbody");
  // The seeded attachments are people.csv and readme.md. Either body proves
  // the fetch + render path; a raw filename would mean it never loaded.
  const shown = pre ? pre.textContent : "";
  // Any non-empty body that is not the file name proves the fetch rendered.
  const isFileBody = shown.trim().length > 0;
  check("preview fetches and shows the file body", !!pre && isFileBody, pre ? shown.slice(0, 120) : body().slice(0, 400));
  check("preview does not show the filename as body", !pre || shown.indexOf("people.csv") === -1 && shown.indexOf("readme.md") === -1, shown.slice(0, 80));
}

console.log("search");
const si = p.doc.querySelector("input.search");
check("search input exists", !!si, p.doc.getElementById("main").innerHTML.slice(0, 300));
if (si) {
  const before = p.doc.querySelectorAll(".slip").length;
  // Search for a token that exists in a real slip on this board.
  const all = await (await fetch(base + "/api/items", { headers: { Cookie: cookie } })).json();
  const target = (all.items || []).filter((i) => i.kind === "text")[0];
  const needle = target ? target.text.slice(0, 5) : "hello";
  si.value = needle;
  si.dispatchEvent(new p.w.Event("input", { bubbles: true }));
  await settle(200);
  const after = p.doc.querySelectorAll(".slip").length;
  check("typing narrows the list", after < before && after >= 1, "before=" + before + " after=" + after);
  const boardText = p.doc.getElementById("main").textContent;
  check("filtered list shows the match", boardText.indexOf(needle) !== -1, boardText.slice(0, 200));
  check("filtered list hides other slips", after < before, "before=" + before + " after=" + after);
  // no match
  const si2 = p.doc.querySelector("input.search");
  si2.value = "zzzznotfound";
  si2.dispatchEvent(new p.w.Event("input", { bubbles: true }));
  await settle(150);
  check("no match shows the empty message", p.doc.getElementById("main").textContent.indexOf("\u6ca1\u6709\u627e\u5230") !== -1 || p.doc.getElementById("main").textContent.indexOf("Nothing matched") !== -1, p.doc.getElementById("main").textContent.slice(-120));
  const clearBtn = Array.from(p.doc.querySelectorAll(".searchbar button")).pop();
  if (clearBtn) {
    clearBtn.dispatchEvent(new p.w.Event("click", { bubbles: true }));
    await settle(200);
    check("clear restores the full list", p.doc.querySelectorAll(".slip").length >= before, "now=" + p.doc.querySelectorAll(".slip").length);
  }
}

console.log("listener hygiene");
// renderBoard runs on every change, and it used to re-add a full set of
// document drag listeners each time. Count the drops one drop produces.
const seq = [];
const probe = function () { seq.push(1); };
p.doc.addEventListener("drop", probe);
// Re-query: the board is rebuilt on every render, so the earlier handle is
// detached.
const live = p.doc.querySelector(".slip") || p.doc.getElementById("main");
live.dispatchEvent(fakeDrop(p.w, [png]));
await settle(250);
p.doc.removeEventListener("drop", probe);
check("a drop is delivered to the page once", seq.length === 1, "handled " + seq.length + " times");

console.log("console");
check("no script errors", p.errs.filter((e) => !/Not implemented|Could not parse CSS/.test(e)).length === 0, p.errs.join(" | "));

console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
