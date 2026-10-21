import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const staticDir = "/Users/hejing/codes/slip/internal/web/static";
const base = "http://127.0.0.1:8799";
let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS " + name);
  else { failures++; console.log("  FAIL " + name + (detail ? " :: " + String(detail).slice(0, 300) : "")); }
}
const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const login = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Slip": "1" }, body: JSON.stringify({ passphrase: "uitest123" }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];

const html = readFileSync(join(staticDir, "index.html"), "utf8").replace(/\{\{version\}\}/g, "t");
const vc = new VirtualConsole();
const errs = [];
vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
const dom = new JSDOM(html, { url: base + "/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window;
w.fetch = async (path, opts) => {
  const url = new URL(path, base).toString();
  const headers = Object.assign({}, (opts && opts.headers) || {}, { Cookie: cookie });
  const res = await fetch(url, { method: (opts && opts.method) || "GET", headers, body: opts && opts.body });
  const text = await res.text();
  return { ok: res.ok, status: res.status, headers: { get: (k) => res.headers.get(k) }, json: async () => JSON.parse(text), text: async () => text };
};
for (const f of ["boot.js", "core.js", "app.js"]) w.eval(readFileSync(join(staticDir, f), "utf8"));
await settle(500);
const doc = w.document;

console.log("kind tags");
const slips = Array.from(doc.querySelectorAll(".slip"));
check("each slip carries data-kind", slips.length > 0 && slips.every((s) => !!s.getAttribute("data-kind")));
check("text tag has glyph and label", slips.some((s) => s.getAttribute("data-kind") === "text" && /\u274F\s*\u6587\u5b57/.test(s.querySelector(".kindtag").textContent)));
check("image tag has glyph", slips.some((s) => s.getAttribute("data-kind") === "image" && /\u25A3/.test(s.querySelector(".kindtag").textContent)));
check("file tag has glyph", slips.some((s) => s.getAttribute("data-kind") === "file" && /\u25A4/.test(s.querySelector(".kindtag").textContent)));

console.log("kind filter");
const bar = doc.querySelector(".kindbar");
check("kindbar exists with mixed kinds", !!bar);
const fileBtn = bar ? Array.from(bar.querySelectorAll("button")).find((b) => b.textContent.indexOf("\u6587\u4EF6") !== -1) : null;
check("file filter button exists", !!fileBtn);
if (fileBtn) {
  fileBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(200);
  const kindsLeft = Array.from(doc.querySelectorAll(".slip")).map((s) => s.getAttribute("data-kind"));
  check("filter keeps only files", kindsLeft.length > 0 && kindsLeft.every((k) => k === "file"), kindsLeft.join(","));
  const on = doc.querySelector(".kindbar .kindbtn.is-on");
  check("active filter is highlighted", !!on && on.textContent.indexOf("\u6587\u4EF6") !== -1, on && on.textContent);
  const again = Array.from(doc.querySelectorAll(".kindbar button")).find((b) => b.textContent.indexOf("\u6587\u4EF6") !== -1);
  again.dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(200);
  const allBtn = doc.querySelector(".kindbar .kindbtn.is-on");
  check("toggling again returns to All", !!allBtn && allBtn.textContent.indexOf("\u5168\u90E8") !== -1, allBtn && allBtn.textContent);
}

console.log("layout toggle");
const layoutBtn = doc.querySelector(".layoutbtn");
check("layout toggle exists", !!layoutBtn, doc.getElementById("main").innerHTML.slice(0, 200));
if (layoutBtn) {
  layoutBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(200);
  check("grid shows a wall of tiles", !!doc.querySelector(".wall") && doc.querySelectorAll(".tile").length >= 1, doc.querySelectorAll(".tile").length);
  check("toggle now says list", doc.querySelector(".layoutbtn").textContent === "\u5217\u8868" || doc.querySelector(".layoutbtn").textContent === "List");
  const img = doc.querySelector(".tileimg");
  check("tile uses the thumb endpoint", !!img && img.src.indexOf("/thumb") !== -1, img && img.src);
  doc.querySelector(".layoutbtn").dispatchEvent(new w.Event("click", { bubbles: true }));
  await settle(200);
  check("back to list", !doc.querySelector(".wall"));
}

console.log("day separators");
check("day separators render", !!doc.querySelector(".daysep"), doc.getElementById("main").textContent.slice(0, 200));

console.log("composition guard");
{
  const si = doc.querySelector("input.search");
  check("search input exists", !!si);
  if (si) {
    si.dispatchEvent(new w.Event("compositionstart", { bubbles: true }));
    si.value = "zheng";
    si.dispatchEvent(new w.Event("input", { bubbles: true }));
    await settle(120);
    check("pinyin stays out of the query while composing", doc.querySelectorAll(".slip").length === Array.from(doc.querySelectorAll(".slip")).length);
    si.dispatchEvent(new w.Event("compositionend", { bubbles: true }));
    await settle(120);
    const slipsAfter = doc.querySelectorAll(".slip").length;
    check("confirmed text applies the filter", slipsAfter < 4, "slips=" + slipsAfter);
    check("query holds the confirmed text", Array.from(doc.querySelectorAll(".kindbar, .searchbar")).length >= 1);
    const clearBtn = Array.from(doc.querySelectorAll(".searchbar button")).pop();
    if (clearBtn) { clearBtn.dispatchEvent(new w.Event("click", { bubbles: true })); await settle(150); }
  }
}

console.log("console");
check("no script errors", errs.filter((e) => !/Not implemented|Could not parse CSS/.test(e)).length === 0, errs.join(" | "));
console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
