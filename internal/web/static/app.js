(function () {
  "use strict";

  var Slip = window.Slip;
  var main = document.getElementById("main");
  var nav = document.getElementById("nav");
  var undoEl = document.getElementById("undo");
  var live = document.getElementById("live");
  var mark = document.getElementById("mark");
  var legacyLink = document.getElementById("legacy-link");
  var fileCap = 50 * 1024 * 1024;
  var textCap = 200 * 1024;

  var state = {
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
    errEl: null
  };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function say(text) {
    live.textContent = text || "";
  }

  function clear(node) {
    node.textContent = "";
  }

  function themeNow() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyChrome() {
    mark.textContent = Slip.t("mark");
    document.title = Slip.t("mark");
    document.documentElement.lang = Slip.lang() === "en" ? "en" : "zh-CN";
    legacyLink.textContent = Slip.t("legacy");
    var meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", themeNow() === "dark" ? "#1a1816" : "#f3efe6");
  }

  function setTheme(next) {
    Slip.storeSet("slip.theme", next);
    document.documentElement.setAttribute("data-theme", next);
    applyChrome();
    paintNav();
  }

  function setLang(next) {
    Slip.storeSet("slip.lang", next);
    document.documentElement.setAttribute("data-lang", next);
    applyChrome();
    route();
  }

  function btn(label, fn, cls) {
    var b = el("button", cls || "", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function paintNav() {
    clear(nav);
    if (state.view === "settings") {
      nav.appendChild(btn(Slip.t("back"), function () {
        state.confirmClear = false;
        state.view = "board";
        route();
      }));
    }
    if (state.view === "board") {
      nav.appendChild(btn(Slip.t("refresh"), refresh));
    }
    var theme = themeNow();
    nav.appendChild(btn(theme === "dark" ? Slip.t("themeLight") : Slip.t("themeDark"), function () {
      setTheme(theme === "dark" ? "light" : "dark");
    }));
    nav.appendChild(btn(Slip.lang() === "en" ? "中文" : "EN", function () {
      setLang(Slip.lang() === "en" ? "zh" : "en");
    }));
    if (state.view === "board") {
      nav.appendChild(btn(Slip.t("settings"), openSettings));
    }
  }

  function showErr(err) {
    var text = Slip.errText(err);
    if (state.errEl) {
      state.errEl.hidden = false;
      state.errEl.textContent = text;
    }
    say(text);
  }

  function loseAuth() {
    if (state.boot) state.boot.authed = false;
    state.view = "login";
    state.items = [];
    state.itemsLoaded = false;
    state.confirmClear = false;
    route();
  }

  function guard(err) {
    if (err && err.status === 401 && state.view !== "login" && state.view !== "setup") {
      loseAuth();
      return true;
    }
    return false;
  }

  function postJSON(path, obj) {
    return Slip.api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj)
    });
  }

  function codeErr(code) {
    var err = new Error(code);
    err.code = code;
    return err;
  }

  function decide() {
    var b = state.boot;
    if (!b.ready && b.loopback) return "setup";
    if (!b.ready) return "waiting";
    if (!b.authed) return "login";
    if (state.view === "settings") return "settings";
    return "board";
  }

  function route() {
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

  function passwordField(label, name, autocomplete) {
    var wrap = el("div");
    var id = "f-" + name;
    var lab = el("label", "", label);
    lab.htmlFor = id;
    var input = document.createElement("input");
    input.type = "password";
    input.id = id;
    input.name = name;
    input.autocomplete = autocomplete;
    input.autocapitalize = "off";
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function errorLine() {
    var p = el("p", "err", "");
    p.hidden = true;
    state.errEl = p;
    return p;
  }

  function renderSetup() {
    clear(main);
    var sheet = el("form", "sheet");
    sheet.appendChild(el("p", "lead", Slip.t("setupLead")));
    var fields = el("div", "fields");
    var a = passwordField(Slip.t("passphrase"), "setup-pass", "new-password");
    var b = passwordField(Slip.t("passphraseAgain"), "setup-again", "new-password");
    fields.appendChild(a.wrap);
    fields.appendChild(b.wrap);
    sheet.appendChild(fields);
    var row = el("div", "row");
    var go = el("button", "seal", Slip.t("start"));
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
      run(go, Slip.t("start"), function () {
        return postJSON("/api/setup", { passphrase: a.input.value, again: b.input.value }).then(enter);
      });
    });
    main.appendChild(sheet);
  }

  function renderWaiting() {
    clear(main);
    var sheet = el("div", "sheet");
    sheet.appendChild(el("p", "lead", Slip.t("waiting")));
    sheet.appendChild(btn(Slip.t("refresh"), refreshBoot, "seal"));
    main.appendChild(sheet);
  }

  function renderLogin() {
    clear(main);
    var sheet = el("form", "sheet");
    sheet.appendChild(el("p", "lead", Slip.t("loginLead")));
    var fields = el("div", "fields");
    var a = passwordField(Slip.t("passphrase"), "login-pass", "current-password");
    fields.appendChild(a.wrap);
    sheet.appendChild(fields);
    var row = el("div", "row");
    var go = el("button", "seal", Slip.t("unlock"));
    go.type = "submit";
    row.appendChild(go);
    sheet.appendChild(row);
    sheet.appendChild(errorLine());
    sheet.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      run(go, Slip.t("unlock"), function () {
        return postJSON("/api/login", { passphrase: a.input.value }).then(enter);
      });
    });
    main.appendChild(sheet);
    a.input.focus();
  }

  function run(button, label, work) {
    state.busy = true;
    button.disabled = true;
    button.textContent = Slip.t("sending");
    return work().then(function () {
      state.busy = false;
    }, function (err) {
      state.busy = false;
      button.disabled = false;
      button.textContent = label;
      if (!guard(err)) showErr(err);
    });
  }

  function enter() {
    return Slip.api("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      state.itemsLoaded = false;
      state.items = [];
      state.view = boot.authed ? "board" : "login";
      route();
    });
  }

  function refreshBoot() {
    Slip.api("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      if (boot.authed) state.view = "board";
      route();
    }).catch(function (err) {
      say(Slip.errText(err));
    });
  }

  function refresh() {
    Slip.api("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      if (!boot.ready || !boot.authed) {
        state.itemsLoaded = false;
        route();
        return;
      }
      state.view = "board";
      state.itemsLoaded = false;
      route();
    }).catch(function (err) {
      if (!guard(err)) say(Slip.errText(err));
    });
  }

  function openSettings() {
    Slip.api("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      if (!boot.authed) {
        loseAuth();
        return;
      }
      state.confirmClear = false;
      state.view = "settings";
      route();
    }).catch(function (err) {
      if (!guard(err)) say(Slip.errText(err));
    });
  }

  function renderBoard() {
    clear(main);
    main.appendChild(composer());
    if (!state.itemsLoaded) {
      main.appendChild(el("div", "skel"));
      if (!state.loading) loadFirst();
      return;
    }
    if (!state.items.length) {
      main.appendChild(el("p", "hint", Slip.t("empty")));
      shareHint();
    }
    state.items.forEach(function (it, i) {
      main.appendChild(slipNode(it, i === 0));
    });
    if (state.hasMore) {
      var more = btn(Slip.t("loadMore"), loadMore, "textbtn more");
      main.appendChild(more);
    }
  }

  function shareHint() {
    var urls = (state.boot && state.boot.urls) || [];
    if (!urls.length) {
      if (state.boot && state.boot.loopback) main.appendChild(el("p", "hint", Slip.t("noLan")));
      return;
    }
    var row = el("div", "urlrow");
    row.appendChild(el("div", "", Slip.t("share")));
    main.appendChild(row);
    var line = el("div", "urlrow");
    line.appendChild(el("div", "url", urls[0]));
    line.appendChild(copyButton(urls[0]));
    main.appendChild(line);
  }

  function composer() {
    var form = el("form", "sheet composer");
    var lab = el("label", "", Slip.t("writeLabel"));
    var ta = document.createElement("textarea");
    ta.id = "write";
    lab.htmlFor = "write";
    ta.value = state.draft;
    ta.placeholder = Slip.t("writeHint");
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
      var files = imageFiles(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      sendFiles(files, go);
    });
    var row = el("div", "row");
    var pick = btn(Slip.t("addFile"), function () {
      file.click();
    }, "textbtn");
    var go = el("button", "seal", Slip.t("drop"));
    go.type = "submit";
    var file = document.createElement("input");
    file.type = "file";
    file.className = "clip";
    file.multiple = true;
    file.tabIndex = -1;
    file.setAttribute("aria-hidden", "true");
    file.addEventListener("change", function () {
      if (file.files && file.files.length) sendFiles(file.files, go);
      file.value = "";
    });
    row.appendChild(pick);
    row.appendChild(go);
    form.appendChild(lab);
    form.appendChild(ta);
    form.appendChild(row);
    form.appendChild(file);
    var err = errorLine();
    form.appendChild(err);
    var depth = 0;
    form.addEventListener("dragenter", function (e) {
      e.preventDefault();
      depth += 1;
      form.classList.add("is-over");
    });
    form.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    form.addEventListener("dragleave", function () {
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        form.classList.remove("is-over");
      }
    });
    form.addEventListener("drop", function (e) {
      e.preventDefault();
      depth = 0;
      form.classList.remove("is-over");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        sendFiles(e.dataTransfer.files, go);
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitText(ta, go);
    });
    return form;
  }

  function submitText(ta, button) {
    var text = ta.value;
    if (!text.trim()) {
      showErr(codeErr("empty"));
      return;
    }
    if (Slip.byteLength(text) > textCap) {
      showErr(codeErr("text_too_large"));
      return;
    }
    run(button, Slip.t("drop"), function () {
      return postJSON("/api/text", { text: text }).then(function () {
        state.draft = "";
        return reloadItems();
      });
    });
  }

  function imageFiles(cd) {
    var out = [];
    if (!cd) return out;
    var i;
    if (cd.files && cd.files.length) {
      for (i = 0; i < cd.files.length; i++) {
        if (cd.files[i].type.indexOf("image/") === 0) out.push(cd.files[i]);
      }
    }
    if (out.length || !cd.items) return out;
    for (i = 0; i < cd.items.length; i++) {
      var item = cd.items[i];
      if (item.kind === "file" && item.type.indexOf("image/") === 0) {
        var f = item.getAsFile();
        if (f) out.push(f);
      }
    }
    return out;
  }

  function sendFiles(list, button) {
    var files = [];
    var i;
    for (i = 0; i < list.length; i++) files.push(list[i]);
    for (i = 0; i < files.length; i++) {
      if (files[i].size > fileCap) {
        showErr(codeErr("too_large"));
        return;
      }
    }
    if (!files.length) {
      showErr(codeErr("empty"));
      return;
    }
    run(button, Slip.t("drop"), function () {
      var chain = Promise.resolve();
      for (i = 0; i < files.length; i += 8) {
        (function (batch) {
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

  function uploadBatch(files) {
    var fd = new FormData();
    files.forEach(function (f) {
      fd.append("file", f, f.name);
    });
    return Slip.api("/api/files", { method: "POST", body: fd });
  }

  function loadFirst() {
    state.loading = true;
    Slip.api("/api/items?limit=40").then(function (body) {
      state.loading = false;
      state.itemsLoaded = true;
      state.items = body.items || [];
      state.hasMore = !!body.hasMore;
      if (state.view === "board") renderBoard();
    }).catch(function (err) {
      state.loading = false;
      state.itemsLoaded = true;
      if (guard(err)) return;
      if (state.view === "board") renderBoard();
      showErr(err);
    });
  }

  function reloadItems() {
    return Slip.api("/api/items?limit=40").then(function (body) {
      state.itemsLoaded = true;
      state.items = body.items || [];
      state.hasMore = !!body.hasMore;
      if (state.view === "board") renderBoard();
    });
  }

  function loadMore() {
    if (state.loading || !state.items.length) return;
    state.loading = true;
    var last = state.items[state.items.length - 1].id;
    Slip.api("/api/items?limit=40&before=" + encodeURIComponent(last)).then(function (body) {
      state.loading = false;
      state.items = state.items.concat(body.items || []);
      state.hasMore = !!body.hasMore;
      if (state.view === "board") renderBoard();
    }).catch(function (err) {
      state.loading = false;
      if (!guard(err)) showErr(err);
    });
  }

  function safeID(id) {
    return /^[0-9a-fA-F]{16}$/.test(id) ? id : "";
  }

  function canView(it) {
    var m = String(it.mime || "").toLowerCase();
    return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp" || m === "application/pdf";
  }

  function kindLabel(kind) {
    if (kind === "image") return Slip.t("imageKind");
    if (kind === "file") return Slip.t("fileKind");
    return Slip.t("textKind");
  }

  function metaText(it) {
    var parts = [];
    var when = Slip.formatTime(it.createdAt);
    if (when) parts.push(when);
    parts.push(kindLabel(it.kind));
    if (it.size) parts.push(Slip.formatBytes(it.size));
    return parts.join(" · ");
  }

  function slipNode(it, newest) {
    var id = safeID(it.id);
    var card = el("article", newest ? "slip is-new" : "slip");
    var meta = el("div", "meta");
    meta.appendChild(el("span", "", metaText(it)));
    card.appendChild(meta);
    if (it.kind === "text") {
      card.appendChild(el("pre", "body", it.text || ""));
    } else if (it.kind === "image" && it.hasThumb && id) {
      var img = document.createElement("img");
      img.className = "shot";
      img.alt = it.name || Slip.t("imageKind");
      img.src = "/api/items/" + id + "/thumb";
      card.appendChild(img);
    } else {
      card.appendChild(el("p", "fname", it.name || Slip.t("fileKind")));
    }
    var row = el("div", "row");
    if (it.kind === "text") {
      var copy = btn(Slip.t("copy"), function () {
        Slip.copyText(it.text || "").then(function (ok) {
          if (!ok) {
            say(Slip.t("copyFail"));
            return;
          }
          copy.textContent = Slip.t("copied");
          say(Slip.t("copied"));
          setTimeout(function () {
            if (copy.isConnected) copy.textContent = Slip.t("copy");
          }, 1600);
        });
      }, "textbtn");
      row.appendChild(copy);
    }
    if (id && canView(it)) row.appendChild(fileLink(Slip.t("view"), "/api/items/" + id + "/raw"));
    if (id && it.kind !== "text") row.appendChild(fileLink(Slip.t("download"), "/api/items/" + id + "/raw?dl=1"));
    if (id) row.appendChild(btn(Slip.t("remove"), function () { removeItem(id); }, "textbtn"));
    card.appendChild(row);
    return card;
  }

  function fileLink(label, href) {
    var a = el("a", "textbtn", label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function removeItem(id) {
    Slip.api("/api/items/" + id, { method: "DELETE" }).then(function () {
      state.items = state.items.filter(function (it) { return it.id !== id; });
      queueUndo([id]);
      if (state.view === "board") renderBoard();
    }).catch(function (err) {
      if (!guard(err)) showErr(err);
    });
  }

  function queueUndo(ids) {
    ids.forEach(function (id) {
      if (id && state.pending.indexOf(id) === -1) state.pending.push(id);
    });
    showUndo();
  }

  function showUndo() {
    clear(undoEl);
    undoEl.hidden = false;
    undoEl.appendChild(el("span", "", Slip.t("removed")));
    undoEl.appendChild(btn(Slip.t("undo"), doUndo));
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(function () {
      state.pending = [];
      undoEl.hidden = true;
    }, 8000);
  }

  function doUndo() {
    var ids = state.pending.slice();
    state.pending = [];
    clearTimeout(state.undoTimer);
    undoEl.hidden = true;
    if (!ids.length) return;
    postJSON("/api/restore", { ids: ids }).then(function () {
      state.itemsLoaded = false;
      if (state.view === "board") renderBoard();
    }).catch(function (err) {
      if (!guard(err)) say(Slip.errText(err));
    });
  }

  function copyButton(text) {
    var b = btn(Slip.t("copy"), function () {
      Slip.copyText(text).then(function (ok) {
        if (!ok) {
          say(Slip.t("copyFail"));
          return;
        }
        b.textContent = Slip.t("copied");
        say(Slip.t("copied"));
        setTimeout(function () {
          if (b.isConnected) b.textContent = Slip.t("copy");
        }, 1600);
      });
    }, "textbtn");
    return b;
  }

  function renderSettings() {
    clear(main);
    var boot = state.boot || {};
    var share = el("section", "sheet");
    share.appendChild(el("p", "lead", Slip.t("share")));
    var img = document.createElement("img");
    img.className = "qr";
    img.alt = "";
    img.src = "/api/qr.svg";
    share.appendChild(img);
    var urls = boot.urls || [];
    if (!urls.length) {
      share.appendChild(el("p", "hint", Slip.t("noLan")));
    }
    urls.forEach(function (u) {
      var line = el("div", "urlrow");
      line.appendChild(el("div", "url", u));
      line.appendChild(copyButton(u));
      share.appendChild(line);
    });
    share.appendChild(el("p", "hint", Slip.t("usage") + " " + Slip.formatBytes(boot.used) + " / " + Slip.formatBytes(boot.limit)));
    main.appendChild(share);

    var form = el("form", "sheet");
    form.appendChild(el("p", "lead", Slip.t("changePass")));
    var fields = el("div", "fields");
    var cur = passwordField(Slip.t("currentPass"), "cur-pass", "current-password");
    var next = passwordField(Slip.t("newPass"), "new-pass", "new-password");
    var again = passwordField(Slip.t("passphraseAgain"), "new-again", "new-password");
    fields.appendChild(cur.wrap);
    fields.appendChild(next.wrap);
    fields.appendChild(again.wrap);
    form.appendChild(fields);
    var row = el("div", "row");
    var save = el("button", "seal", Slip.t("savePass"));
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
      run(save, Slip.t("savePass"), function () {
        return postJSON("/api/passphrase", {
          current: cur.input.value,
          next: next.input.value,
          again: again.input.value
        }).then(function () {
          say(Slip.t("saved"));
          cur.input.value = "";
          next.input.value = "";
          again.input.value = "";
          if (state.errEl) state.errEl.hidden = true;
        });
      });
    });
    main.appendChild(form);

    var danger = el("div", "sheet");
    var actions = el("div", "row split");
    var clearBtn = btn(state.confirmClear ? Slip.t("confirmClear") : Slip.t("clear"), function () {
      if (!state.confirmClear) {
        state.confirmClear = true;
        clearBtn.textContent = Slip.t("confirmClear");
        clearBtn.className = "seal";
        return;
      }
      run(clearBtn, Slip.t("confirmClear"), function () {
        return Slip.api("/api/clear", { method: "POST" }).then(function (body) {
          state.confirmClear = false;
          state.items = [];
          state.itemsLoaded = true;
          state.hasMore = false;
          state.view = "board";
          queueUndo(body.ids || []);
          say(Slip.t("cleared"));
          route();
        });
      });
    }, state.confirmClear ? "seal" : "textbtn");
    actions.appendChild(clearBtn);
    actions.appendChild(btn(Slip.t("logoutAll"), function () {
      state.confirmClear = false;
      Slip.api("/api/logout-all", { method: "POST" }).then(function () {
        say(Slip.t("loggedOut"));
        loseAuth();
      }).catch(function (err) {
        if (!guard(err)) showErr(err);
      });
    }, "textbtn"));
    danger.appendChild(actions);
    main.appendChild(danger);
    main.appendChild(el("p", "hint", Slip.t("version") + " " + (boot.version || "")));
  }

  function start() {
    applyChrome();
    paintNav();
    Slip.api("/api/bootstrap").then(function (boot) {
      state.boot = boot;
      route();
    }).catch(function (err) {
      clear(main);
      main.appendChild(el("p", "lead", Slip.errText(err)));
    });
  }

  start();
})();
