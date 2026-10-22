// features.mjs drives the four new behaviors through the real bundles in
// jsdom: page-wide drag and drop, paste handling, text preview, and search.
//
// Usage: node features.mjs [baseURL]

import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";

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

// A minimal but valid 8x8 red PNG, built once.
const PNG_8X8 = (() => {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const w = 8, h = 8;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = 200; raw[o + 1] = 30; raw[o + 2] = 30;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
})();


async function page(cookie, opts = {}) {
  const html = readFileSync(join(staticDir, "index.html"), "utf8").replace(/\{\{version\}\}/g, "t");
  const vc = new VirtualConsole();
  const errs = [];
  vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
  const dom = new JSDOM(html, { url: base + "/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  // The saved layout is read during the first render, so it has to be in
  // place before the bundles run.
  if (opts.layout) w.localStorage.setItem("slip.layout", opts.layout);
  // jsdom has no media queries. A narrow window is the one the tests
  // need to imitate, because it is what folds the header actions away.
  if (opts.narrow) {
    w.matchMedia = (q) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    });
  }
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
// The toggle lives in the file slip's action row. Pick the one whose label
// matches Preview in either language.
const btn = Array.from(p.doc.querySelectorAll(".slip .row button")).find(
  (b) => b.textContent === "Preview" || b.textContent === "\u9884\u89c8",
);
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

console.log("edit");
{
  // Edit the first text slip and confirm the board keeps it in place.
  const editBtn = Array.from(p.doc.querySelectorAll(".slip button")).find((b) => b.textContent === "Edit" || b.textContent === "\u7f16\u8f91");
  check("text slips offer Edit", !!editBtn, Array.from(p.doc.querySelectorAll(".slip button")).map((b) => b.textContent).slice(0, 12).join(","));
  if (editBtn) {
    const before = p.doc.querySelectorAll(".slip").length;
    editBtn.dispatchEvent(new p.w.Event("click", { bubbles: true }));
    await settle(150);
    const box = p.doc.querySelector("textarea.editor-input");
    check("editor opens in place", !!box, p.doc.getElementById("main").innerHTML.slice(0, 300));
    if (box) {
      box.value = "edited body text";
      const saveBtn = Array.from(p.doc.querySelectorAll(".editor button")).find((b) => b.textContent === "Save" || b.textContent === "\u4fdd\u5b58");
      saveBtn.dispatchEvent(new p.w.Event("click", { bubbles: true }));
      await settle(400);
      const after = p.doc.querySelectorAll(".slip").length;
      check("edit saved without adding or removing slips", after === before, "before=" + before + " after=" + after);
      check("edited body is shown", p.doc.getElementById("main").textContent.indexOf("edited body text") !== -1, p.doc.getElementById("main").textContent.slice(0, 200));
      check("an edited slip is marked", p.doc.getElementById("main").textContent.indexOf("edited") !== -1 || p.doc.getElementById("main").textContent.indexOf("\u5df2\u7f16\u8f91") !== -1, "no edited marker");
    }
  }
}

console.log("visible errors");
{
  // A delete that fails must say so where the person is looking, not only in
  // an aria-live region nobody sees.
  const bar = p.doc.getElementById("undo");
  bar.hidden = true;
  const rm = Array.from(p.doc.querySelectorAll(".slip .row button")).find(
    (b) => b.textContent === "Delete" || b.textContent === "\u5220\u9664",
  );
  if (rm) {
    // Force the request to fail by pointing the page at a bad path.
    const realFetch = p.w.fetch;
    p.w.fetch = async (path, opts) => {
      if (opts && opts.method === "DELETE") {
        return { ok: false, status: 500, headers: { get: () => "application/json" }, json: async () => ({ error: "bad_request" }), text: async () => "" };
      }
      return realFetch(path, opts);
    };
    rm.dispatchEvent(new p.w.Event("click", { bubbles: true })); // arm
    await settle(80);
    rm.dispatchEvent(new p.w.Event("click", { bubbles: true })); // act
    await settle(300);
    p.w.fetch = realFetch;
    const shown = bar.hidden === false && bar.textContent.trim().length > 0;
    check("a failed delete is visible at the bottom", shown, "bar hidden=" + bar.hidden + " text=" + JSON.stringify(bar.textContent));
  }
  // Restore state for the later tests.
  const fresh = Array.from(p.doc.querySelectorAll(".slip .row button")).find(
    (b) => b.textContent === "Refresh" || b.textContent === "\u5237\u65b0",
  );
}

console.log("delete confirm");
{
  const items = await (await fetch(base + "/api/items", { headers: { Cookie: cookie } })).json();
  const before = (items.items || []).length;
  check("board has slips to delete", before > 0, "count " + before);

  const rm = Array.from(p.doc.querySelectorAll(".slip .row button")).find(
    (b) => b.textContent === "Delete" || b.textContent === "\u5220\u9664",
  );
  check("a Delete button is present", !!rm);
  if (rm) {
    // First click arms, does not delete.
    rm.dispatchEvent(new p.w.Event("click", { bubbles: true }));
    await settle(100);
    check("first click arms the button, nothing is gone yet",
      rm.isConnected && rm.textContent !== "Delete" && rm.textContent !== "\u5220\u9664",
      "label after first click: " + rm.textContent);
    const afterArm = await (await fetch(base + "/api/items", { headers: { Cookie: cookie } })).json();
    check("no delete request fired while armed", (afterArm.items || []).length === before);

    // Second click deletes.
    rm.dispatchEvent(new p.w.Event("click", { bubbles: true }));
    await settle(300);
    const afterDel = await (await fetch(base + "/api/items", { headers: { Cookie: cookie } })).json();
    check("second click deletes", (afterDel.items || []).length === before - 1,
      "before=" + before + " after=" + (afterDel.items || []).length);
    check("the undo bar appears", !!p.doc.getElementById("undo") && !p.doc.getElementById("undo").hidden);
    check("the undo bar says it is undoable",
      p.doc.getElementById("undo").textContent.indexOf("undo") !== -1 || p.doc.getElementById("undo").textContent.indexOf("\u64a4\u9500") !== -1,
      p.doc.getElementById("undo").textContent);
  }
}

console.log("image viewer");
{
  // The page's fetch stub answers uploads locally, so send this one over the
  // real network instead. That way the server makes a thumbnail and the board
  // has an image to open.
  const realFd = new FormData();
  realFd.append("file", new Blob([PNG_8X8], { type: "image/png" }), "view-me.png");
  const up = await fetch(base + "/api/files", {
    method: "POST",
    headers: { "X-Slip": "1", Cookie: cookie },
    body: realFd,
  });
  check("image uploaded over the real network", up.ok, "status " + up.status);
  const refreshBtn = Array.from(p.doc.querySelectorAll(".nav button")).find((b) => b.textContent === "Refresh" || b.textContent === "\u5237\u65b0");
  if (refreshBtn) refreshBtn.dispatchEvent(new p.w.Event("click", { bubbles: true }));
  await settle(500);

  const shot = p.doc.querySelector(".shot");
  check("image slip renders a thumbnail", !!shot);
  if (shot) {
    shot.dispatchEvent(new p.w.Event("click", { bubbles: true }));
    await settle(200);
    const layer = p.doc.getElementById("viewer");
    check("clicking the thumbnail opens the viewer", !!layer);
    check("viewer shows the full image", !!layer && !!layer.querySelector(".viewer-img"));
    const full = layer.querySelector(".viewer-img");
    check("viewer loads the raw file", !!full && full.src.indexOf("/raw") !== -1, full && full.src);
    // Escape closes it.
    p.doc.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(150);
    check("Escape closes the viewer", !p.doc.getElementById("viewer"));
  }
}

console.log("grid layout");
{
  // Grid is the opt-in wall. Every slip has to become a tile, not just
  // the pictures: a wall that leaves notes in the old list was the bug
  // this section exists to catch.
  const g = await page(cookie, { layout: "grid" });
  const cols = g.doc.querySelectorAll(".wallcol");
  check("grid builds two columns", cols.length === 2, "columns=" + cols.length);
  const tiles = Array.from(g.doc.querySelectorAll(".wall .tile"));
  const empty = tiles.filter((t) => !t.querySelector(".slip") && !t.querySelector(".tileimg"));
  check("every slip becomes a tile", tiles.length > 0 && empty.length === 0, "tiles=" + tiles.length + " empty=" + empty.length);
  check("text slips join the wall", !!g.doc.querySelector(".wall .tile .body"));
  check("grid drops the day separators", !g.doc.querySelector(".daysep"));
  const tileRows = Array.from(g.doc.querySelectorAll(".wall .tile .sliphead .row"));
  check(
    "a tile header keeps only More",
    tileRows.length > 0 && tileRows.every((r) => r.children.length === 1 && !!r.querySelector("details.actmore")),
    tileRows.map((r) => Array.from(r.children).map((c) => c.tagName).join("+")).join(" | "),
  );

  // The layout switch lives at the end of the kind filter row, not in
  // the page nav: that row is about how the board is shown.
  const bar = g.doc.querySelector(".kindbar");
  check("the board has one control row", !!bar);
  const toList = bar && Array.from(bar.querySelectorAll("button")).find((b) => /\u5217\u8868|List/.test(b.textContent));
  check("the layout switch sits in the control row", !!toList, bar ? bar.textContent : "no .kindbar");
  check("the nav keeps only page-level switches", !/[\u7f51\u683c\u5217\u8868]|Grid|List/.test((g.doc.querySelector(".nav") || {}).textContent || ""), (g.doc.querySelector(".nav") || {}).textContent);
  if (toList) {
    toList.dispatchEvent(new g.w.Event("click", { bubbles: true }));
    await settle(400);
    check("the toggle returns to the list", !g.doc.querySelector(".wall") && !!g.doc.querySelector(".slip"));
    const toGrid = Array.from(g.doc.querySelectorAll(".kindbar button")).find((b) => /\u7f51\u683c|Grid/.test(b.textContent));
    check("the label flips with the layout", !!toGrid, (g.doc.querySelector(".kindbar") || {}).textContent);
  }
}

console.log("narrow header");
{
  // A phone has room for one action and More. Everything else moves
  // into the menu, which must still contain the delete button.
  const n = await page(cookie, { narrow: true });
  const heads = Array.from(n.doc.querySelectorAll(".sliphead"));
  const folded = heads.find((h) => h.querySelector("details.actmore"));
  check("a narrow header folds extra actions into More", !!folded, heads.map((h) => h.textContent).join(" | "));
  if (folded) {
    const row = folded.querySelector(".row");
    check("the row keeps one action beside More", row.children.length === 2, "children=" + row.children.length);
    const menu = folded.querySelector(".actmore .menu");
    check("the menu holds the rest of the actions", menu && menu.children.length >= 1, menu ? "items=" + menu.children.length : "no menu");
    check("delete is still reachable from the menu", !!menu && /\u5220\u9664|Delete/.test(menu.textContent), menu && menu.textContent);
  }
  const plain = heads.find((h) => !h.querySelector("details.actmore"));
  check("a short header stays unfolded", !plain || plain.querySelectorAll(".row > *").length <= 2);
}

console.log("keyboard");
{
  // "/" focuses the search field.
  const target = p.doc.querySelector(".slip") || p.doc.getElementById("main");
  target.dispatchEvent(new p.w.MouseEvent("mousedown", { bubbles: true }));
  p.doc.body.focus();
  p.doc.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "/", bubbles: true }));
  await settle(150);
  const active = p.doc.activeElement;
  check('"/" focuses the search field', !!active && active.className === "search", active ? active.tagName + "." + active.className : "none");
}

