// verify-fold.mjs checks the new slip header and text fold behaviors
// against the running test server.
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, "..", "internal", "web", "static");
const base = "http://127.0.0.1:8799";

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS " + name);
  else { failures++; console.log("  FAIL " + name + (detail ? " :: " + String(detail).slice(0, 300) : "")); }
}
const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Slip": "1" },
  body: JSON.stringify({ passphrase: "uitest123" }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
check("login ok", !!cookie);

const html = readFileSync(join(staticDir, "index.html"), "utf8").replace(/\{\{version\}\}/g, "t");
const vc = new VirtualConsole();
const errs = [];
vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
const dom = new JSDOM(html, { url: base + "/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window;
w.fetch = async (path, opts) => {
  const url = new URL(path, base).toString();
  const headers = Object.assign({}, (opts && opts.headers) || {}, cookie ? { Cookie: cookie } : {});
  const res = await fetch(url, { method: (opts && opts.method) || "GET", headers, body: opts && opts.body });
  const text = await res.text();
  return { ok: res.ok, status: res.status, headers: { get: (k) => res.headers.get(k) }, json: async () => JSON.parse(text), text: async () => text };
};
for (const f of ["boot.js", "core.js", "app.js"]) w.eval(readFileSync(join(staticDir, f), "utf8"));
await settle(500);
const doc = w.document;

console.log("slip header");
const heads = doc.querySelectorAll(".sliphead");
check("every slip has a header", heads.length === doc.querySelectorAll(".slip").length, heads.length + "/" + doc.querySelectorAll(".slip").length);
check("header holds the meta line", !!heads[0] && !!heads[0].querySelector(".meta"));
const textSlip = Array.from(doc.querySelectorAll(".slip")).find((s) => s.querySelector("pre.body"));
const headBtns = textSlip ? textSlip.querySelectorAll(".sliphead button") : [];
check("header holds action buttons", headBtns.length >= 3, headBtns.length);

console.log("delete button style");
const rm = Array.from(doc.querySelectorAll(".slip button")).find((b) => b.textContent === "\u5220\u9664" || b.textContent === "Delete");
check("delete button is a textbtn", !!rm && rm.className.indexOf("textbtn") !== -1, rm && rm.className);
const armed = Array.from(doc.querySelectorAll(".slip button")).find((b) => b.textContent === "\u786e\u8ba4\u5220\u9664\uff1f");
// arm it once to check the danger class still lands on a textbtn
if (rm) {
  rm.dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(80);
  check("armed delete keeps textbtn and gains danger", rm.className.indexOf("textbtn") !== -1 && rm.className.indexOf("danger") !== -1, rm.className);
}

console.log("kind tag and preview label");
const tag = heads[0] ? heads[0].querySelector(".kindtag") : null;
check("header shows the slip kind", !!tag, heads[0] && heads[0].innerHTML.slice(0, 120));
check("kind tag is not in the grey meta", !!tag && tag.className !== "meta");
const fileSlip = Array.from(doc.querySelectorAll(".slip")).find((s) => s.querySelector(".fname"));
if (fileSlip) {
  const pv = Array.from(fileSlip.querySelectorAll("button")).find((b) => b.textContent === "\u9884\u89c8" || b.textContent === "Preview");
  check("a file slip reads Preview, not Open", !!pv, fileSlip.textContent.slice(0, 80));
}

console.log("text fold");
const folded = doc.querySelector("pre.body.folded");
const openBtn = Array.from(doc.querySelectorAll(".slip .row button")).find(
  (b) => b.textContent === "\u5c55\u5f00" || b.textContent === "Open",
);
check("the long slip starts folded", !!folded);
check("the long slip has an open toggle", !!openBtn);
check("the long text toggle reads Open, not Preview", !!openBtn && (openBtn.textContent === "\u5c55\u5f00" || openBtn.textContent === "Open"), openBtn && openBtn.textContent);
check("the short slip is not folded", !Array.from(doc.querySelectorAll("pre.body")).some((b) => b.textContent === "short note" && b.className.indexOf("folded") !== -1));
if (openBtn) {
  openBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(200);
  const bodyNow = doc.querySelector("pre.body");
  check("toggle unfolds the long slip", !!bodyNow && bodyNow.className.indexOf("folded") === -1, bodyNow && bodyNow.className);
  check("toggle now reads close", !!doc.querySelector(".sliphead") && Array.from(doc.querySelectorAll(".sliphead button")).some((b) => b.textContent === "\u6536\u8d77" || b.textContent === "Close"));
  const closeBtn = Array.from(doc.querySelectorAll(".sliphead button")).find((b) => b.textContent === "\u6536\u8d77" || b.textContent === "Close");
  if (closeBtn) {
    closeBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
    await settle(200);
    check("toggle folds the slip again", !!doc.querySelector("pre.body.folded"));
  }
}

console.log("console");
check("no script errors", errs.filter((e) => !/Not implemented|Could not parse CSS/.test(e)).length === 0, errs.join(" | "));

console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
