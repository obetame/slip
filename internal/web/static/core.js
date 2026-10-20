(function() {
  // ../.webuild/i18n.js
  var STR = {
    zh: {
      mark: "纸条",
      refresh: "刷新",
      themeDark: "深色",
      themeLight: "浅色",
      settings: "设置",
      back: "返回",
      writeLabel: "写下来",
      writeHint: "地址、备注、一段文字",
      drop: "放下",
      addFile: "添加文件",
      copy: "复制",
      copied: "已复制",
      view: "查看",
      download: "下载",
      remove: "删除",
      empty: "放下的内容会出现在这里。",
      loginLead: "输入家里口令。",
      passphrase: "家里口令",
      unlock: "进入",
      wrong: "口令不对。",
      locked: "试得太多，请过一会儿再试。",
      setupLead: "设一个家里口令。其它设备第一次打开时要输入它。",
      passphraseAgain: "再输入一次",
      mismatch: "两次输入不一样。",
      tooShort: "至少 6 位。",
      tooLong: "太长了。",
      start: "开始使用",
      waiting: "请先在运行纸条的那台 Mac 上打开这个页面，设置口令。",
      share: "在其它设备的浏览器里打开",
      usage: "已用",
      changePass: "更改口令",
      currentPass: "现在的口令",
      newPass: "新口令",
      savePass: "保存口令",
      clear: "清空",
      confirmClear: "确认清空",
      cleared: "已经清空。",
      logoutAll: "退出所有设备",
      loggedOut: "所有设备都要重新输入口令。",
      legacy: "兼容页面",
      modern: "完整页面",
      undo: "撤销",
      removed: "已删除",
      loadMore: "更早的",
      errorNet: "连不上。确认这台设备和 Mac 在同一个 Wi-Fi。",
      errorGeneric: "没有完成。",
      sending: "正在放下",
      tooBig: "单个文件最大 50 MB。",
      textTooBig: "这段文字太长了。",
      quota: "这台 Mac 上的纸条空间已满。",
      copyFail: "没有复制成功。可以长按文字手动复制。",
      today: "今天",
      yesterday: "昨天",
      textKind: "文字",
      imageKind: "图片",
      fileKind: "文件",
      chosen: "已选择",
      noLan: "没有发现局域网地址。其它设备可能连不上。",
      saved: "口令已更新。",
      emptyText: "内容是空的。",
      forbidden: "只能在这台 Mac 上完成设置。",
      already: "口令已经设置过了。",
      legacyNote: "这个页面给 iPad mini 2 和 iOS 12 使用。点「查看」打开图片后，长按可以存到相册。",
      version: "版本",
      dragHint: "松手放下",
      searchPlaceholder: "找一找",
      searchEmpty: "没有找到。",
      clearSearch: "清除",
      previewOpen: "展开",
      previewClose: "收起",
      previewLoading: "正在读取",
      previewTooBig: "文件太大，不能在这里展开。",
      previewFailed: "读不出来，请下载。",
      previewBinary: "这种文件不能预览。"
    },
    en: {
      mark: "Slip",
      refresh: "Refresh",
      themeDark: "Dark",
      themeLight: "Light",
      settings: "Settings",
      back: "Back",
      writeLabel: "Write",
      writeHint: "An address, a note, a paragraph",
      drop: "Put down",
      addFile: "Add file",
      copy: "Copy",
      copied: "Copied",
      view: "View",
      download: "Download",
      remove: "Delete",
      empty: "What you put down will show up here.",
      loginLead: "Enter the household passphrase.",
      passphrase: "Household passphrase",
      unlock: "Continue",
      wrong: "That passphrase is not right.",
      locked: "Too many tries. Wait a moment and try again.",
      setupLead: "Choose a household passphrase. Other devices enter it once.",
      passphraseAgain: "Type it again",
      mismatch: "Those do not match.",
      tooShort: "Use at least 6 characters.",
      tooLong: "That passphrase is too long.",
      start: "Start",
      waiting: "Open this page on the Mac running Slip and set a passphrase first.",
      share: "Open this on another device",
      usage: "Used",
      changePass: "Change passphrase",
      currentPass: "Current passphrase",
      newPass: "New passphrase",
      savePass: "Save passphrase",
      clear: "Clear all",
      confirmClear: "Confirm clear",
      cleared: "Cleared.",
      logoutAll: "Sign out everywhere",
      loggedOut: "Every device must enter the passphrase again.",
      legacy: "Compatible page",
      modern: "Full page",
      undo: "Undo",
      removed: "Deleted",
      loadMore: "Older",
      errorNet: "Cannot connect. Check that this device and the Mac are on the same Wi-Fi.",
      errorGeneric: "That did not work.",
      sending: "Putting down",
      tooBig: "Each file can be up to 50 MB.",
      textTooBig: "That text is too long.",
      quota: "Slip has filled the space set aside on this Mac.",
      copyFail: "Copy did not work. Select the text and copy it yourself.",
      today: "Today",
      yesterday: "Yesterday",
      textKind: "Text",
      imageKind: "Image",
      fileKind: "File",
      chosen: "Selected",
      noLan: "No LAN address found. Other devices may not be able to connect.",
      saved: "Passphrase updated.",
      emptyText: "Nothing to put down.",
      forbidden: "Setup can only be finished on this Mac.",
      already: "A passphrase is already set.",
      legacyNote: "This page is for iPad mini 2 and iOS 12. After you view a picture, press and hold it to save it to Photos.",
      version: "Version",
      dragHint: "Drop to put down",
      searchPlaceholder: "Find a slip",
      searchEmpty: "Nothing matched.",
      clearSearch: "Clear",
      previewOpen: "Open",
      previewClose: "Close",
      previewLoading: "Reading",
      previewTooBig: "Too large to open here.",
      previewFailed: "Could not read it. Try Download.",
      previewBinary: "This file cannot be previewed."
    }
  };
  function lang() {
    return document.documentElement.getAttribute("data-lang") === "en" ? "en" : "zh";
  }
  function t(key) {
    var table = STR[lang()] || STR.zh;
    if (table[key])
      return table[key];
    if (STR.zh[key])
      return STR.zh[key];
    return key;
  }

  // ../.webuild/api.js
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["X-Slip"] = "1";
    opts.headers = headers;
    opts.credentials = "same-origin";
    return fetch(path, opts).then(function(res) {
      var ct = res.headers.get("Content-Type") || "";
      if (ct.indexOf("json") !== -1) {
        return res.json().then(function(body) {
          if (!res.ok) {
            var err2 = new Error(body && body.error || "bad_request");
            err2.code = body && body.error;
            err2.status = res.status;
            throw err2;
          }
          return body;
        });
      }
      if (!res.ok) {
        var err = new Error("bad_request");
        err.code = "bad_request";
        err.status = res.status;
        throw err;
      }
      return null;
    });
  }
  function postJSON(path, obj) {
    return api(path, {
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
  function errText(err) {
    if (!err || !err.code)
      return t("errorNet");
    var map = {
      passphrase_too_short: "tooShort",
      passphrase_too_long: "tooLong",
      passphrase_mismatch: "mismatch",
      wrong_passphrase: "wrong",
      locked: "locked",
      too_large: "tooBig",
      text_too_large: "textTooBig",
      quota: "quota",
      empty: "emptyText",
      unauthorized: "wrong",
      setup_required: "waiting",
      already_setup: "already",
      forbidden: "forbidden",
      gone: "errorGeneric",
      not_found: "errorGeneric",
      bad_request: "errorGeneric"
    };
    var key = err.code ? map[err.code] : "";
    if (key)
      return t(key);
    return t("errorGeneric");
  }

  // ../.webuild/dom.js
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls)
      node.className = cls;
    if (text != null)
      node.textContent = text;
    return node;
  }
  function btn(label, fn, cls) {
    var b = document.createElement("button");
    if (cls)
      b.className = cls;
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", function() {
      fn();
    });
    return b;
  }
  function clear(node) {
    node.textContent = "";
  }

  // ../.webuild/format.js
  function storeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
    }
  }
  function themeNow() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function byteLength(s) {
    var n = 0;
    var i;
    for (i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128)
        n = n + 1;
      else if (c < 2048)
        n = n + 2;
      else if (c >= 55296 && c <= 56319) {
        n = n + 4;
        i = i + 1;
      } else
        n = n + 3;
    }
    return n;
  }
  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024)
      return n + " B";
    var units = ["KB", "MB", "GB"];
    var i = -1;
    do {
      n = n / 1024;
      i = i + 1;
    } while (n >= 1024 && i < units.length - 1);
    var rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded + " " + units[i];
  }
  function two(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function formatTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime()))
      return "";
    var now = /* @__PURE__ */ new Date();
    var hm = two(d.getHours()) + ":" + two(d.getMinutes());
    if (d.toDateString() === now.toDateString())
      return t("today") + " " + hm;
    var yest = new Date(now.getTime());
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString())
      return t("yesterday") + " " + hm;
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + hm;
  }
  function safeID(id) {
    return /^[0-9a-fA-F]{16}$/.test(id) ? id : "";
  }
  function kindLabel(kind) {
    if (kind === "image")
      return t("imageKind");
    if (kind === "file")
      return t("fileKind");
    return t("textKind");
  }

  // ../.webuild/clipboard.js
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.className = "copy-buffer";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      ta.setSelectionRange(0, ta.value.length);
    } catch (e) {
    }
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e2) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    return new Promise(function(resolve) {
      var nav = navigator;
      if (nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text).then(function() {
          resolve(true);
        }, function() {
          resolve(legacyCopy(text));
        });
        return;
      }
      resolve(legacyCopy(text));
    });
  }

  // ../.webuild/clip.js
  function isURL(text) {
    var s = text.trim();
    if (!s || s.indexOf(" ") !== -1 || s.indexOf("\n") !== -1)
      return false;
    return /^https?:\/\/\S+$/i.test(s) || /^www\.\S+\.\S+$/i.test(s);
  }
  function looksLikeFile(text, cap) {
    return text.length > 0 && utf8Length(text) > cap;
  }
  function utf8Length(s) {
    var n = 0;
    var i;
    for (i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128)
        n = n + 1;
      else if (c < 2048)
        n = n + 2;
      else if (c >= 55296 && c <= 56319) {
        n = n + 4;
        i = i + 1;
      } else
        n = n + 3;
    }
    return n;
  }
  function stripURL(text) {
    var s = text.trim();
    if (/^www\./i.test(s))
      return "http://" + s;
    return s;
  }
  function allFiles(cd) {
    var out = [];
    if (!cd)
      return out;
    var i;
    if (cd.files && cd.files.length) {
      for (i = 0; i < cd.files.length; i++)
        out.push(cd.files[i]);
    }
    if (out.length || !cd.items)
      return out;
    for (i = 0; i < cd.items.length; i++) {
      var item = cd.items[i];
      if (item.kind === "file") {
        var f = item.getAsFile();
        if (f)
          out.push(f);
      }
    }
    return out;
  }
  function classifyPaste(cd, textCap2) {
    var text = cd ? cd.getData("text/plain") || "" : "";
    var files = cd ? allFiles(cd) : [];
    if (files.length) {
      var onlyImages = true;
      var i = void 0;
      for (i = 0; i < files.length; i++) {
        if (files[i].type.indexOf("image/") !== 0)
          onlyImages = false;
      }
      return { kind: onlyImages ? "image" : "files", text: text, files: files };
    }
    var trimmed = text.trim();
    if (!trimmed)
      return { kind: "none", text: "", files: [] };
    if (isURL(trimmed))
      return { kind: "url", text: stripURL(trimmed), files: [] };
    if (looksLikeFile(text, textCap2))
      return { kind: "files", text: text, files: [] };
    return { kind: "text", text: text, files: [] };
  }
  function previewable(item) {
    var mime = String(item.mime || "").toLowerCase();
    if (!mime || mime.indexOf("text/") === 0) {
      var name_1 = String(item.name || "").toLowerCase();
      var dot = name_1.lastIndexOf(".");
      var ext = dot === -1 ? "" : name_1.slice(dot);
      switch (ext) {
        case ".html":
        case ".htm":
        case ".svg":
        case ".xml":
        case ".xhtml":
          return false;
      }
      if (mime && mime.indexOf("text/html") === 0)
        return false;
      if (mime && mime.indexOf("text/xml") === 0)
        return false;
      if (mime && mime.indexOf("application/xml") === 0)
        return false;
      return true;
    }
    return mime === "application/json" || mime === "application/javascript" || mime === "application/x-yaml" || mime === "application/toml";
  }

  // ../.webuild/board.js
  var fileCap = 50 * 1024 * 1024;
  var textCap = 200 * 1024;
  var previewCap = 256 * 1024;
  var undoMillis = 8e3;
  function start(page, node) {
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
      query: "",
      openPreview: {},
      previewText: {},
      errEl: null
    };
    var formEl = null;
    var writeEl = null;
    var dropBtn = null;
    var dragDepth = 0;
    function setOver(on) {
      if (formEl)
        formEl.className = on ? "sheet composer is-over" : "sheet composer";
      page.setDragging(on);
    }
    function installDragHandlers() {
      document.addEventListener("dragenter", function(e) {
        if (!hasFiles(e))
          return;
        e.preventDefault();
        dragDepth += 1;
        setOver(true);
      });
      document.addEventListener("dragover", function(e) {
        if (!hasFiles(e))
          return;
        e.preventDefault();
      });
      document.addEventListener("dragleave", function() {
        dragDepth -= 1;
        if (dragDepth <= 0) {
          dragDepth = 0;
          setOver(false);
        }
      });
      document.addEventListener("drop", function(e) {
        if (!hasFiles(e))
          return;
        e.preventDefault();
        dragDepth = 0;
        setOver(false);
        if (!dropBtn)
          return;
        var kind = classifyPaste(e.dataTransfer, textCap);
        if (kind.files.length) {
          sendFiles(kind.files, dropBtn);
          return;
        }
        if (kind.kind === "url" || kind.kind === "text") {
          if (writeEl)
            dropText(writeEl, kind.text);
          return;
        }
        sendFiles(allFiles(e.dataTransfer), dropBtn);
      });
    }
    function say(text) {
      page.say(text || "");
    }
    function applyChrome() {
      node.mark.textContent = t("mark");
      document.title = t("mark");
      document.documentElement.lang = lang() === "en" ? "en" : "zh-CN";
      node.switchLink.textContent = node.switchLabel(state);
      var meta = document.getElementById("theme-color");
      if (meta)
        meta.setAttribute("content", themeNow() === "dark" ? "#1a1816" : "#f3efe6");
    }
    function setTheme(next) {
      storeSet("slip.theme", next);
      document.documentElement.setAttribute("data-theme", next);
      applyChrome();
      paintNav();
    }
    function setLang(next) {
      storeSet("slip.lang", next);
      document.documentElement.setAttribute("data-lang", next);
      applyChrome();
      route();
    }
    function paintNav() {
      clear(node.nav);
      if (state.view === "settings") {
        node.nav.appendChild(btn(t("back"), function() {
          state.confirmClear = false;
          state.view = "board";
          route();
        }));
      }
      if (state.view === "board") {
        node.nav.appendChild(btn(t("refresh"), refresh));
      }
      var theme = themeNow();
      node.nav.appendChild(btn(theme === "dark" ? t("themeLight") : t("themeDark"), function() {
        setTheme(theme === "dark" ? "light" : "dark");
      }));
      node.nav.appendChild(btn(lang() === "en" ? "中文" : "EN", function() {
        setLang(lang() === "en" ? "zh" : "en");
      }));
      if (state.view === "board") {
        node.nav.appendChild(btn(t("settings"), openSettings));
      }
    }
    function showErr(err) {
      var text = errText(err);
      if (state.errEl) {
        state.errEl.hidden = false;
        state.errEl.textContent = text;
      }
      say(text);
    }
    function loseAuth() {
      if (state.boot)
        state.boot.authed = false;
      state.view = "login";
      state.items = [];
      state.itemsLoaded = false;
      state.openPreview = {};
      state.previewText = {};
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
    function decide() {
      var b = state.boot;
      if (!b)
        return "loading";
      if (!b.ready && b.loopback)
        return "setup";
      if (!b.ready)
        return "waiting";
      if (!b.authed)
        return "login";
      if (state.view === "settings")
        return "settings";
      return "board";
    }
    function route() {
      if (!state.boot)
        return;
      state.view = decide();
      applyChrome();
      paintNav();
      state.errEl = null;
      if (state.view === "setup")
        renderSetup();
      else if (state.view === "waiting")
        renderWaiting();
      else if (state.view === "login")
        renderLogin();
      else if (state.view === "settings")
        renderSettings();
      else
        renderBoard();
    }
    function passwordField(label, name, autocomplete) {
      var wrap = el("div");
      var id = "f-" + name;
      var lab = el("label", "", label);
      lab.htmlFor = id;
      var input = el("input");
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
    function errorLine() {
      var p = el("p", "err", "");
      p.hidden = true;
      state.errEl = p;
      return p;
    }
    function run(button, label, work) {
      state.busy = true;
      button.disabled = true;
      button.textContent = t("sending");
      return work().then(function() {
        state.busy = false;
      }, function(err) {
        state.busy = false;
        button.disabled = false;
        button.textContent = label;
        if (!guard(err))
          showErr(err);
      });
    }
    function enter() {
      return api("/api/bootstrap").then(function(boot) {
        state.boot = boot;
        state.itemsLoaded = false;
        state.items = [];
        state.view = boot.authed ? "board" : "login";
        route();
      });
    }
    function refreshBoot() {
      api("/api/bootstrap").then(function(boot) {
        state.boot = boot;
        if (boot.authed)
          state.view = "board";
        route();
      }).catch(function(err) {
        say(errText(err));
      });
    }
    function refresh() {
      api("/api/bootstrap").then(function(boot) {
        state.boot = boot;
        if (!boot.ready || !boot.authed) {
          state.itemsLoaded = false;
          route();
          return;
        }
        state.view = "board";
        state.itemsLoaded = false;
        route();
      }).catch(function(err) {
        if (!guard(err))
          say(errText(err));
      });
    }
    function openSettings() {
      api("/api/bootstrap").then(function(boot) {
        state.boot = boot;
        if (!boot.authed) {
          loseAuth();
          return;
        }
        state.confirmClear = false;
        state.view = "settings";
        route();
      }).catch(function(err) {
        if (!guard(err))
          say(errText(err));
      });
    }
    function renderSetup() {
      clear(node.main);
      var sheet = el("form", "sheet");
      sheet.appendChild(el("p", "lead", t("setupLead")));
      var fields = el("div", "fields");
      var a = passwordField(t("passphrase"), "setup-pass", "new-password");
      var b = passwordField(t("passphraseAgain"), "setup-again", "new-password");
      fields.appendChild(a.wrap);
      fields.appendChild(b.wrap);
      sheet.appendChild(fields);
      var row = el("div", "row");
      var go = el("button", "seal", t("start"));
      go.type = "submit";
      row.appendChild(go);
      sheet.appendChild(row);
      sheet.appendChild(errorLine());
      sheet.addEventListener("submit", function(e) {
        e.preventDefault();
        if (state.busy)
          return;
        if (a.input.value !== b.input.value) {
          showErr(codeErr("passphrase_mismatch"));
          return;
        }
        if (Array.from(a.input.value).length < 6) {
          showErr(codeErr("passphrase_too_short"));
          return;
        }
        run(go, t("start"), function() {
          return postJSON("/api/setup", { passphrase: a.input.value, again: b.input.value }).then(enter);
        });
      });
      node.main.appendChild(sheet);
    }
    function renderWaiting() {
      clear(node.main);
      var sheet = el("div", "sheet");
      sheet.appendChild(el("p", "lead", t("waiting")));
      sheet.appendChild(btn(t("refresh"), refreshBoot, "seal"));
      node.main.appendChild(sheet);
    }
    function renderLogin() {
      clear(node.main);
      var sheet = el("form", "sheet");
      sheet.appendChild(el("p", "lead", t("loginLead")));
      var fields = el("div", "fields");
      var a = passwordField(t("passphrase"), "login-pass", "current-password");
      fields.appendChild(a.wrap);
      sheet.appendChild(fields);
      var row = el("div", "row");
      var go = el("button", "seal", t("unlock"));
      go.type = "submit";
      row.appendChild(go);
      sheet.appendChild(row);
      sheet.appendChild(errorLine());
      sheet.addEventListener("submit", function(e) {
        e.preventDefault();
        if (state.busy)
          return;
        run(go, t("unlock"), function() {
          return postJSON("/api/login", { passphrase: a.input.value }).then(enter);
        });
      });
      node.main.appendChild(sheet);
      a.input.focus();
    }
    function visibleItems() {
      var q = state.query.trim().toLowerCase();
      if (!q)
        return state.items;
      return state.items.filter(function(it) {
        if (it.kind === "text" && it.text)
          return it.text.toLowerCase().indexOf(q) !== -1;
        if (it.name)
          return it.name.toLowerCase().indexOf(q) !== -1;
        return false;
      });
    }
    function renderBoard() {
      clear(node.main);
      node.main.appendChild(composer());
      if (state.items.length || state.query.trim())
        node.main.appendChild(searchBar());
      if (!state.itemsLoaded) {
        node.main.appendChild(el("div", "skel"));
        if (!state.loading)
          loadFirst();
        return;
      }
      if (!state.items.length) {
        node.main.appendChild(el("p", "hint", t("empty")));
        shareHint();
        return;
      }
      var shown = visibleItems();
      if (!shown.length) {
        node.main.appendChild(el("p", "hint", t("searchEmpty")));
        return;
      }
      shown.forEach(function(it, i) {
        node.main.appendChild(slipNode(it, i === 0 && !state.query.trim()));
      });
      if (state.hasMore && !state.query.trim()) {
        node.main.appendChild(btn(t("loadMore"), loadMore, "textbtn more"));
      }
    }
    function searchBar() {
      var row = el("div", "searchbar");
      var input = el("input", "search");
      input.type = "text";
      input.value = state.query;
      input.placeholder = t("searchPlaceholder");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("aria-label", t("searchPlaceholder"));
      input.spellcheck = false;
      input.addEventListener("input", function() {
        state.query = input.value;
        repaintKeepSearch();
      });
      row.appendChild(input);
      if (state.query.trim()) {
        row.appendChild(btn(t("clearSearch"), function() {
          state.query = "";
          route();
        }, "textbtn"));
      }
      return row;
    }
    function repaintKeepSearch() {
      var caret = state.query.length;
      renderBoard();
      var next = node.main.querySelector(".search");
      if (!next)
        return;
      next.focus();
      try {
        next.setSelectionRange(caret, caret);
      } catch (e) {
      }
    }
    function shareHint() {
      var urls = state.boot && state.boot.urls || [];
      if (!urls.length) {
        if (state.boot && state.boot.loopback)
          node.main.appendChild(el("p", "hint", t("noLan")));
        return;
      }
      var row = el("div", "urlrow");
      row.appendChild(el("div", "", t("share")));
      node.main.appendChild(row);
      var line = el("div", "urlrow");
      line.appendChild(el("div", "url", urls[0]));
      line.appendChild(copyButton(urls[0]));
      node.main.appendChild(line);
    }
    function composer() {
      var form = el("form", "sheet composer");
      var lab = el("label", "", t("writeLabel"));
      var ta = el("textarea");
      ta.id = "write";
      lab.htmlFor = "write";
      ta.value = state.draft;
      ta.placeholder = t("writeHint");
      ta.setAttribute("autocorrect", "off");
      ta.setAttribute("autocapitalize", "off");
      ta.spellcheck = false;
      ta.addEventListener("input", function() {
        state.draft = ta.value;
      });
      ta.addEventListener("keydown", function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          go.click();
        }
      });
      ta.addEventListener("paste", function(e) {
        onPaste(e, ta, go);
      });
      var row = el("div", "row");
      var pick = btn(t("addFile"), function() {
        file.click();
      }, "textbtn");
      var go = el("button", "seal", t("drop"));
      go.type = "submit";
      var file = el("input");
      file.type = "file";
      file.className = "clip";
      file.multiple = true;
      file.tabIndex = -1;
      file.setAttribute("aria-hidden", "true");
      file.addEventListener("change", function() {
        if (file.files && file.files.length)
          sendFiles(allFilesOfInput(file), go);
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
      form.addEventListener("submit", function(e) {
        e.preventDefault();
        submitText(ta, go);
      });
      formEl = form;
      writeEl = ta;
      dropBtn = go;
      return form;
    }
    function hasFiles(e) {
      var dt = e.dataTransfer;
      if (!dt)
        return false;
      if (dt.types) {
        var i = void 0;
        for (i = 0; i < dt.types.length; i++) {
          if (dt.types[i] === "Files" || dt.types[i] === "text/plain" || dt.types[i] === "text/uri-list")
            return true;
        }
      }
      return !!(dt.files && dt.files.length);
    }
    function allFilesOfInput(input) {
      var out = [];
      var i;
      if (!input.files)
        return out;
      for (i = 0; i < input.files.length; i++)
        out.push(input.files[i]);
      return out;
    }
    function dropText(ta, text) {
      var trimmed = text.trim();
      if (!trimmed)
        return;
      if (ta.value.trim() && !/\s$/.test(ta.value))
        ta.value = ta.value + "\n" + trimmed;
      else
        ta.value = ta.value + trimmed;
      state.draft = ta.value;
      ta.focus();
    }
    function onPaste(e, ta, go) {
      var kind = classifyPaste(e.clipboardData, textCap);
      if (kind.kind === "image") {
        e.preventDefault();
        sendFiles(kind.files, go);
        return;
      }
      if (kind.kind === "files" && kind.text) {
        e.preventDefault();
        var blob = new Blob([kind.text], { type: "text/plain" });
        var stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
        var named = new File([blob], "pasted-" + stamp + ".txt", { type: "text/plain" });
        sendFiles([named], go);
        return;
      }
    }
    function submitText(ta, button) {
      var text = ta.value;
      if (!text.trim()) {
        showErr(codeErr("empty"));
        return;
      }
      if (byteLength(text) > textCap) {
        showErr(codeErr("text_too_large"));
        return;
      }
      run(button, t("drop"), function() {
        return postJSON("/api/text", { text: text }).then(function() {
          state.draft = "";
          return reloadItems();
        });
      });
    }
    function sendFiles(files, button) {
      var i;
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
      run(button, t("drop"), function() {
        var chain = Promise.resolve();
        for (i = 0; i < files.length; i += 8) {
          (function(batch) {
            chain = chain.then(function() {
              return uploadBatch(batch);
            });
          })(files.slice(i, i + 8));
        }
        return chain.then(function() {
          return reloadItems();
        });
      });
    }
    function uploadBatch(files) {
      return new Promise(function(resolve, reject) {
        page.uploadBatch(files, function(ok) {
          if (ok)
            resolve(null);
          else
            reject(codeErr("bad_request"));
        });
      });
    }
    function loadFirst() {
      state.loading = true;
      api("/api/items?limit=40").then(function(body) {
        state.loading = false;
        state.itemsLoaded = true;
        state.items = body.items || [];
        state.hasMore = !!body.hasMore;
        if (state.view === "board")
          renderBoard();
      }).catch(function(err) {
        state.loading = false;
        state.itemsLoaded = true;
        if (guard(err))
          return;
        if (state.view === "board")
          renderBoard();
        showErr(err);
      });
    }
    function reloadItems() {
      return api("/api/items?limit=40").then(function(body) {
        state.itemsLoaded = true;
        state.items = body.items || [];
        state.hasMore = !!body.hasMore;
        if (state.view === "board")
          renderBoard();
      });
    }
    function loadMore() {
      if (state.loading || !state.items.length)
        return;
      state.loading = true;
      var last = state.items[state.items.length - 1].id;
      api("/api/items?limit=40&before=" + encodeURIComponent(last)).then(function(body) {
        state.loading = false;
        state.items = state.items.concat(body.items || []);
        state.hasMore = !!body.hasMore;
        if (state.view === "board")
          renderBoard();
      }).catch(function(err) {
        state.loading = false;
        if (!guard(err))
          showErr(err);
      });
    }
    function metaText(it) {
      var parts = [];
      var when = formatTime(it.createdAt);
      if (when)
        parts.push(when);
      parts.push(kindLabel(it.kind));
      if (it.size)
        parts.push(formatBytes(it.size));
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
        var img = el("img", "shot");
        img.alt = it.name || t("imageKind");
        img.src = "/api/items/" + id + "/thumb";
        card.appendChild(img);
      } else {
        var nameRow = el("p", "fname", it.name || t("fileKind"));
        card.appendChild(nameRow);
        if (id && previewable(it))
          card.appendChild(previewBlock(it, id));
      }
      var row = el("div", "row");
      if (it.kind === "text") {
        var copy_1 = btn(t("copy"), function() {
          copyButtonText(it.text || "", copy_1);
        }, "textbtn");
        row.appendChild(copy_1);
      }
      if (id && page.canPreview(it))
        row.appendChild(fileLink(t("view"), "/api/items/" + id + "/raw"));
      if (id && it.kind !== "text")
        row.appendChild(fileLink(t("download"), "/api/items/" + id + "/raw?dl=1"));
      if (id) {
        row.appendChild(btn(t("remove"), function() {
          removeItem(id);
        }, "textbtn"));
      }
      card.appendChild(row);
      return card;
    }
    function previewBlock(it, id) {
      var wrap = el("div", "preview");
      var open = !!state.openPreview[id];
      var toggle = btn(open ? t("previewClose") : t("previewOpen"), function() {
        if (state.openPreview[id]) {
          delete state.openPreview[id];
        } else {
          state.openPreview[id] = true;
          loadPreview(it, id);
        }
        if (state.view === "board")
          renderBoard();
      }, "textbtn previewbtn");
      wrap.appendChild(toggle);
      if (open) {
        if (state.previewText[id] === void 0) {
          wrap.appendChild(el("p", "hint", t("previewLoading")));
        } else if (state.previewText[id] === null) {
          wrap.appendChild(el("p", "hint", t("previewBinary")));
        } else {
          wrap.appendChild(el("pre", "body previewbody", state.previewText[id]));
        }
      }
      return wrap;
    }
    function loadPreview(it, id) {
      if (state.previewText[id] !== void 0)
        return;
      if (it.size && it.size > previewCap) {
        state.previewText[id] = null;
        return;
      }
      state.previewText[id] = void 0;
      page.previewText(it, function(text) {
        state.previewText[id] = text;
        if (state.view === "board")
          renderBoard();
      });
    }
    function fileLink(label, href) {
      var a = el("a", "textbtn", label);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      return a;
    }
    function copyButtonText(text, button) {
      copyText(text).then(function(ok) {
        if (!ok) {
          say(t("copyFail"));
          return;
        }
        button.textContent = t("copied");
        say(t("copied"));
        setTimeout(function() {
          if (button.isConnected)
            button.textContent = t("copy");
        }, 1600);
      });
    }
    function copyButton(text) {
      var b = btn(t("copy"), function() {
        copyButtonText(text, b);
      }, "textbtn");
      return b;
    }
    function removeItem(id) {
      api("/api/items/" + id, { method: "DELETE" }).then(function() {
        state.items = state.items.filter(function(it) {
          return it.id !== id;
        });
        delete state.openPreview[id];
        delete state.previewText[id];
        queueUndo([id]);
        if (state.view === "board")
          renderBoard();
      }).catch(function(err) {
        if (!guard(err))
          showErr(err);
      });
    }
    function queueUndo(ids) {
      ids.forEach(function(id) {
        if (id && state.pending.indexOf(id) === -1)
          state.pending.push(id);
      });
      showUndo();
    }
    function showUndo() {
      clear(node.undo);
      node.undo.hidden = false;
      node.undo.appendChild(el("span", "", t("removed")));
      node.undo.appendChild(btn(t("undo"), doUndo));
      clearTimeout(state.undoTimer);
      state.undoTimer = setTimeout(function() {
        state.pending = [];
        node.undo.hidden = true;
      }, undoMillis);
    }
    function doUndo() {
      var ids = state.pending.slice();
      state.pending = [];
      clearTimeout(state.undoTimer);
      node.undo.hidden = true;
      if (!ids.length)
        return;
      postJSON("/api/restore", { ids: ids }).then(function() {
        state.itemsLoaded = false;
        if (state.view === "board")
          renderBoard();
      }).catch(function(err) {
        if (!guard(err))
          say(errText(err));
      });
    }
    function renderSettings() {
      clear(node.main);
      var boot = state.boot || {};
      var share = el("section", "sheet");
      share.appendChild(el("p", "lead", t("share")));
      var img = el("img", "qr");
      img.alt = "";
      img.src = "/api/qr.svg";
      share.appendChild(img);
      var urls = boot.urls || [];
      if (!urls.length) {
        share.appendChild(el("p", "hint", t("noLan")));
      }
      urls.forEach(function(u) {
        var line = el("div", "urlrow");
        line.appendChild(el("div", "url", u));
        line.appendChild(copyButton(u));
        share.appendChild(line);
      });
      share.appendChild(el("p", "hint", t("usage") + " " + formatBytes(boot.used || 0) + " / " + formatBytes(boot.limit || 0)));
      node.main.appendChild(share);
      var form = el("form", "sheet");
      form.appendChild(el("p", "lead", t("changePass")));
      var fields = el("div", "fields");
      var cur = passwordField(t("currentPass"), "cur-pass", "current-password");
      var next = passwordField(t("newPass"), "new-pass", "new-password");
      var again = passwordField(t("passphraseAgain"), "new-again", "new-password");
      fields.appendChild(cur.wrap);
      fields.appendChild(next.wrap);
      fields.appendChild(again.wrap);
      form.appendChild(fields);
      var row = el("div", "row");
      var save = el("button", "seal", t("savePass"));
      save.type = "submit";
      row.appendChild(save);
      form.appendChild(row);
      form.appendChild(errorLine());
      form.addEventListener("submit", function(e) {
        e.preventDefault();
        state.confirmClear = false;
        if (next.input.value !== again.input.value) {
          showErr(codeErr("passphrase_mismatch"));
          return;
        }
        run(save, t("savePass"), function() {
          return postJSON("/api/passphrase", {
            current: cur.input.value,
            next: next.input.value,
            again: again.input.value
          }).then(function() {
            say(t("saved"));
            cur.input.value = "";
            next.input.value = "";
            again.input.value = "";
            if (state.errEl)
              state.errEl.hidden = true;
          });
        });
      });
      node.main.appendChild(form);
      var danger = el("div", "sheet");
      var actions = el("div", "row split");
      var clearBtn = btn(state.confirmClear ? t("confirmClear") : t("clear"), function() {
        if (!state.confirmClear) {
          state.confirmClear = true;
          clearBtn.textContent = t("confirmClear");
          clearBtn.className = "seal";
          return;
        }
        run(clearBtn, t("confirmClear"), function() {
          return api("/api/clear", { method: "POST" }).then(function(body) {
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
      }, state.confirmClear ? "seal" : "textbtn");
      actions.appendChild(clearBtn);
      actions.appendChild(btn(t("logoutAll"), function() {
        state.confirmClear = false;
        api("/api/logout-all", { method: "POST" }).then(function() {
          say(t("loggedOut"));
          loseAuth();
        }).catch(function(err) {
          if (!guard(err))
            showErr(err);
        });
      }, "textbtn"));
      danger.appendChild(actions);
      node.main.appendChild(danger);
      node.main.appendChild(el("p", "hint", t("version") + " " + (boot.version || "")));
    }
    installDragHandlers();
    applyChrome();
    paintNav();
    api("/api/bootstrap").then(function(boot) {
      state.boot = boot;
      route();
    }).catch(function(err) {
      clear(node.main);
      node.main.appendChild(el("p", "lead", errText(err)));
    });
  }

  // ../.webuild/core.js
  var w = window;
  w.Slip = {
    // helpers the pages read
    t: t,
    lang: lang,
    api: api,
    errText: errText,
    copyText: copyText,
    byteLength: byteLength,
    formatBytes: formatBytes,
    formatTime: formatTime,
    kindLabel: kindLabel,
    safeID: safeID,
    previewable: previewable,
    classifyPaste: classifyPaste,
    isURL: isURL,
    storeGet: storeGet,
    storeSet: storeSet,
    themeNow: themeNow,
    postJSON: postJSON,
    codeErr: codeErr,
    // element helpers
    el: el,
    btn: btn,
    clear: clear,
    // the controller
    start: start
  };
})();