console.log("markdown render");
{
  // Drive the renderer directly: it is the piece with the safety rules.
  const R = p.w.Slip.renderMarkdown;
  check("renderer is exposed", typeof R === "function");

  function html(src) {
    const d = p.w.document.createElement("div");
    d.appendChild(R(src));
    return { doc: d, text: d.textContent, tag: (t) => d.querySelector(t) };
  }

  const h = html("# Title\n\nhello **bold** and *italic*.");
  check("heading renders", h.tag("h1") && h.tag("h1").textContent === "Title", h.text.slice(0, 80));
  check("bold renders", !!h.tag("strong"));
  check("italic renders", !!h.tag("em"));

  const list = html("- one\n- two");
  check("list renders two items", list.doc.querySelectorAll("li").length === 2);

  const code = html("```\nvar a = 1;\n```");
  check("fenced code renders", !!code.tag("pre") && code.text.indexOf("var a = 1") !== -1);

  const quote = html("> quoted");
  check("block quote renders", !!quote.tag("blockquote"));

  // A raw script tag must never become markup.
  const evil = html('<script>alert(1)</script>');
  check("script tag stays text", !evil.tag("script"), "a script element was created");
  check("script text is visible as text", evil.text.indexOf("<script>") !== -1, evil.text);

  // javascript: links must not become anchors.
  const js = html("[click](javascript:alert(1))");
  check("javascript: link is not an anchor", !js.tag("a"), "an anchor was created for javascript:");
  check("javascript: text survives literally", js.text.indexOf("javascript:") !== -1, js.text);

  const good = html("[site](https://example.com)");
  check("https link becomes an anchor", !!good.tag("a") && good.tag("a").href.indexOf("https://example.com") === 0);

  const img = html('<img src=x onerror=alert(1)>');
  check("img tag is not created", !img.tag("img"));
}

