// board.ts is the controller. It owns the state machine, the network
// calls, and the DOM for both pages. The two pages differ only in the
// Page object handed to start(): what "say" does, whether View opens a
// tab, how a batch uploads, and whether text can be read in place.
//
// One controller means a fix lands once. Before this file existed the
// modern and legacy pages carried 650 lines of the same code.

import { api, postJSON, codeErr, errText } from "./api";
import { btn, clear, el } from "./dom";
import { t, lang } from "./i18n";
import { byteLength, formatBytes, formatTime, kindLabel, safeID, storeSet, themeNow } from "./format";
import { allFiles, classifyPaste, previewable } from "./clip";
import { copyText } from "./clipboard";
import { render as renderMarkdown, isMarkdown } from "./markdown";
import type { Bootstrap, Item, ItemsBody, Page, View } from "./types";

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
  openPreview: { [id: string]: boolean };
  editing: string;
  viewer: { id: string; name: string } | null;
  previewText: { [id: string]: string | null };
  errEl: HTMLElement | null;
}

const fileCap = 50 * 1024 * 1024;
const textCap = 200 * 1024;
// previewCap keeps a text attachment readable; larger ones get a link.
const previewCap = 256 * 1024;
const undoMillis = 8000;

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
    openPreview: {},
    editing: "",
    viewer: null,
    previewText: {},
    errEl: null
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
    if (!q) return state.items;
    return state.items.filter(function (it) {
      if (it.kind === "text" && it.text) return it.text.toLowerCase().indexOf(q) !== -1;
      if (it.name) return it.name.toLowerCase().indexOf(q) !== -1;
      return false;
    });
  }

  function renderBoard(): void {
    clear(node.main);
    node.main.appendChild(composer());
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
    const shown = visibleItems();
    if (!shown.length) {
      node.main.appendChild(el("p", "hint", t("searchEmpty")));
      return;
    }
    shown.forEach(function (it, i) {
      node.main.appendChild(slipNode(it, i === 0 && !state.query.trim()));
    });
    if (state.hasMore && !state.query.trim()) {
      node.main.appendChild(btn(t("loadMore"), loadMore, "textbtn more"));
    }
  }

  // searchBar is the only control that edits state.query. It re-renders on
  // input so the list narrows as you type, and it takes the caret back
  // afterwards because renderBoard rebuilds the whole board.
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
    input.addEventListener("input", function () {
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
    if (byteLength(text) > textCap) {
      showErr(codeErr("text_too_large"));
      return;
    }
    run(button, t("drop"), function () {
      return postJSON("/api/text", { text: text }).then(function () {
        state.draft = "";
        return reloadItems();
      });
    });
  }

  function sendFiles(files: File[], button: HTMLButtonElement): void {
    let i;
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
      if (state.view === "board") renderBoard();
    });
  }

  function loadMore(): void {
    if (state.loading || !state.items.length) return;
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

  function metaText(it: Item): string {
    const parts: string[] = [];
    const when = formatTime(it.createdAt);
    if (when) parts.push(when);
    parts.push(kindLabel(it.kind));
    if (it.size) parts.push(formatBytes(it.size));
    if (it.editedAt) parts.push(t("edited"));
    return parts.join(" · ");
  }

  // confirmButton asks twice for anything hard to take back. The first
  // click arms the button, the second click acts. Arming is forgotten on
  // the next render, so nothing stays armed for long.
  function confirmButton(label: string, confirmLabel: string, act: () => void): HTMLButtonElement {
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
    return b;
  }

  function slipNode(it: Item, newest: boolean): HTMLElement {
    const id = safeID(it.id);
    const card = el("article", newest ? "slip is-new" : "slip");
    const meta = el("div", "meta");
    meta.appendChild(el("span", "", metaText(it)));
    card.appendChild(meta);

    if (it.kind === "text" && state.editing === id) {
      card.appendChild(textEditor(it, id));
    } else if (it.kind === "text") {
      card.appendChild(el("pre", "body", it.text || ""));
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

    const row = el("div", "row");
    if (it.kind === "text") {
      const copy = btn(t("copy"), function () {
        copyButtonText(it.text || "", copy);
      }, "textbtn");
      row.appendChild(copy);
    }
    if (id && previewable(it)) {
      // The toggle sits with the other actions, not under the file name,
      // so every operation on a slip is in one place.
      const open = !!state.openPreview[id];
      row.appendChild(
        btn(open ? t("previewClose") : t("previewOpen"), function () {
          if (state.openPreview[id]) {
            delete state.openPreview[id];
          } else {
            state.openPreview[id] = true;
            loadPreview(it, id);
          }
          if (state.view === "board") renderBoard();
        }, "textbtn")
      );
    }
    if (it.kind === "text" && id && state.editing !== id) {
      row.appendChild(
        btn(t("edit"), function () {
          state.editing = id;
          if (state.view === "board") renderBoard();
        }, "textbtn")
      );
    }
    if (id && page.canPreview(it)) row.appendChild(fileLink(t("view"), "/api/items/" + id + "/raw"));
    if (id && it.kind !== "text") row.appendChild(fileLink(t("download"), "/api/items/" + id + "/raw?dl=1"));
    if (id) {
      row.appendChild(confirmButton(t("remove"), t("confirmRemove"), function () {
        removeItem(id);
      }));
    }
    card.appendChild(row);
    return card;
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
    const dl = el("a", "viewer-btn", t("download")) as HTMLAnchorElement;
    dl.href = "/api/items/" + safeID(id) + "/raw?dl=1";
    bar.appendChild(dl);
    bar.appendChild(btn(t("close"), closeViewer, "viewer-btn"));
    layer.appendChild(bar);
  }

  // ---- delete and undo ----------------------------------------------

  function removeItem(id: string): void {
    api("/api/items/" + id, { method: "DELETE" })
      .then(function () {
        state.items = state.items.filter(function (it) {
          return it.id !== id;
        });
        delete state.openPreview[id];
        delete state.previewText[id];
        queueUndo([id]);
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
            state.previewText = {};
            state.view = "board";
            queueUndo(body.ids || []);
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
    node.main.appendChild(el("p", "hint", t("version") + " " + (boot.version || "")));
  }

  // ---- boot ---------------------------------------------------------

  installDragHandlers();
  installKeys();
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
