// board.ts is the controller. It owns the state machine, the network
// calls, and the DOM for both pages. The two pages differ only in the
// Page object handed to start(): what "say" does, whether View opens a
// tab, how a batch uploads, and whether text can be read in place.
//
// One controller means a fix lands once. Before this file existed the
// modern and legacy pages carried 650 lines of the same code.

import { api, postJSON, codeErr, errText } from "./api";
import { btn, clear, el } from "./dom";
import { t, tn, lang } from "./i18n";
import { byteLength, dayKey, formatBytes, formatTime, kindLabel, safeID, storeGet, storeSet, themeNow } from "./format";
import { allFiles, classifyPaste, previewable } from "./clip";
import { copyText } from "./clipboard";
import { render as renderMarkdown, isMarkdown } from "./markdown";
import type { Bootstrap, Item, ItemsBody, Page, RevealBody, UpdateBody, View } from "./types";

export interface Node {
  main: HTMLElement;
  nav: HTMLElement;
  undo: HTMLElement;
  live: HTMLElement;
  mark: HTMLElement;
  // switchLink points at the other page. The label and target come
  // from the page, because the modern and legacy pages point at each
  // other.
  switchLink: HTMLElement;
  switchLabel: (page: State) => string;
}

interface State {
  view: View;
  boot: Bootstrap | null;
  items: Item[];
  hasMore: boolean;
  itemsLoaded: boolean;
  loading: boolean;
  pending: string[];
  undoTimer: number;
  confirmClear: boolean;
  busy: boolean;
  draft: string;
  query: string;
  kindFilter: string;
  openPreview: { [id: string]: boolean };
  openText: { [id: string]: boolean };
  layout: string;
  newestId: string;
  pollTimer: number;
  editing: string;
  viewer: { id: string; name: string } | null;
  previewText: { [id: string]: string | null };
  errEl: HTMLElement | null;
  update: UpdateBody | null;

  // The composer's secret options. They survive a render because the
  // composer is rebuilt on every paint.
  secretOn: boolean;
  secretBurn: boolean;
  secretTTL: number;
  secretCode: string;
  // secretShow is whether the composer is showing the code in clear.
  // A code typed on screen is worth the same as the token it protects,
  // so the field is a password field until someone asks otherwise.
  secretShow: boolean;
  // lastCode is the code the person just made, shown once and kept until
  // they dismiss it: the server never has it, so this is the only copy.
  lastCode: string;
  lastCodeShow: boolean;
  // revealed holds the body of each secret that is currently on screen.
  revealed: { [id: string]: string };
  // askCode marks the slips whose code field is open, and codeDraft keeps
  // what was typed when a wrong code forces a repaint.
  askCode: { [id: string]: boolean };
  codeDraft: { [id: string]: string };
  codeErr: { [id: string]: string };
  // revealShow unmasks one code field at a time.
  revealShow: { [id: string]: boolean };
  secretTimer: number;
}

const fileCap = 50 * 1024 * 1024;
const textCap = 200 * 1024;
// secretCap matches store.MaxSecret on the server.
const secretCap = 4 * 1024;
// previewCap keeps a text attachment readable; larger ones get a link.
const previewCap = 256 * 1024;
const undoMillis = 8000;
// revealMillis is how long a revealed secret stays readable before the dots
// come back. The slip is still there; the screen is not a place to leave it.
const revealMillis = 30000;
// Long text slips start folded to this many lines. A full render of a
// note-sized slip would push every action row below the fold.
const textFoldLines = 12;