console.log("settings");
{
  // Settings names the running version and offers a check. The check
  // itself is not pressed here: it asks GitHub, and a test that needs the
  // internet is a test that fails on a plane.
  const st = await page(cookie);
  const toSettings = Array.from(st.doc.querySelectorAll(".nav button")).find((b) => /\u8bbe\u7f6e|Settings/.test(b.textContent));
  check("settings is reachable from the nav", !!toSettings, st.doc.querySelector(".nav").textContent);
  if (toSettings) {
    toSettings.dispatchEvent(new st.w.Event("click", { bubbles: true }));
    await settle(300);
    const versions = Array.from(st.doc.querySelectorAll(".sheet .url")).map((n) => n.textContent.trim());
    check("settings shows the running version", versions.some((v) => /^\d+\.\d+\.\d+$/.test(v)), versions.join(" | "));
    const checkBtn = Array.from(st.doc.querySelectorAll(".sheet button")).find((b) => /\u68c0\u67e5\u66f4\u65b0|Check for updates/.test(b.textContent));
    check("settings offers a version check", !!checkBtn, st.doc.querySelector(".nav").textContent);
  }
}

console.log("console");
check("no script errors", p.errs.filter((e) => !/Not implemented|Could not parse CSS/.test(e)).length === 0, p.errs.join(" | "));

console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