export function start(page: Page, node: Node): void {
  const state: State = {
    view: "loading",
    boot: null,
    items: [],
    hasMore: false,
    itemsLoaded: false,
    loading: false,
    pending: [],
    undoTimer: 0,
    confirmClear: false,
    busy: false,
    draft: "",
    query: "",
    kindFilter: "",
    openPreview: {},
    openText: {},
    layout: "",
    newestId: "",
    pollTimer: 0,
    editing: "",
    viewer: null,
    previewText: {},
    errEl: null,
    update: null,
    secretOn: false,
    secretBurn: true,
    secretTTL: 24 * 60 * 60,
    secretCode: "",
    secretShow: false,
    lastCode: "",
    lastCodeShow: false,
    revealed: {},
    askCode: {},
    codeDraft: {},
    codeErr: {},
    revealShow: {},
    secretTimer: 0
  };

  // ---- chrome -------------------------------------------------------

  // The controls a drop needs to reach. They are replaced on every render;
  // the drag listeners installed in start() read them each time.
  let formEl: HTMLFormElement | null = null;
  let writeEl: HTMLTextAreaElement | null = null;
  let dropBtn: HTMLButtonElement | null = null;
  let dragDepth = 0;

  function setOver(on: boolean): void {
    if (formEl) formEl.className = on ? "sheet composer is-over" : "sheet composer";
    page.setDragging(on);
  }

  // isTyping reports whether the focus is in a field, where a bare letter
  // should type rather than trigger a shortcut.
  function isTyping(): boolean {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return false;
    const tag = a.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable === true;
  }

  // installKeys runs once. "/" focuses the search field, Escape closes
  // the viewer or drops out of search, and the arrows move between
  // pictures while the viewer is open.
  function installKeys(): void {
    document.addEventListener("keydown", function (e) {
      if (state.viewer) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeViewer();
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          viewerStep(-1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          viewerStep(1);
          return;
        }
      }
      if (e.key === "Escape" && state.query && !isTyping()) {
        e.preventDefault();
        state.query = "";
        state.kindFilter = "";
        route();
        return;
      }
      if (e.key === "/" && !isTyping() && state.view === "board") {
        e.preventDefault();
        const field = node.main.querySelector(".search") as HTMLInputElement | null;
        if (field) {
          field.focus();
        } else {
          state.query = " ";
          route();
          const next = node.main.querySelector(".search") as HTMLInputElement | null;
          if (next) {
            next.value = "";
            state.query = "";
            next.focus();
          }
        }
      }
    });
  }

  // installDragHandlers runs once. Binding to the document is what makes a
  // drop work anywhere on the page, not just over the composer.
  function installDragHandlers(): void {
    document.addEventListener("dragenter", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth += 1;
      setOver(true);
    });
    document.addEventListener("dragover", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    });
    document.addEventListener("dragleave", function () {
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        setOver(false);
      }
    });
    document.addEventListener("drop", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      setOver(false);
      if (!dropBtn) return;
      const kind = classifyPaste(e.dataTransfer, textCap);
      if (kind.files.length) {
        sendFiles(kind.files, dropBtn);
        return;
      }
      if (kind.kind === "url" || kind.kind === "text") {
        if (writeEl) dropText(writeEl, kind.text);
        return;
      }
      sendFiles(allFiles(e.dataTransfer), dropBtn);
    });
  }

  function say(text: string): void {
    page.say(text || "");
  }

  function applyChrome(): void {
    node.mark.textContent = t("mark");
    document.title = t("mark");
    document.documentElement.lang = lang() === "en" ? "en" : "zh-CN";
    node.switchLink.textContent = node.switchLabel(state);
    const meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", themeNow() === "dark" ? "#1a1816" : "#f3efe6");
  }

  function setTheme(next: "light" | "dark"): void {
    storeSet("slip.theme", next);
    document.documentElement.setAttribute("data-theme", next);
    applyChrome();
    paintNav();
  }

  function setLang(next: string): void {
    storeSet("slip.lang", next);
    document.documentElement.setAttribute("data-lang", next);
    applyChrome();
    route();
  }

  function paintNav(): void {
    clear(node.nav);
    if (state.view === "settings") {
      node.nav.appendChild(
        btn(t("back"), function () {
          state.confirmClear = false;
          state.view = "board";
          route();
        })
      );
    }
    if (state.view === "board") {
      node.nav.appendChild(btn(t("refresh"), refresh));
    }
    const theme = themeNow();
    node.nav.appendChild(
      btn(theme === "dark" ? t("themeLight") : t("themeDark"), function () {
        setTheme(theme === "dark" ? "light" : "dark");
      })
    );
    node.nav.appendChild(
      btn(lang() === "en" ? "中文" : "EN", function () {
        setLang(lang() === "en" ? "zh" : "en");
      })
    );
    if (state.view === "board") {
      node.nav.appendChild(btn(t("settings"), openSettings));
    }
  }

  // ---- errors -------------------------------------------------------

  // noticeTimer clears the bottom notice so it does not sit there forever.
  let noticeTimer = 0;

  // showErr reports a failure where the person is looking. The inline error
  // line under the composer is only reachable when the composer is what
  // failed; a delete or an edit fails on a card further down the page, so the
  // message also goes to the notice at the bottom of the viewport.
  function showErr(err: any): void {
    const text = errText(err);
    if (state.errEl) {
      state.errEl.hidden = false;
      state.errEl.textContent = text;
    }
    showNotice(text);
    say(text);
  }

  // showNotice puts one line at the bottom, reusing the undo bar's place.
  // It never replaces an undo that is still offering to take something back.
  function showNotice(text: string): void {
    if (!node.undo.hidden) {
      say(text);
      return;
    }
    clear(node.undo);
    node.undo.appendChild(el("span", "", text));
    node.undo.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () {
      node.undo.hidden = true;
    }, 4000);
  }

  function loseAuth(): void {
    state.viewer = null;
    paintViewer();
    if (state.boot) state.boot.authed = false;
    state.view = "login";
    state.items = [];
    state.itemsLoaded = false;
    state.openPreview = {};
    state.openText = {};
    state.previewText = {};
    state.confirmClear = false;
    route();
  }

  function guard(err: any): boolean {
    if (err && err.status === 401 && state.view !== "login" && state.view !== "setup") {
      loseAuth();
      return true;
    }
    return false;
  }

  // ---- routing ------------------------------------------------------

  function decide(): View {
    const b = state.boot;
    if (!b) return "loading";
    if (!b.ready && b.loopback) return "setup";
    if (!b.ready) return "waiting";
    if (!b.authed) return "login";
    if (state.view === "settings") return "settings";
    return "board";
  }

  function route(): void {
    if (!state.boot) return;
    state.view = decide();
    applyChrome();
    paintNav();
    state.errEl = null;
    if (state.view === "board") {
      startPolling();
    } else {
      stopPolling();
    }
    if (state.view === "setup") renderSetup();
    else if (state.view === "waiting") renderWaiting();
    else if (state.view === "login") renderLogin();
    else if (state.view === "settings") renderSettings();
    else renderBoard();
  }

  // ---- shared form bits ---------------------------------------------

  function passwordField(label: string, name: string, autocomplete: string): { wrap: HTMLElement; input: HTMLInputElement } {
    const wrap = el("div");
    const id = "f-" + name;
    const lab = el("label", "", label) as HTMLLabelElement;
    lab.htmlFor = id;
    const input = el("input") as HTMLInputElement;
    input.type = "password";
    input.id = id;
    input.name = name;
    input.setAttribute("autocomplete", autocomplete);
    input.autocapitalize = "off";
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function errorLine(): HTMLElement {
    const p = el("p", "err", "");
    p.hidden = true;
    state.errEl = p;
    return p;
  }

  function run(button: HTMLButtonElement, label: string, work: () => Promise<any>): Promise<void> {
    state.busy = true;
    button.disabled = true;
    button.textContent = t("sending");
    return work().then(
      function () {
        state.busy = false;
      },
      function (err: any) {
        state.busy = false;
        button.disabled = false;
        button.textContent = label;
        if (!guard(err)) showErr(err);
      }
    );
  }

  // ---- entry --------------------------------------------------------

  function enter(): Promise<void> {
    return api<Bootstrap>("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      state.itemsLoaded = false;
      state.items = [];
      state.view = boot.authed ? "board" : "login";
      route();
    });
  }

  function refreshBoot(): void {
    api<Bootstrap>("/api/bootstrap")
      .then(function (boot) {
        state.boot = boot;
        if (boot.authed) state.view = "board";
        route();
      })
      .catch(function (err) {
        say(errText(err));
      });
  }

  function refresh(): void {
    api<Bootstrap>("/api/bootstrap")
      .then(function (boot) {
        state.boot = boot;
        if (!boot.ready || !boot.authed) {
          state.itemsLoaded = false;
          route();
          return;
        }
        state.view = "board";
        state.itemsLoaded = false;
        route();
      })
      .catch(function (err) {
        if (!guard(err)) say(errText(err));
      });
  }

  function openSettings(): void {
    api<Bootstrap>("/api/bootstrap")
      .then(function (boot) {
        state.boot = boot;
        if (!boot.authed) {
          loseAuth();
          return;
        }
        state.confirmClear = false;
        state.view = "settings";
        route();
      })
      .catch(function (err) {
        if (!guard(err)) say(errText(err));
      });
  }

  // ---- setup, waiting, login ----------------------------------------

  function renderSetup(): void {
    clear(node.main);
    const sheet = el("form", "sheet") as HTMLFormElement;
    sheet.appendChild(el("p", "lead", t("setupLead")));
    const fields = el("div", "fields");
    const a = passwordField(t("passphrase"), "setup-pass", "new-password");
    const b = passwordField(t("passphraseAgain"), "setup-again", "new-password");
    fields.appendChild(a.wrap);
    fields.appendChild(b.wrap);
    sheet.appendChild(fields);
    const row = el("div", "row");
    const go = el("button", "seal", t("start")) as HTMLButtonElement;
    go.type = "submit";
    row.appendChild(go);
    sheet.appendChild(row);
    sheet.appendChild(errorLine());
    sheet.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      if (a.input.value !== b.input.value) {
        showErr(codeErr("passphrase_mismatch"));
        return;
      }
      if (Array.from(a.input.value).length < 6) {
        showErr(codeErr("passphrase_too_short"));
        return;
      }
      run(go, t("start"), function () {
        return postJSON("/api/setup", { passphrase: a.input.value, again: b.input.value }).then(enter);
      });
    });
    node.main.appendChild(sheet);
  }

  function renderWaiting(): void {
    clear(node.main);
    const sheet = el("div", "sheet");
    sheet.appendChild(el("p", "lead", t("waiting")));
    sheet.appendChild(btn(t("refresh"), refreshBoot, "seal"));
    node.main.appendChild(sheet);
  }

  function renderLogin(): void {
    clear(node.main);
    const sheet = el("form", "sheet") as HTMLFormElement;
    sheet.appendChild(el("p", "lead", t("loginLead")));
    const fields = el("div", "fields");
    const a = passwordField(t("passphrase"), "login-pass", "current-password");
    fields.appendChild(a.wrap);
    sheet.appendChild(fields);
    const row = el("div", "row");
    const go = el("button", "seal", t("unlock")) as HTMLButtonElement;
    go.type = "submit";
    row.appendChild(go);
    sheet.appendChild(row);
    sheet.appendChild(errorLine());
    sheet.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      run(go, t("unlock"), function () {
        return postJSON("/api/login", { passphrase: a.input.value }).then(enter);
      });
    });
    node.main.appendChild(sheet);
    a.input.focus();
  }

  // ---- board --------------------------------------------------------

  function visibleItems(): Item[] {
    const q = state.query.trim().toLowerCase();
    const kind = state.kindFilter;
    return state.items.filter(function (it) {
      if (kind && it.kind !== kind) return false;
      if (!q) return true;
      // A secret has no body in the list, so there is nothing to match and
      // nothing to leak through a hit count.
      if (it.secret) return false;
      if (it.kind === "text" && it.text) return it.text.toLowerCase().indexOf(q) !== -1;
      if (it.name) return it.name.toLowerCase().indexOf(q) !== -1;
      return false;
    });
  }

  // controlsBar is the row under the search field: kind chips on the
  // left, the layout switch on the right. The chips only appear when
  // there is a choice to make, but the row itself stays while the
  // board has slips, because the layout switch needs a home the person
  // can find. It belongs here rather than in the top nav: that row is
  // page-level (refresh, theme, language, settings), while this row
  // already changes how the board is shown.
  function controlsBar(): HTMLElement {
    const row = el("div", "kindbar");
    const present = ["text", "image", "file"].filter(function (k) {
      return state.items.some(function (it) {
        return it.kind === k;
      });
    });
    // An active filter keeps its chip even when the last slip of that
    // kind is gone, otherwise the only way to clear the filter would
    // disappear with it.
    if (state.kindFilter && present.indexOf(state.kindFilter) === -1) present.push(state.kindFilter);
    if (present.length > 1 || state.kindFilter) {
      const kinds = [""].concat(present);
      kinds.forEach(function (k) {
        const n = k ? state.items.filter(function (it) { return it.kind === k; }).length : state.items.length;
        const label = (k ? kindLabel(k) : t("kindAll")) + " " + n;
        const b = btn(label, function () {
          state.kindFilter = state.kindFilter === k ? "" : k;
          if (state.view === "board") renderBoard();
        }, state.kindFilter === k ? "kindbtn is-on" : "kindbtn");
        b.setAttribute("aria-pressed", state.kindFilter === k ? "true" : "false");
        row.appendChild(b);
      });
    }
    // The label names the layout a tap switches to, so the icon is the
    // shape of what is coming: stacked lines for the list, a filled
    // square for the wall.
    const grid = layoutChoice() === "grid";
    const swap = btn(
      (grid ? "\u2630 " : "\u25A6 ") + (grid ? t("layoutList") : t("layoutGrid")),
      function () {
        setLayout(grid ? "list" : "grid");
      },
      "textbtn layoutbtn"
    );
    swap.setAttribute("aria-label", grid ? t("layoutList") : t("layoutGrid"));
    row.appendChild(swap);
    return row;
  }

  // layoutChoice reads the saved board layout. Grid is opt-in: the list
  // is the default because it shows text slips in full.
  function layoutChoice(): "list" | "grid" {
    return storeGet("slip.layout") === "grid" ? "grid" : "list";
  }

  function setLayout(next: "list" | "grid"): void {
    storeSet("slip.layout", next);
    if (state.view === "board") renderBoard();
  }

  function renderBoard(): void {
    // The board is rebuilt wholesale on every change, which empties the page
    // for a moment and takes the scroll position with it. Saving and putting
    // it back is what keeps the card you were reading under your thumb
    // instead of sending you to the top to find it again.
    const y = window.pageYOffset;
    clear(node.main);
    paintBoard();
    window.scrollTo(0, y);
    settlePrompt();
  }

  function paintBoard(): void {
    node.main.appendChild(composer());
    const code = codeCard();
    if (code) node.main.appendChild(code);
    // The search field is always present once there is something to find,
    // otherwise there is no way to start a search.
    if (state.items.length || state.query.trim()) node.main.appendChild(searchBar());
    if (!state.itemsLoaded) {
      node.main.appendChild(el("div", "skel"));
      if (!state.loading) loadFirst();
      return;
    }
    if (!state.items.length) {
      node.main.appendChild(el("p", "hint", t("empty")));
      shareHint();
      return;
    }
    node.main.appendChild(controlsBar());
    const shown = visibleItems();
    if (!shown.length) {
      node.main.appendChild(el("p", "hint", state.kindFilter && !state.query.trim() ? t("kindEmpty") : t("searchEmpty")));
      return;
    }
    if (layoutChoice() === "grid" && !state.query.trim()) {
      renderBoardGrid(shown);
    } else {
      renderBoardList(shown);
    }
    if (state.hasMore && !state.query.trim() && !state.kindFilter) {
      node.main.appendChild(btn(t("loadMore"), loadMore, "textbtn more"));
      node.main.appendChild(loadMoreSentinel());
    }
  }

  // settlePrompt puts the code field back where the person is looking. A
  // repaint follows every press, and without this the page lands at the top
  // and the slip they were opening has to be found a second time.
  function settlePrompt(): void {
    const box = document.querySelector(".codeprompt") as HTMLElement | null;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const view = window.innerHeight || document.documentElement.clientHeight || 0;
    const target = window.pageYOffset + rect.top - Math.max(12, (view - rect.height) / 2);
    window.scrollTo(0, target < 0 ? 0 : target);
    const field = box.querySelector(".codeinput") as HTMLInputElement | null;
    if (!field) return;
    try {
      field.focus({ preventScroll: true } as any);
    } catch (e) {
      field.focus();
    }
  }

  // renderBoardList is the classic single column, with day separators
  // between slips from different days so older content can be found
  // by date while scrolling.
  function renderBoardList(shown: Item[]): void {
    let lastDay = "";
    shown.forEach(function (it, i) {
      const day = dayKeyOf(it);
      if (day !== lastDay) {
        lastDay = day;
        node.main.appendChild(el("p", "daysep", dayLabel(it)));
      }
      node.main.appendChild(slipNode(it, i === 0 && !state.query.trim() && !state.kindFilter));
    });
  }

  // renderBoardGrid is the picture-wall layout. Every slip becomes a
  // tile, dealt alternately into two columns so the newest slip sits
  // top-left and the eye still reads left to right. Each column is its
  // own stack, which is what keeps a short note from leaving a hole
  // under a tall picture the way a single wrapped row would. It is
  // opt-in through the nav toggle, and only while no search is
  // narrowing the board, because a search should show every hit in
  // full rather than clip it to a tile.
  function renderBoardGrid(shown: Item[]): void {
    const wall = el("div", "wall");
    const cols = [el("div", "wallcol"), el("div", "wallcol")];
    const fresh = !state.query.trim() && !state.kindFilter;
    shown.forEach(function (it, i) {
      cols[i % 2].appendChild(gridTile(it, i === 0 && fresh));
    });
    wall.appendChild(cols[0]);
    wall.appendChild(cols[1]);
    node.main.appendChild(wall);
  }

  // gridTile is one card in the wall. A picture is the tile: the thumb
  // fills the width and its own shape gives the column its height, so
  // rows of different heights interlock. Notes and files keep the card
  // from the list, in its compact form: the tile has room for the time
  // and one More button, and everything else waits in that menu.
  function gridTile(it: Item, newest: boolean): HTMLElement {
    const id = safeID(it.id);
    const tile = el("div", newest ? "tile is-new" : "tile");
    tile.setAttribute("data-kind", it.kind);
    if (it.kind === "image" && it.hasThumb && id) {
      const img = el("img", "tileimg") as HTMLImageElement;
      img.alt = it.name || t("imageKind");
      img.loading = "lazy";
      img.src = "/api/items/" + id + "/thumb";
      img.addEventListener("click", function () {
        openViewer(it, id);
      });
      tile.appendChild(img);
      const cap = metaText(it);
      if (cap) tile.appendChild(el("p", "tilecap", cap));
      return tile;
    }
    tile.appendChild(slipNode(it, false, true));
    return tile;
  }

  function dayKeyOf(it: Item): string {
    const d = new Date(it.createdAt);
    return isNaN(d.getTime()) ? "" : dayKey(d);
  }

  // dayLabel names the group a slip belongs to: today, yesterday, or
  // the plain date.
  function dayLabel(it: Item): string {
    const d = new Date(it.createdAt);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const yest = new Date(now.getTime());
    yest.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return t("today");
    if (dayKey(d) === dayKey(yest)) return t("yesterday");
    return dayKey(d);
  }

  // loadMoreSentinel is an empty marker at the end of the list. When it
  // scrolls into view the next page loads by itself; the button above
  // it stays for keyboards and for browsers without IntersectionObserver.
  function loadMoreSentinel(): HTMLElement {
    const mark = el("div", "moresentinel");
    if (typeof IntersectionObserver === "undefined") return mark;
    const seen = new WeakMap();
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (seen.get(entry.target)) return;
        seen.set(entry.target, true);
        io.unobserve(entry.target);
        loadMore();
      });
    });
    io.observe(mark);
    return mark;
  }

  // searchBar is the only control that edits state.query. It re-renders on
  // input so the list narrows as you type, and it takes the caret back
  // afterwards because renderBoard rebuilds the whole board.
  //
  // Composition is why the input handler checks isComposing. A Chinese
  // IME fires input events for every pinyin letter before the person
  // confirms a character; repainting mid-composition both commits the
  // raw letters into the query and rebuilds the field out from under
  // the IME. compositionend fires when a candidate is confirmed, and
  // the input event that follows it carries the final text.
  function searchBar(): HTMLElement {
    const row = el("div", "searchbar");
    const input = el("input", "search") as HTMLInputElement;
    input.type = "text";
    input.value = state.query;
    input.placeholder = t("searchPlaceholder");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("aria-label", t("searchPlaceholder"));
    input.spellcheck = false;
    let composing = false;
    input.addEventListener("compositionstart", function () {
      composing = true;
    });
    input.addEventListener("compositionend", function () {
      composing = false;
      state.query = input.value;
      repaintKeepSearch();
    });
    input.addEventListener("input", function () {
      if (composing) return;
      state.query = input.value;
      repaintKeepSearch();
    });
    row.appendChild(input);
    if (state.query.trim()) {
      row.appendChild(
        btn(t("clearSearch"), function () {
          state.query = "";
          route();
        }, "textbtn")
      );
    }
    return row;
  }

  // repaintKeepSearch redraws the board without losing the caret position
  // in the search field.
  function repaintKeepSearch(): void {
    const caret = state.query.length;
    renderBoard();
    const next = node.main.querySelector(".search") as HTMLInputElement | null;
    if (!next) return;
    next.focus();
    try {
      next.setSelectionRange(caret, caret);
    } catch (e) {
      // Older engines refuse on some input types. Losing the caret is fine.
    }
  }

  function shareHint(): void {
    const urls = (state.boot && state.boot.urls) || [];
    if (!urls.length) {
      if (state.boot && state.boot.loopback) node.main.appendChild(el("p", "hint", t("noLan")));
      return;
    }
    const row = el("div", "urlrow");
    row.appendChild(el("div", "", t("share")));
    node.main.appendChild(row);
    const line = el("div", "urlrow");
    line.appendChild(el("div", "url", urls[0]));
    line.appendChild(copyButton(urls[0]));
    node.main.appendChild(line);
  }

  // ---- composer -----------------------------------------------------

  function composer(): HTMLElement {
    const form = el("form", "sheet composer") as HTMLFormElement;
    const lab = el("label", "", t("writeLabel")) as HTMLLabelElement;
    const ta = el("textarea") as HTMLTextAreaElement;
    ta.id = "write";
    lab.htmlFor = "write";
    ta.value = state.draft;
    ta.placeholder = t("writeHint");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "off");
    ta.spellcheck = false;
    ta.addEventListener("input", function () {
      state.draft = ta.value;
    });
    ta.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        go.click();
      }
    });
    ta.addEventListener("paste", function (e) {
      onPaste(e, ta, go);
    });

    const row = el("div", "row");
    const pick = btn(t("addFile"), function () {
      // A file cannot be a secret, and quietly posting one in the clear
      // while the switch is on would be the worst possible answer. The
      // press explains itself instead of doing nothing.
      if (state.secretOn) {
        showNotice(t("secretTextOnly"));
        return;
      }
      file.click();
    }, "textbtn");
    const go = el("button", "seal", t("drop")) as HTMLButtonElement;
    go.type = "submit";
    const file = el("input") as HTMLInputElement;
    file.type = "file";
    file.className = "clip";
    file.multiple = true;
    file.tabIndex = -1;
    file.setAttribute("aria-hidden", "true");
    file.addEventListener("change", function () {
      if (file.files && file.files.length) sendFiles(allFilesOfInput(file), go);
      file.value = "";
    });
    row.appendChild(pick);
    row.appendChild(go);
    form.appendChild(lab);
    form.appendChild(ta);
    form.appendChild(secretOptions());
    form.appendChild(row);
    form.appendChild(file);
    const err = errorLine();
    form.appendChild(err);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitText(ta, go);
    });

    // The page-wide drag listeners are installed once, in start(), because
    // composer() runs on every render. Keeping the current controls here lets
    // those listeners act on whatever is on screen now.
    formEl = form;
    writeEl = ta;
    dropBtn = go;
    return form;
  }

  // secretOptions is the row that turns a slip into a secret. It is a switch,
  // not a detector: the product does not guess what looks sensitive, because a
  // wrong guess teaches people to trust a green light that is not there.
  function secretOptions(): HTMLElement {
    const wrap = el("div", "secretopts");

    // One switch, and a description a step down from its label. The same
    // size for both is what made the description read as a second sentence.
    const line = el("label", "checkline");
    const box = document.createElement("input") as HTMLInputElement;
    box.type = "checkbox";
    box.checked = state.secretOn;
    box.addEventListener("change", function () {
      state.secretOn = box.checked;
      if (state.view === "board") renderBoard();
    });
    line.appendChild(box);
    line.appendChild(el("span", "checktext", t("secretToggle")));
    line.appendChild(el("span", "checksub", state.secretBurn ? t("secretToggleHint") : t("secretKeepHint")));
    wrap.appendChild(line);

    if (!state.secretOn) {
      return wrap;
    }

    // Everything below belongs to the switch, so it sits under its label,
    // aligned past the checkbox.
    const body = el("div", "optsbody");

    // Burning and the clock answer one question, so they share a line.
    const when = el("div", "optline");
    const burnLabel = el("label", "inlinecheck");
    const burn = document.createElement("input") as HTMLInputElement;
    burn.type = "checkbox";
    burn.checked = state.secretBurn;
    burn.addEventListener("change", function () {
      state.secretBurn = burn.checked;
      // The description above says what the switch does; it has to follow.
      const sub = line.querySelector(".checksub") as HTMLElement | null;
      if (sub) sub.textContent = state.secretBurn ? t("secretToggleHint") : t("secretKeepHint");
    });
    burnLabel.appendChild(burn);
    burnLabel.appendChild(el("span", "checktext", t("burn")));
    when.appendChild(burnLabel);

    // Three choices, so they are three chips rather than a popup: a native
    // select renders its value at 16px (below that iOS zooms the page) and
    // was the largest text in a row of 12px labels. Chips are 12px, show
    // every option at once, and no keyboard opens.
    const keep = el("div", "inlinekeep");
    keep.appendChild(el("span", "keepword", t("ttlLabel")));
    const segs = el("div", "segset");
    segs.setAttribute("role", "group");
    segs.setAttribute("aria-label", t("ttlLabel"));
    const choices = [
      { v: 600, label: t("ttl10") },
      { v: 3600, label: t("ttl60") },
      { v: 86400, label: t("ttl24") }
    ];
    const segBtns: HTMLButtonElement[] = [];
    let i;
    for (i = 0; i < choices.length; i++) {
      const on = choices[i].v === state.secretTTL;
      const seg = btn(choices[i].label, picker(i), on ? "segbtn is-on" : "segbtn");
      seg.setAttribute("aria-pressed", on ? "true" : "false");
      segBtns.push(seg);
      segs.appendChild(seg);
    }

    // The classes are swapped in place rather than by repainting, so the
    // composer keeps its caret and the choice lands instantly.
    function picker(index: number): () => void {
      return function () {
        state.secretTTL = choices[index].v;
        let j;
        for (j = 0; j < segBtns.length; j++) {
          const on = j === index;
          segBtns[j].className = on ? "segbtn is-on" : "segbtn";
          segBtns[j].setAttribute("aria-pressed", on ? "true" : "false");
        }
      };
    }
    keep.appendChild(segs);
    when.appendChild(keep);
    body.appendChild(when);

    // The code is a field, not a row of controls: a small label above, and
    // one bordered group holding the field and its two actions, so the row
    // does not turn into three boxes of three different heights.
    const field = el("div", "optfield");
    const head = el("div", "optfieldhead");
    head.appendChild(el("span", "fieldlabel", t("code")));
    head.appendChild(el("span", "fieldaside", t("codeOptional")));
    field.appendChild(head);

    const group = el("div", "codegroup");
    const code = document.createElement("input") as HTMLInputElement;
    code.type = state.secretShow ? "text" : "password";
    code.className = "codeinput";
    code.value = state.secretCode;
    code.placeholder = t("codePlaceholder");
    code.setAttribute("autocomplete", "off");
    code.setAttribute("autocapitalize", "characters");
    code.setAttribute("autocorrect", "off");
    code.setAttribute("spellcheck", "false");
    code.setAttribute("aria-label", t("code"));
    code.addEventListener("input", function () {
      state.secretCode = code.value;
    });
    const see = btn(state.secretShow ? t("hide") : t("show"), function () {
      // Toggled in place rather than by repainting, so the caret stays
      // where it was and the code is not lost to a re-render.
      state.secretShow = !state.secretShow;
      code.type = state.secretShow ? "text" : "password";
      see.textContent = state.secretShow ? t("hide") : t("show");
    }, "gbtn");
    see.setAttribute("aria-pressed", state.secretShow ? "true" : "false");
    const gen = btn(t("codeGen"), function () {
      state.secretCode = newCode();
      state.secretShow = true;
      if (state.view === "board") renderBoard();
    }, "gbtn");
    group.appendChild(code);
    group.appendChild(see);
    group.appendChild(gen);
    field.appendChild(group);
    field.appendChild(el("p", "fieldnote", t("codeNote")));
    body.appendChild(field);

    body.appendChild(el("p", "secretnote", t("secretNote")));
    wrap.appendChild(body);
    return wrap;
  }

  // codeCard holds the code just made. It is the only copy that exists in a
  // readable form: the server keeps the ciphertext and never the code, so a
  // slip whose code was lost can only be deleted and put down again. The code
  // starts behind dots even here, because a card left on screen is the same
  // leak as the slip itself.
  function codeCard(): HTMLElement | null {
    if (!state.lastCode) return null;
    const sheet = el("div", "sheet codecard");
    const head = el("div", "codehead");
    head.appendChild(el("span", "kindtag", t("code")));
    const close = btn("\u00D7", function () {
      state.lastCode = "";
      state.lastCodeShow = false;
      if (state.view === "board") renderBoard();
    }, "textbtn codeclose");
    close.setAttribute("aria-label", t("close"));
    head.appendChild(close);
    sheet.appendChild(head);

    const shown = state.lastCodeShow;
    const line = el("div", "urlrow");
    const value = el("div", shown ? "url codevalue" : "url codevalue is-masked", shown ? state.lastCode : "\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022");
    line.appendChild(value);
    // Copy works off the real value whether or not it is on screen: the
    // button is the main way to move a code to another device.
    line.appendChild(copyButton(state.lastCode));
    const see = btn(shown ? t("hide") : t("show"), function () {
      state.lastCodeShow = !state.lastCodeShow;
      if (state.view === "board") renderBoard();
    }, "textbtn codetoggle");
    see.setAttribute("aria-pressed", shown ? "true" : "false");
    line.appendChild(see);
    sheet.appendChild(line);
    sheet.appendChild(el("p", "hint", t("codeOnce")));
    return sheet;
  }

  // newCode makes a code shaped like the server's own generator: eight
  // characters from an alphabet without 0/O or 1/I/L, split in two. It is
  // generated here rather than on the server so the code never makes a round
  // trip it does not need.
  function newCode(): string {
    const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    const bytes: number[] = [];
    const c = (window as any).crypto;
    let i: number;
    if (c && typeof c.getRandomValues === "function") {
      const buf = new Uint8Array(8);
      c.getRandomValues(buf);
      for (i = 0; i < 8; i++) bytes.push(buf[i]);
    } else {
      for (i = 0; i < 8; i++) bytes.push(Math.floor(Math.random() * 256));
    }
    let out = "";
    for (i = 0; i < 8; i++) {
      if (i === 4) out += "-";
      out += alphabet.charAt(bytes[i] % alphabet.length);
    }
    return out;
  }

  function hasFiles(e: DragEvent): boolean {
    const dt = e.dataTransfer;
    if (!dt) return false;
    if (dt.types) {
      let i;
      for (i = 0; i < dt.types.length; i++) {
        if (dt.types[i] === "Files" || dt.types[i] === "text/plain" || dt.types[i] === "text/uri-list") return true;
      }
    }
    return !!(dt.files && dt.files.length);
  }

  function allFilesOfInput(input: HTMLInputElement): File[] {
    const out: File[] = [];
    let i;
    if (!input.files) return out;
    for (i = 0; i < input.files.length; i++) out.push(input.files[i]);
    return out;
  }

  function dropText(ta: HTMLTextAreaElement, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (ta.value.trim() && !/\s$/.test(ta.value)) ta.value = ta.value + "\n" + trimmed;
    else ta.value = ta.value + trimmed;
    state.draft = ta.value;
    ta.focus();
  }

  function onPaste(e: ClipboardEvent, ta: HTMLTextAreaElement, go: HTMLButtonElement): void {
    const kind = classifyPaste(e.clipboardData, textCap);
    if (kind.kind === "image") {
      e.preventDefault();
      sendFiles(kind.files, go);
      return;
    }
    if (kind.kind === "files" && kind.text) {
      // A very long paste. Keep it as a file rather than the composer.
      e.preventDefault();
      const blob = new Blob([kind.text], { type: "text/plain" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const named = new File([blob], "pasted-" + stamp + ".txt", { type: "text/plain" });
      sendFiles([named], go);
      return;
    }
    // Plain text and URLs paste normally into the textarea.
  }

  function submitText(ta: HTMLTextAreaElement, button: HTMLButtonElement): void {
    const text = ta.value;
    if (!text.trim()) {
      showErr(codeErr("empty"));
      return;
    }
    const cap = state.secretOn ? secretCap : textCap;
    if (byteLength(text) > cap) {
      showErr(codeErr("text_too_large"));
      return;
    }
    const code = state.secretCode.replace(/^\s+|\s+$/g, "");
    if (state.secretOn && code && code.length < 6) {
      showErr(codeErr("code_too_short"));
      return;
    }
    const body: any = { text: text };
    if (state.secretOn) {
      body.secret = true;
      body.burn = state.secretBurn;
      body.ttl = state.secretTTL;
      if (code) body.code = code;
    }
    run(button, t("drop"), function () {
      return postJSON("/api/text", body).then(function () {
        // The code is shown once, right after the slip is made. Keeping it in
        // the field would put it in the next slip by accident.
        if (body.code) {
          state.lastCode = body.code;
          state.lastCodeShow = false;
        }
        state.draft = "";
        state.secretOn = false;
        state.secretShow = false;
        state.secretCode = "";
        return reloadItems();
      });
    });
  }

  function sendFiles(files: File[], button: HTMLButtonElement): void {
    let i;
    if (state.secretOn) {
      // Files never become secrets. Dropping one while the switch is on has
      // to stop rather than quietly post it in the clear.
      showNotice(t("secretTextOnly"));
      return;
    }
    if (!files.length) {
      showErr(codeErr("empty"));
      return;
    }
    for (i = 0; i < files.length; i++) {
      if (files[i].size > fileCap) {
        showErr(codeErr("too_large"));
        return;
      }
    }
    run(button, t("drop"), function () {
      let chain = Promise.resolve();
      for (i = 0; i < files.length; i += 8) {
        (function (batch: File[]) {
          chain = chain.then(function () {
            return uploadBatch(batch);
          });
        })(files.slice(i, i + 8));
      }
      return chain.then(function () {
        return reloadItems();
      });
    });
  }

  function uploadBatch(files: File[]): Promise<any> {
    return new Promise(function (resolve, reject) {
      page.uploadBatch(files, function (ok) {
        if (ok) resolve(null);
        else reject(codeErr("bad_request"));
      });
    });
  }

  // ---- loading ------------------------------------------------------

  function loadFirst(): void {
    state.loading = true;
    api<ItemsBody>("/api/items?limit=40")
      .then(function (body) {
        state.loading = false;
        state.itemsLoaded = true;
        state.items = body.items || [];
        state.hasMore = !!body.hasMore;
        noteNewest();
        startPolling();
        if (state.view === "board") renderBoard();
      })
      .catch(function (err) {
        state.loading = false;
        state.itemsLoaded = true;
        if (guard(err)) return;
        if (state.view === "board") renderBoard();
        showErr(err);
      });
  }

  function reloadItems(): Promise<void> {
    return api<ItemsBody>("/api/items?limit=40").then(function (body) {
      state.itemsLoaded = true;
      state.items = body.items || [];
      state.hasMore = !!body.hasMore;
      noteNewest();
      if (state.view === "board") renderBoard();
    });
  }

  // noteNewest remembers the id at the top of the board. It is what
  // the poll compares against to spot slips made on other devices.
  function noteNewest(): void {
    state.newestId = state.items.length ? state.items[0].id : "";
  }

  // startPolling asks for the newest slip every twenty seconds. A GET
  // of one item is cheap on a home network, and the reply only turns
  // into a bar at the top when it is a slip this tab has not seen.
  // The poll runs while the board is showing; the timer is cleared on
  // every route away from it.
  function startPolling(): void {
    if (state.pollTimer) return;
    state.pollTimer = setInterval(function () {
      if (state.view !== "board" || document.hidden) return;
      api<ItemsBody>("/api/items?limit=1")
        .then(function (body) {
          const top = body.items && body.items[0];
          if (!top || !state.newestId || top.id === state.newestId) return;
          if (document.getElementById("newbar")) return;
          const bar = btn(t("newItems"), function () {
            if (bar.parentNode) bar.parentNode.removeChild(bar);
            refresh();
          }, "newbar");
          bar.id = "newbar";
          document.body.appendChild(bar);
        })
        .catch(function () {
          // Offline for a moment; the poll simply tries again.
        });
    }, 20000);
  }

  function stopPolling(): void {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = 0;
    }
    const bar = document.getElementById("newbar");
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  function loadMore(): void {
    if (state.loading || !state.items.length) return;
    if (state.query.trim() || state.kindFilter) return;
    state.loading = true;
    const last = state.items[state.items.length - 1].id;
    api<ItemsBody>("/api/items?limit=40&before=" + encodeURIComponent(last))
      .then(function (body) {
        state.loading = false;
        state.items = state.items.concat(body.items || []);
        state.hasMore = !!body.hasMore;
        if (state.view === "board") renderBoard();
      })
      .catch(function (err) {
        state.loading = false;
        if (!guard(err)) showErr(err);
      });
  }

  // ---- slips --------------------------------------------------------

  // kindGlyph is a small pictogram that rides in the kind tag. Text
  // glyphs rather than images: they need no requests, work on iOS 12,
  // and pass the strict CSP without exception.
  function kindGlyph(kind: string): string {
    if (kind === "image") return "\u25A3 "; // square with inner square
    if (kind === "file") return "\u25A4 ";  // square with inner lines
    return "\u274F ";                        // lower-right pencil
  }

  // metaText is the line in the header: time, then size, then an edit
  // marker. A secret shows what is left of its life instead of a size,
  // because the clock is the thing the reader needs. A tile passes short,
  // because the size is the part worth dropping when the line has to fit in
  // a quarter of the screen.
  function metaText(it: Item, short?: boolean): string {
    const parts: string[] = [];
    const when = formatTime(it.createdAt);
    if (when) parts.push(when);
    if (it.secret) {
      if (it.sealed) parts.push(t("secretSealed"));
      if (it.takenAt) parts.push(t("taken"));
      else {
        const left = leftText(it);
        if (left) parts.push(left);
      }
    } else if (it.size && !short) {
      parts.push(formatBytes(it.size));
    }
    if (it.editedAt) parts.push(t("edited"));
    return parts.join(" · ");
  }

  // startSecretClock keeps "还剩 23 分钟" honest. It rewrites only the meta
  // line of secrets that are still alive, because a repaint would take the
  // caret out of the composer or out of an open code field.
  function startSecretClock(): void {
    if (state.secretTimer) return;
    state.secretTimer = setInterval(function () {
      if (state.view !== "board") return;
      let i;
      for (i = 0; i < state.items.length; i++) {
        const it = state.items[i];
        if (!it.secret || it.takenAt) continue;
        const line = document.querySelector('.slip[data-id="' + it.id + '"] .meta') as HTMLElement | null;
        if (line) line.textContent = metaText(it);
      }
    }, 30000);
  }

  // leftText says how long a secret has. It is coarse on purpose: minutes
  // under an hour, hours under a day, days beyond that. A clock counting
  // seconds would draw the eye to the wrong thing.
  function leftText(it: Item): string {
    if (!it.expiresAt) return "";
    const end = new Date(it.expiresAt).getTime();
    if (isNaN(end)) return "";
    const ms = end - new Date().getTime();
    if (ms <= 0) return t("expired");
    const min = Math.floor(ms / 60000);
    if (min < 60) return tn("leftMin", min < 1 ? 1 : min);
    const hours = Math.floor(min / 60);
    if (hours < 24) return tn("leftHour", hours);
    return tn("leftDay", Math.round(hours / 24));
  }

  // narrowScreen is the width at which a slip header stops showing
  // every action. It is a width test rather than a device test, so a
  // rotated phone and a narrow desktop window behave the same.
  function narrowScreen(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches;
  }

  // actionRow lays the actions out beside the time. A phone has no room
  // for five buttons on one line, so it keeps the first one (the one
  // that kind is for: copy for a note, preview for a file) and folds
  // the rest into a More menu. A tile is narrower still, so it folds
  // every action and shows only More. A wider window shows them all,
  // because then they fit on the same line as the time.
  //
  // onMenu reports the menu opening and closing, so the card can lift
  // above its neighbours: a sticky header is its own stacking context,
  // and an open menu would otherwise slide under the next card.
  function actionRow(actions: HTMLElement[], onMenu: (open: boolean) => void, compact?: boolean): HTMLElement {
    const row = el("div", "row");
    const inline = compact ? false : actions.length <= 2 || !narrowScreen();
    if (inline) {
      actions.forEach(function (a) {
        row.appendChild(a);
      });
      return row;
    }
    if (!compact) row.appendChild(actions[0]);
    const more = el("details", "actmore");
    more.appendChild(el("summary", "textbtn", t("more")));
    const menu = el("div", "menu");
    (compact ? actions : actions.slice(1)).forEach(function (a) {
      menu.appendChild(a);
    });
    more.appendChild(menu);
    more.addEventListener("toggle", function () {
      onMenu(more.hasAttribute("open"));
    });
    row.appendChild(more);
    return row;
  }

  // confirmButton asks twice for anything hard to take back. The first
  // click arms the button, the second click acts. Arming is forgotten on
  // the next render, so nothing stays armed for long.
  function slipNode(it: Item, newest: boolean, compact?: boolean): HTMLElement {
    const id = safeID(it.id);
    const secret = !!it.secret;
    const card = el("article", newest ? "slip is-new" : "slip");
    // The kind drives the tag colour in the CSS; data-kind keeps that
    // choice in the document rather than in a class-name string. A secret
    // gets its own value so the tag can be marked without a second class.
    card.setAttribute("data-kind", secret ? "secret" : it.kind);
    // data-id lets a repaint find one card again, which is what keeps the
    // code field of the slip you are opening under your thumb.
    if (id) card.setAttribute("data-id", id);

    // The header holds the time on the left and the actions on the
    // right. It sticks to the viewport top while its card is on
    // screen, so a long slip can be closed or deleted without
    // scrolling back to where the card began. The kind leads the
    // header as a small seal, because "text, picture, or file" is the
    // first thing a person scans for. A tile is narrow enough that the
    // seal keeps only its glyph, with the words left to the tooltip.
    const head = el("div", "sliphead");
    const tagLabel = secret ? t("secretKind") : kindLabel(it.kind);
    const tagGlyph = secret ? "\u25CF " : kindGlyph(it.kind);
    const glyph = compact ? tagGlyph.replace(" ", "") : tagGlyph + tagLabel;
    const kindTag = el("span", "kindtag", glyph);
    if (compact) kindTag.setAttribute("title", tagLabel);
    head.appendChild(kindTag);
    head.appendChild(el("span", "meta", metaText(it, compact)));
    // Every action is built first and laid out afterwards, because the
    // header decides how many of them fit beside the time.
    const actions: HTMLElement[] = [];
    if (secret) {
      // A tombstone has nothing to open and nothing to copy, so it falls
      // through with only the delete action.
      if (id && !it.takenAt) {
        // A secret reads through one control that opens and closes, because
        // the body is not in the list to copy from. Copy comes first once the
        // body is on screen: it is the reason for opening the slip, so it is
        // the action that must survive the More menu on a narrow screen.
        const shown = !!state.revealed[id];
        if (shown) {
          const copy = btn(t("copy"), function () {
            copyButtonText(state.revealed[id], copy);
          }, "textbtn");
          actions.push(copy);
        }
        actions.push(
          btn(shown ? t("previewClose") : t("open"), function () {
            if (state.revealed[id]) {
              delete state.revealed[id];
            } else {
              openSecret(it, id);
              return;
            }
            if (state.view === "board") renderBoard();
          }, "textbtn")
        );
      }
    } else if (it.kind === "text") {
      const copy = btn(t("copy"), function () {
        copyButtonText(it.text || "", copy);
      }, "textbtn");
      actions.push(copy);
    }
    if (it.kind !== "text" && id && previewable(it)) {
      // The toggle sits with the other actions, not under the file name,
      // so every operation on a slip is in one place. A file reads
      // "Preview" because it opens a viewer; a long text slip reads
      // "Open" because it unfolds in place.
      const open = !!state.openPreview[id];
      actions.push(
        btn(open ? t("previewClose") : t("previewFileOpen"), function () {
          if (state.openPreview[id]) {
            delete state.openPreview[id];
          } else {
            state.openPreview[id] = true;
            loadPreview(it, id);
          }
          if (state.view === "board") renderBoard();
        }, "textbtn")
      );
    } else if (!secret && it.kind === "text" && id && state.editing !== id && countLines(it.text || "") > textFoldLines) {
      // The same toggle folds a long text slip back up. Only a slip
      // that starts folded gets one, so the row is not crowded with a
      // control that would do nothing.
      const open = !!state.openText[id];
      actions.push(
        btn(open ? t("previewClose") : t("previewOpen"), function () {
          if (state.openText[id]) {
            delete state.openText[id];
          } else {
            state.openText[id] = true;
          }
          if (state.view === "board") renderBoard();
        }, "textbtn")
      );
    }
    if (!secret && it.kind === "text" && id && state.editing !== id) {
      actions.push(
        btn(t("edit"), function () {
          state.editing = id;
          if (state.view === "board") renderBoard();
        }, "textbtn")
      );
    }
    if (id && page.canPreview(it)) actions.push(fileLink(t("view"), "/api/items/" + id + "/raw"));
    if (id && it.kind !== "text") actions.push(fileLink(t("download"), "/api/items/" + id + "/raw?dl=1"));
    if (id) {
      // The class matters: without it this button keeps the browser's
      // default chrome while every neighbour is a quiet text button.
      actions.push(confirmButton(t("remove"), t("confirmRemove"), function () {
        removeItem(id);
      }, "textbtn"));
    }
    head.appendChild(actionRow(actions, function (open) {
      if (open) {
        card.classList.add("is-menu");
      } else {
        card.classList.remove("is-menu");
      }
    }, compact));
    card.appendChild(head);

    if (secret) {
      card.appendChild(secretBody(it, id));
    } else if (it.kind === "text" && state.editing === id) {
      card.appendChild(textEditor(it, id));
    } else if (it.kind === "text") {
      card.appendChild(textBody(it, id));
    } else if (it.kind === "image" && it.hasThumb && id) {
      const img = el("img", "shot") as HTMLImageElement;
      img.alt = it.name || t("imageKind");
      img.src = "/api/items/" + id + "/thumb";
      img.addEventListener("click", function () {
        openViewer(it, id);
      });
      card.appendChild(img);
    } else {
      const nameRow = el("p", "fname", it.name || t("fileKind"));
      card.appendChild(nameRow);
      if (id && previewable(it)) {
        const pv = previewBody(it, id);
        if (pv) card.appendChild(pv);
      }
    }
    return card;
  }

  // secretBody is what a secret slip shows instead of its text. The body is
  // not in the list at all, so this asks for it and keeps it on screen for
  // half a minute: long enough to copy a token, short enough that the slip is
  // not left readable on a kitchen table.
  function secretBody(it: Item, id: string): HTMLElement {
    const shown = state.revealed[id];
    if (shown) {
      const wrap = el("div", "secretbody");
      wrap.appendChild(el("pre", "body", shown));
      wrap.appendChild(el("p", "hint", t("revealHides")));
      return wrap;
    }
    if (it.takenAt) {
      return el("p", "hint secretgone", t("takenBody"));
    }
    const box = el("div", "masked");
    // One short bar: a token is short, and a stack of bars reads as a
    // loading skeleton rather than as something blacked out.
    const redact = el("div", "redact");
    redact.setAttribute("aria-hidden", "true");
    redact.appendChild(el("span", "redactline"));
    box.appendChild(redact);
    box.appendChild(el("p", "hint", it.burn ? t("burnHint") : t("secretExpiresHint")));
    if (state.askCode[id]) box.appendChild(codePrompt(it, id));
    return box;
  }

  // codePrompt is the field for a sealed slip. It only appears after the
  // person asks to open one, so the board stays quiet otherwise.
  function codePrompt(it: Item, id: string): HTMLElement {
    const wrap = el("div", "codeprompt");
    // The same group the composer uses, with the submit at the far end. A
    // filled segment is the only thing in the card that says "press me".
    const group = el("div", "codegroup");

    const input = document.createElement("input") as HTMLInputElement;
    input.type = state.revealShow[id] ? "text" : "password";
    input.className = "codeinput";
    input.value = state.codeDraft[id] || "";
    input.placeholder = t("codeAsk");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "characters");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", t("codeAsk"));
    input.addEventListener("input", function () {
      state.codeDraft[id] = input.value;
    });

    const go = btn(t("open"), function () {
      const code = (state.codeDraft[id] || "").replace(/^\s+|\s+$/g, "");
      if (code.length < 6) {
        state.codeErr[id] = t("codeTooShort");
        if (state.view === "board") renderBoard();
        return;
      }
      revealSecret(it, id, code);
    }, "gbtn is-primary");

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        go.click();
      }
    });

    const see = btn(state.revealShow[id] ? t("hide") : t("show"), function () {
      state.revealShow[id] = !state.revealShow[id];
      input.type = state.revealShow[id] ? "text" : "password";
      see.textContent = state.revealShow[id] ? t("hide") : t("show");
    }, "gbtn");

    group.appendChild(input);
    group.appendChild(see);
    group.appendChild(go);
    wrap.appendChild(group);
    if (state.codeErr[id]) wrap.appendChild(el("p", "codeerr", state.codeErr[id]));
    return wrap;
  }

  // openSecret is the press behind "Open". A sealed slip asks for its code
  // first; an unsealed one only hid its body from the list, so it can be
  // fetched straight away.
  function openSecret(it: Item, id: string): void {
    if (it.sealed) {
      state.askCode[id] = true;
      // renderBoard scrolls the field into view and puts the caret in it.
      if (state.view === "board") renderBoard();
      return;
    }
    revealSecret(it, id, "");
  }

  function revealSecret(it: Item, id: string, code: string): void {
    postJSON<RevealBody>("/api/items/" + id + "/reveal", { code: code }).then(
      function (body) {
        state.revealed[id] = body.text || "";
        delete state.askCode[id];
        delete state.codeDraft[id];
        delete state.codeErr[id];
        delete state.revealShow[id];
        if (body.burned) {
          // The reader has the body; the board keeps only the receipt, so
          // a refresh from now on finds a tombstone instead of a slip. The
          // local copy has to lose its ciphertext and burn flags too, or the
          // header would go on saying 密文 about a slip that no longer exists.
          it.takenAt = new Date().toISOString();
          it.sealed = false;
          it.burn = false;
        }
        if (state.view === "board") renderBoard();
        setTimeout(function () {
          if (!state.revealed[id]) return;
          delete state.revealed[id];
          if (state.view === "board") renderBoard();
        }, revealMillis);
      },
      function (err: any) {
        const code2 = (err && err.code) || "";
        if (code2 === "wrong_code") {
          state.codeErr[id] = t("wrongCode");
          if (state.view === "board") renderBoard();
          return;
        }
        if (code2 === "code_required") {
          state.askCode[id] = true;
          if (state.view === "board") renderBoard();
          return;
        }
        if (code2 === "gone") {
          delete state.revealed[id];
          showNotice(t("secretGone"));
          reloadItems();
          return;
        }
        if (!guard(err)) showErr(err);
      }
    );
  }

  // textBody renders a text slip. A slip longer than textFoldLines
  // lines starts folded and is opened with the toggle in the header;
  // a short one always shows in full and gets no toggle.
  function textBody(it: Item, id: string): HTMLElement {
    const body = el("pre", "body", it.text || "");
    if (countLines(it.text || "") <= textFoldLines) return body;
    if (state.editing === id) return body;
    const open = !!state.openText[id];
    if (!open) body.classList.add("folded");
    body.setAttribute("aria-expanded", open ? "true" : "false");
    return body;
  }

  // countLines counts rendered lines: newlines plus the wraps a long
  // unbroken run will take at roughly 40 characters per line.
  function countLines(text: string): number {
    const lines = text.split("\n");
    let n = 0;
    let i;
    for (i = 0; i < lines.length; i++) {
      const extra = Math.floor(lines[i].length / 40);
      n = n + 1 + extra;
    }
    return n;
  }

  // confirmButton asks twice for anything hard to take back. The first
  // click arms the button, the second click acts. Arming is forgotten on
  // the next render, so nothing stays armed for long.
  function confirmButton(label: string, confirmLabel: string, act: () => void, cls?: string): HTMLButtonElement {
    const b = btn(label, function () {
      if (b.dataset.armed === "1") {
        act();
        return;
      }
      b.dataset.armed = "1";
      b.textContent = confirmLabel;
      b.classList.add("danger");
      setTimeout(function () {
        if (!b.isConnected) return;
        b.dataset.armed = "";
        b.textContent = label;
        b.classList.remove("danger");
      }, 3000);
    });
    if (cls) b.className = cls;
    return b;
  }

  // previewBody renders the opened preview under the file name. The toggle
  // itself lives in the action row, where the other actions are.
  function previewBody(it: Item, id: string): HTMLElement | null {
    if (!state.openPreview[id]) return null;
    const wrap = el("div", "preview");
    if (state.previewText[id] === undefined) {
      wrap.appendChild(el("p", "hint", t("previewLoading")));
    } else if (state.previewText[id] === null) {
      wrap.appendChild(el("p", "hint", t("previewBinary")));
    } else if (isMarkdown(it.name, it.mime)) {
      const doc = el("div", "body previewbody md");
      doc.appendChild(renderMarkdown(state.previewText[id] as string));
      wrap.appendChild(doc);
    } else {
      wrap.appendChild(el("pre", "body previewbody", state.previewText[id] as string));
    }
    return wrap;
  }

  function loadPreview(it: Item, id: string): void {
    if (state.previewText[id] !== undefined) return;
    if (it.size && it.size > previewCap) {
      state.previewText[id] = null;
      return;
    }
    state.previewText[id] = undefined as any;
    page.previewText(it, function (text) {
      state.previewText[id] = text;
      if (state.view === "board") renderBoard();
    });
  }

  function fileLink(label: string, href: string): HTMLElement {
    const a = el("a", "textbtn", label) as HTMLAnchorElement;
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function copyButtonText(text: string, button: HTMLButtonElement): void {
    copyText(text).then(function (ok) {
      if (!ok) {
        say(t("copyFail"));
        return;
      }
      button.textContent = t("copied");
      say(t("copied"));
      setTimeout(function () {
        if (button.isConnected) button.textContent = t("copy");
      }, 1600);
    });
  }

  function copyButton(text: string): HTMLButtonElement {
    const b = btn(t("copy"), function () {
      copyButtonText(text, b);
    }, "textbtn");
    return b;
  }

  // ---- editing ------------------------------------------------------

  // textEditor replaces the body while a slip is being edited. Saving
  // sends PATCH; the slip keeps its place and its original time.
  function textEditor(it: Item, id: string): HTMLElement {
    const wrap = el("div", "editor");
    const ta = el("textarea", "editor-input") as HTMLTextAreaElement;
    ta.value = it.text || "";
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "off");
    ta.spellcheck = false;
    wrap.appendChild(ta);

    const err = el("p", "err", "");
    err.hidden = true;
    wrap.appendChild(err);

    const row = el("div", "row");
    const cancel = btn(t("cancel"), function () {
      state.editing = "";
      if (state.view === "board") renderBoard();
    }, "textbtn");
    const save = btn(t("save"), function () {
      const text = ta.value;
      if (!text.trim()) {
        err.hidden = false;
        err.textContent = t("emptyText");
        return;
      }
      if (byteLength(text) > textCap) {
        err.hidden = false;
        err.textContent = t("textTooBig");
        return;
      }
      save.disabled = true;
      save.textContent = t("sending");
      api<{ item: Item }>("/api/items/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      })
        .then(function (body) {
          state.editing = "";
          state.items = state.items.map(function (x) {
            return x.id === id ? body.item : x;
          });
          if (state.view === "board") renderBoard();
          say(t("saved"));
        })
        .catch(function (e) {
          if (guard(e)) return;
          save.disabled = false;
          save.textContent = t("save");
          err.hidden = false;
          err.textContent = errText(e);
        });
    }, "seal");
    row.appendChild(cancel);
    row.appendChild(save);
    wrap.appendChild(row);

    ta.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel.click();
      }
    });
    setTimeout(function () {
      ta.focus();
    }, 0);
    return wrap;
  }

  // ---- image viewer -------------------------------------------------

  // openViewer shows one picture at full size, with the neighbouring
  // pictures reachable by button and by arrow key.
  function openViewer(it: Item, id: string): void {
    state.viewer = { id: id, name: it.name || t("imageKind") };
    paintViewer();
  }

  function imageItems(): Item[] {
    return state.items.filter(function (x) {
      return x.kind === "image" && safeID(x.id) !== "";
    });
  }

  function viewerStep(step: number): void {
    const list = imageItems();
    if (!state.viewer || list.length < 2) return;
    let at = -1;
    let i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === state.viewer.id) at = i;
    }
    if (at === -1) return;
    const next = (at + step + list.length) % list.length;
    state.viewer = { id: list[next].id, name: list[next].name || t("imageKind") };
    paintViewer();
  }

  function closeViewer(): void {
    state.viewer = null;
    paintViewer();
  }

  // paintViewer keeps one overlay element in sync with state.viewer.
  function paintViewer(): void {
    let layer = document.getElementById("viewer");
    if (!state.viewer) {
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      return;
    }
    if (!layer) {
      layer = el("div", "viewer");
      layer.id = "viewer";
      layer.setAttribute("role", "dialog");
      layer.setAttribute("aria-modal", "true");
      layer.addEventListener("click", function (e) {
        if (e.target === layer) closeViewer();
      });
      document.body.appendChild(layer);
    }
    clear(layer);
    const id = state.viewer.id;
    const img = el("img", "viewer-img") as HTMLImageElement;
    img.alt = state.viewer.name;
    img.src = "/api/items/" + safeID(id) + "/raw";
    layer.appendChild(img);

    const bar = el("div", "viewer-bar");
    const many = imageItems().length > 1;
    if (many) {
      bar.appendChild(btn("<", function () { viewerStep(-1); }, "viewer-btn"));
    }
    bar.appendChild(el("span", "viewer-name", state.viewer.name));
    if (many) {
      bar.appendChild(btn(">", function () { viewerStep(1); }, "viewer-btn"));
    }
    // Copy puts the picture on the clipboard where the browser allows
    // it, so it can be pasted into a chat without saving the file.
    const copyB = btn(t("copy"), function () {
      copyImage(id, copyB);
    }, "viewer-btn");
    bar.appendChild(copyB);
    const dl = el("a", "viewer-btn", t("download")) as HTMLAnchorElement;
    dl.href = "/api/items/" + safeID(id) + "/raw?dl=1";
    bar.appendChild(dl);
    bar.appendChild(btn(t("close"), closeViewer, "viewer-btn"));
    layer.appendChild(bar);
  }

  // copyImage writes a picture to the clipboard as an image. Not every
  // browser allows it; a refusal falls back to copying the raw URL so
  // the button still does something useful.
  function copyImage(id: string, button: HTMLButtonElement): void {
    const url = "/api/items/" + id + "/raw";
    const label = button.textContent;
    fetch(url, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.blob();
      })
      .then(function (blob) {
        if (!navigator.clipboard || typeof (navigator.clipboard as any).write !== "function") {
          throw new Error("no clipboard.write");
        }
        return navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).then(function () {
          button.textContent = t("copied");
          say(t("copied"));
          setTimeout(function () {
            if (button.isConnected) button.textContent = label;
          }, 1600);
        });
      })
      .catch(function () {
        copyText(location.origin + url).then(function (ok) {
          say(ok ? t("copied") : t("copyFail"));
          button.textContent = ok ? t("copied") : label;
          setTimeout(function () {
            if (button.isConnected) button.textContent = label;
          }, 1600);
        });
      });
  }

  // ---- delete and undo ----------------------------------------------

  function removeItem(id: string): void {
    let secret = false;
    let i;
    for (i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id && state.items[i].secret) secret = true;
    }
    api("/api/items/" + id, { method: "DELETE" })
      .then(function () {
        state.items = state.items.filter(function (it) {
          return it.id !== id;
        });
        delete state.openPreview[id];
        delete state.openText[id];
        delete state.previewText[id];
        delete state.revealed[id];
        delete state.askCode[id];
        delete state.codeDraft[id];
        delete state.codeErr[id];
        delete state.revealShow[id];
        // A secret gets no undo: the bar promises the bytes are still there,
        // and that is the promise a secret must not make.
        if (secret) {
          say(t("secretRemoved"));
        } else {
          queueUndo([id]);
        }
        if (state.view === "board") renderBoard();
      })
      .catch(function (err) {
        if (!guard(err)) showErr(err);
      });
  }

  function queueUndo(ids: string[]): void {
    ids.forEach(function (id) {
      if (id && state.pending.indexOf(id) === -1) state.pending.push(id);
    });
    showUndo();
  }

  function showUndo(): void {
    clear(node.undo);
    node.undo.hidden = false;
    node.undo.appendChild(el("span", "", t("removedUndo")));
    node.undo.appendChild(btn(t("undo"), doUndo));
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(function () {
      state.pending = [];
      node.undo.hidden = true;
    }, undoMillis);
  }

  function doUndo(): void {
    const ids = state.pending.slice();
    state.pending = [];
    clearTimeout(state.undoTimer);
    node.undo.hidden = true;
    if (!ids.length) return;
    postJSON("/api/restore", { ids: ids })
      .then(function () {
        state.itemsLoaded = false;
        if (state.view === "board") renderBoard();
      })
      .catch(function (err) {
        if (!guard(err)) say(errText(err));
      });
  }

  // ---- settings -----------------------------------------------------

  function renderSettings(): void {
    clear(node.main);
    const boot = state.boot || ({} as Bootstrap);
    const share = el("section", "sheet");
    share.appendChild(el("p", "lead", t("share")));
    const img = el("img", "qr") as HTMLImageElement;
    img.alt = "";
    img.src = "/api/qr.svg";
    share.appendChild(img);
    const urls = boot.urls || [];
    if (!urls.length) {
      share.appendChild(el("p", "hint", t("noLan")));
    }
    urls.forEach(function (u) {
      const line = el("div", "urlrow");
      line.appendChild(el("div", "url", u));
      line.appendChild(copyButton(u));
      share.appendChild(line);
    });
    share.appendChild(el("p", "hint", t("usage") + " " + formatBytes(boot.used || 0) + " / " + formatBytes(boot.limit || 0)));
    node.main.appendChild(share);

    const form = el("form", "sheet") as HTMLFormElement;
    form.appendChild(el("p", "lead", t("changePass")));
    const fields = el("div", "fields");
    const cur = passwordField(t("currentPass"), "cur-pass", "current-password");
    const next = passwordField(t("newPass"), "new-pass", "new-password");
    const again = passwordField(t("passphraseAgain"), "new-again", "new-password");
    fields.appendChild(cur.wrap);
    fields.appendChild(next.wrap);
    fields.appendChild(again.wrap);
    form.appendChild(fields);
    const row = el("div", "row");
    const save = el("button", "seal", t("savePass")) as HTMLButtonElement;
    save.type = "submit";
    row.appendChild(save);
    form.appendChild(row);
    form.appendChild(errorLine());
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      state.confirmClear = false;
      if (next.input.value !== again.input.value) {
        showErr(codeErr("passphrase_mismatch"));
        return;
      }
      run(save, t("savePass"), function () {
        return postJSON("/api/passphrase", {
          current: cur.input.value,
          next: next.input.value,
          again: again.input.value
        }).then(function () {
          say(t("saved"));
          cur.input.value = "";
          next.input.value = "";
          again.input.value = "";
          if (state.errEl) state.errEl.hidden = true;
        });
      });
    });
    node.main.appendChild(form);

    // What a secret can and cannot do, in the one place a person goes to
    // read about the board. Saying it here keeps the composer quiet.
    const about = el("div", "sheet");
    about.appendChild(el("p", "hint", t("settingsSecret")));
    node.main.appendChild(about);

    const danger = el("div", "sheet");
    const actions = el("div", "row split");
    const clearBtn: HTMLButtonElement = btn(
      state.confirmClear ? t("confirmClear") : t("clear"),
      function () {
        if (!state.confirmClear) {
          state.confirmClear = true;
          clearBtn.textContent = t("confirmClear");
          clearBtn.className = "seal";
          return;
        }
        run(clearBtn, t("confirmClear"), function () {
          return api<{ ids: string[] }>("/api/clear", { method: "POST" }).then(function (body) {
            state.confirmClear = false;
            state.items = [];
            state.itemsLoaded = true;
            state.hasMore = false;
            state.openPreview = {};
            state.openText = {};
            state.previewText = {};
            state.revealed = {};
            state.askCode = {};
            state.codeDraft = {};
            state.codeErr = {};
            state.view = "board";
            // Secrets were destroyed outright, so the list may come back
            // empty: there is nothing for the undo bar to hold.
            const ids = body.ids || [];
            if (ids.length) queueUndo(ids);
            say(t("cleared"));
            route();
          });
        });
      },
      state.confirmClear ? "seal" : "textbtn"
    );
    actions.appendChild(clearBtn);
    actions.appendChild(
      btn(t("logoutAll"), function () {
        state.confirmClear = false;
        api("/api/logout-all", { method: "POST" })
          .then(function () {
            say(t("loggedOut"));
            loseAuth();
          })
          .catch(function (err) {
            if (!guard(err)) showErr(err);
          });
      }, "textbtn")
    );
    danger.appendChild(actions);
    node.main.appendChild(danger);
    node.main.appendChild(versionSheet(boot));
  }

  // versionSheet answers "am I current". The check runs only when the
  // button is pressed: this is the one request slip makes to the internet,
  // and a board that phoned home on every visit would be a different thing
  // from what this is.
  function versionSheet(boot: Bootstrap): HTMLElement {
    const sheet = el("div", "sheet");
    sheet.appendChild(el("p", "lead", t("version")));
    const row = el("div", "urlrow");
    row.appendChild(el("div", "url", boot.version || ""));
    const check = btn(t("checkUpdate"), function () {
      check.disabled = true;
      check.textContent = t("checking");
      api<UpdateBody>("/api/update")
        .then(function (body) {
          state.update = body;
          if (state.view === "settings") renderSettings();
        })
        .catch(function (err) {
          check.disabled = false;
          check.textContent = t("checkUpdate");
          if (!guard(err)) showErr(err);
        });
    }, "textbtn");
    row.appendChild(check);
    sheet.appendChild(row);

    const got = state.update;
    if (got) {
      if (got.error) {
        sheet.appendChild(el("p", "hint", t("updateFailed")));
      } else if (got.newer) {
        // A newer release is worth naming and linking, not just flagging:
        // the archive and its notes live on the release page.
        const line = el("p", "hint");
        line.appendChild(document.createTextNode(t("updateFound") + " " + (got.latest || " ") + " · "));
        line.appendChild(fileLink(t("releasePage"), got.url || ""));
        sheet.appendChild(line);
      } else {
        sheet.appendChild(el("p", "hint", t("updateLatest")));
      }
    }
    return sheet;
  }

  // closeMenus runs once. A More menu is a <details>, so it opens and
  // closes without JavaScript; this only closes it when the tap lands
  // somewhere else, which is what people expect from a menu.
  function closeMenus(): void {
    document.addEventListener("click", function (e) {
      const target = e.target as HTMLElement;
      const open = document.querySelectorAll("details.actmore[open]");
      let i;
      for (i = 0; i < open.length; i++) {
        const at = open[i] as HTMLElement;
        if (!at.contains(target)) at.removeAttribute("open");
      }
    });
  }

  // ---- boot ---------------------------------------------------------

  installDragHandlers();
  installKeys();
  startSecretClock();
  closeMenus();
  applyChrome();
  paintNav();
  api<Bootstrap>("/api/bootstrap")
    .then(function (boot) {
      state.boot = boot;
      route();
    })
    .catch(function (err) {
      clear(node.main);
      node.main.appendChild(el("p", "lead", errText(err)));
    });
}
