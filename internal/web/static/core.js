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
      more: "更多",
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
      checkUpdate: "检查更新",
      checking: "检查中…",
      updateLatest: "已是最新版本。",
      updateFound: "有新版本",
      updateFailed: "连不上 GitHub，稍后再试。",
      releasePage: "发布页",
      dragHint: "松手放下",
      searchPlaceholder: "找一找",
      searchEmpty: "没有找到。",
      clearSearch: "清除",
      previewOpen: "展开",
      previewClose: "收起",
      previewFileOpen: "预览",
      previewLoading: "正在读取",
      kindAll: "全部",
      kindEmpty: "没有这种类型。",
      layoutList: "列表",
      layoutGrid: "网格",
      newItems: "有新的纸条，点击刷新",
      previewTooBig: "文件太大，不能在这里展开。",
      previewFailed: "读不出来，请下载。",
      previewBinary: "这种文件不能预览。",
      edit: "编辑",
      save: "保存",
      cancel: "取消",
      close: "关闭",
      edited: "已编辑",
      confirmRemove: "确认删除？",
      removedUndo: "已删除，8 秒内可撤销。",
      notText: "只有文字纸条能编辑。",
      secretKind: "密条",
      secretToggle: "密条",
      secretToggleHint: "内容遮住，别的设备取走就消失",
      secretKeepHint: "内容遮住，到时自己消失",
      burn: "阅后即焚",
      burnHint: "另一台设备打开后就烧掉",
      ttlLabel: "保留",
      ttl10: "10 分钟",
      ttl60: "1 小时",
      ttl24: "24 小时",
      code: "取件码",
      codePlaceholder: "6 位以上",
      codeOptional: "选填",
      codeGen: "生成",
      codeNote: "填了就存成密文，只有输对才能打开。",
      codeOnce: "取件码只显示这一次。记下来再走。",
      codeAsk: "输入取件码",
      open: "打开",
      revealHides: "30 秒后自动遮住。",
      wrongCode: "取件码不对。",
      codeTooShort: "至少 6 位。",
      taken: "已被取走",
      secretGone: "这条密条已经不在了。",
      secretRemoved: "密条已删除，不能撤销。",
      secretLocked: "密条不能编辑。",
      secretNote: "同一 Wi-Fi 上能抓到明文。银行密码别放这里。",
      secretExpiresHint: "到点就消失，打开前一直是圆点。",
      secretSealed: "密文",
      show: "显示",
      hide: "隐藏",
      secretTextOnly: "密条只收文字。先关掉密条，再放文件。",
      takenBody: "这条密条已经被取走了，内容不留在板上。",
      leftMin: "还剩 {n} 分钟",
      leftHour: "还剩 {n} 小时",
      leftDay: "还剩 {n} 天",
      expired: "已过期",
      settingsSecret: "密条设了取件码时，内容以密文写在磁盘上，口令不保存。局域网仍是 HTTP，同网段抓包能看到明文。"
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
      more: "More",
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
      checkUpdate: "Check for updates",
      checking: "Checking…",
      updateLatest: "You are on the latest version.",
      updateFound: "A newer version is out:",
      updateFailed: "Could not reach GitHub. Try again later.",
      releasePage: "Release page",
      dragHint: "Drop to put down",
      searchPlaceholder: "Find a slip",
      searchEmpty: "Nothing matched.",
      clearSearch: "Clear",
      previewOpen: "Open",
      previewClose: "Close",
      previewFileOpen: "Preview",
      previewLoading: "Reading",
      kindAll: "All",
      kindEmpty: "Nothing of that kind.",
      layoutList: "List",
      layoutGrid: "Grid",
      newItems: "New slips, tap to refresh",
      previewTooBig: "Too large to open here.",
      previewFailed: "Could not read it. Try Download.",
      previewBinary: "This file cannot be previewed.",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      edited: "edited",
      confirmRemove: "Sure delete?",
      removedUndo: "Deleted. You can undo for 8 seconds.",
      notText: "Only text slips can be edited.",
      secretKind: "Secret",
      secretToggle: "Secret",
      secretToggleHint: "Hidden, gone once another device takes it",
      secretKeepHint: "Hidden, gone when the time is up",
      burn: "Burn after read",
      burnHint: "The next device to open it burns it",
      ttlLabel: "Keep for",
      ttl10: "10 minutes",
      ttl60: "1 hour",
      ttl24: "24 hours",
      code: "Code",
      codePlaceholder: "6+ characters",
      codeOptional: "Optional",
      codeGen: "Generate",
      codeNote: "With a code the body is stored encrypted, and only that code opens it.",
      codeOnce: "This code is shown once. Note it down before you leave.",
      codeAsk: "Enter the code",
      open: "Open",
      revealHides: "Hidden again in 30 seconds.",
      wrongCode: "That code is not right.",
      codeTooShort: "Use at least 6 characters.",
      taken: "Taken",
      secretGone: "That secret is no longer there.",
      secretRemoved: "Secret deleted. That one cannot be undone.",
      secretLocked: "A secret cannot be edited.",
      secretNote: "Anyone on this Wi-Fi can read the traffic. Do not put a bank password here.",
      secretExpiresHint: "Gone when the time is up. Dots until then.",
      secretSealed: "Encrypted",
      show: "Show",
      hide: "Hide",
      secretTextOnly: "A secret is text only. Turn the secret switch off to add a file.",
      takenBody: "This secret was taken. The body is not kept on the board.",
      leftMin: "{n} min left",
      leftHour: "{n} h left",
      leftDay: "{n} d left",
      expired: "Expired",
      settingsSecret: "With a code, a secret is written to disk as ciphertext and the code is not stored. The LAN is still HTTP, so a sniffer on the same network sees the body in the clear."
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
  function tn(key, n) {
    return t(key).replace("{n}", String(n));
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
    return dayKey(d) === dayKey(now) ? clock(d) : fullStamp(d);
  }
  function clock(d) {
    return two(d.getHours()) + ":" + two(d.getMinutes());
  }
  function fullStamp(d) {
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + clock(d);
  }
  function dayKey(d) {
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
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

  // ../.webuild/api.js
  function deviceTag() {
    var saved = storeGet("slip.dev");
    if (saved && /^[0-9a-f]{16}$/.test(saved))
      return saved;
    var fresh = randomHex();
    storeSet("slip.dev", fresh);
    return fresh;
  }
  function randomHex() {
    var bytes = [];
    var i;
    var c = window.crypto;
    if (c && typeof c.getRandomValues === "function") {
      var buf = new Uint8Array(8);
      c.getRandomValues(buf);
      for (i = 0; i < buf.length; i++)
        bytes.push(buf[i]);
    } else {
      for (i = 0; i < 8; i++)
        bytes.push(Math.floor(Math.random() * 256));
    }
    var out = "";
    for (i = 0; i < bytes.length; i++)
      out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return out;
  }
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["X-Slip"] = "1";
    headers["X-Slip-Device"] = deviceTag();
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
      wrong_code: "wrongCode",
      code_too_short: "codeTooShort",
      code_too_long: "tooLong",
      code_required: "codeAsk",
      secret_locked: "secretLocked",
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

  // ../.webuild/markdown.js
  var MAX_LINES = 4e3;
  var RE_FENCE_CLOSE = /^\s*```\s*$/;
  var RE_HEADING_CAPTURE = /^(#{1,6})\s+(.*)$/;
  function inline(line, into) {
    var i = 0;
    var buf = "";
    function flush() {
      if (buf) {
        into.appendChild(document.createTextNode(buf));
        buf = "";
      }
    }
    while (i < line.length) {
      var ch = line.charAt(i);
      if (ch === "`") {
        var close_1 = line.indexOf("`", i + 1);
        if (close_1 > i + 1) {
          flush();
          var code = el("code", "md-code", line.slice(i + 1, close_1));
          into.appendChild(code);
          i = close_1 + 1;
          continue;
        }
      }
      if (ch === "[") {
        var mid = line.indexOf("](", i + 1);
        var close_2 = mid === -1 ? -1 : line.indexOf(")", mid + 2);
        if (mid > i && close_2 > mid) {
          var label = line.slice(i + 1, mid);
          var url = line.slice(mid + 2, close_2);
          if (safeURL(url)) {
            flush();
            var a = el("a", "md-link", label);
            a.href = url;
            a.rel = "noopener noreferrer";
            a.target = "_blank";
            into.appendChild(a);
            i = close_2 + 1;
            continue;
          }
        }
      }
      if (ch === "*" && line.charAt(i + 1) === "*") {
        var close_3 = line.indexOf("**", i + 2);
        if (close_3 > i + 2) {
          flush();
          var strong = el("strong", null, line.slice(i + 2, close_3));
          into.appendChild(strong);
          i = close_3 + 2;
          continue;
        }
      }
      if (ch === "*" || ch === "_") {
        var close_4 = line.indexOf(ch, i + 1);
        if (close_4 > i + 1) {
          flush();
          var em = el("em", null, line.slice(i + 1, close_4));
          into.appendChild(em);
          i = close_4 + 1;
          continue;
        }
      }
      if (ch === "h" && (line.slice(i, i + 7) === "http://" || line.slice(i, i + 8) === "https://")) {
        var end = i;
        while (end < line.length && !/\s/.test(line.charAt(end)))
          end++;
        var url = line.slice(i, end);
        flush();
        var a = el("a", "md-link", url);
        a.href = url;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        into.appendChild(a);
        i = end;
        continue;
      }
      buf += ch;
      i++;
    }
    flush();
  }
  function safeURL(url) {
    var u = url.trim().toLowerCase();
    return u.indexOf("http://") === 0 || u.indexOf("https://") === 0;
  }
  function render(source) {
    var frag = document.createDocumentFragment();
    var lines = source.replace(/\r\n?/g, "\n").split("\n");
    var limit = Math.min(lines.length, MAX_LINES);
    var i = 0;
    while (i < limit) {
      var line = lines[i];
      var fence = line.match(/^\s*```(.*)$/);
      if (fence) {
        var body = [];
        i++;
        while (i < limit && !RE_FENCE_CLOSE.test(lines[i])) {
          body.push(lines[i]);
          i++;
        }
        i++;
        var pre = el("pre", "md-pre");
        var code = el("code", null, body.join("\n"));
        pre.appendChild(code);
        frag.appendChild(pre);
        continue;
      }
      if (!line.trim()) {
        i++;
        continue;
      }
      var h = line.match(RE_HEADING_CAPTURE);
      if (h) {
        var tag = "h" + String(Math.min(h[1].length, 6));
        var heading = el(tag, "md-h");
        inline(h[2], heading);
        frag.appendChild(heading);
        i++;
        continue;
      }
      if (RE_RULE.test(line)) {
        frag.appendChild(el("hr", "md-hr"));
        i++;
        continue;
      }
      if (RE_QUOTE.test(line)) {
        var body = [];
        while (i < limit && RE_QUOTE.test(lines[i])) {
          body.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        var quote = el("blockquote", "md-quote");
        inline(body.join(" "), quote);
        frag.appendChild(quote);
        continue;
      }
      if (RE_BULLET.test(line)) {
        var list = el("ul", "md-list");
        while (i < limit && RE_BULLET.test(lines[i])) {
          var item = el("li");
          inline(lines[i].replace(/^\s*[-*+]\s+/, ""), item);
          list.appendChild(item);
          i++;
        }
        frag.appendChild(list);
        continue;
      }
      if (RE_ORDERED.test(line)) {
        var list = el("ol", "md-list");
        while (i < limit && RE_ORDERED.test(lines[i])) {
          var item = el("li");
          inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""), item);
          list.appendChild(item);
          i++;
        }
        frag.appendChild(list);
        continue;
      }
      var para = [];
      while (i < limit && lines[i].trim() && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (!para.length) {
        var p_1 = el("p", "md-p");
        inline(line, p_1);
        frag.appendChild(p_1);
        i++;
        continue;
      }
      var p = el("p", "md-p");
      inline(para.join("\n"), p);
      frag.appendChild(p);
    }
    if (lines.length > MAX_LINES) {
      frag.appendChild(el("p", "md-p md-cut", "..."));
    }
    return frag;
  }
  var RE_FENCE = /^\s*```/;
  var RE_HEADING = /^(#{1,6})\s+/;
  var RE_QUOTE = /^\s*>\s?/;
  var RE_BULLET = /^\s*[-*+]\s+/;
  var RE_ORDERED = /^\s*\d+[.)]\s+/;
  var RE_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
  function isBlockStart(line) {
    return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_QUOTE.test(line) || RE_BULLET.test(line) || RE_ORDERED.test(line) || RE_RULE.test(line);
  }
  function isMarkdown(name, mime) {
    var n = String(name || "").toLowerCase();
    var m = String(mime || "").toLowerCase();
    return n.slice(-3) === ".md" || n.slice(-9) === ".markdown" || m === "text/markdown";
  }

  // ../.webuild/board.js
  var fileCap = 50 * 1024 * 1024;
  var textCap = 200 * 1024;
  var secretCap = 4 * 1024;
  var previewCap = 256 * 1024;
  var undoMillis = 8e3;
  var revealMillis = 3e4;
  var textFoldLines = 12;
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
    var formEl = null;
    var writeEl = null;
    var dropBtn = null;
    var dragDepth = 0;
    function setOver(on) {
      if (formEl)
        formEl.className = on ? "sheet composer is-over" : "sheet composer";
      page.setDragging(on);
    }
    function isTyping() {
      var a = document.activeElement;
      if (!a)
        return false;
      var tag = a.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable === true;
    }
    function installKeys() {
      document.addEventListener("keydown", function(e) {
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
          var field = node.main.querySelector(".search");
          if (field) {
            field.focus();
          } else {
            state.query = " ";
            route();
            var next = node.main.querySelector(".search");
            if (next) {
              next.value = "";
              state.query = "";
              next.focus();
            }
          }
        }
      });
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
    var noticeTimer = 0;
    function showErr(err) {
      var text = errText(err);
      if (state.errEl) {
        state.errEl.hidden = false;
        state.errEl.textContent = text;
      }
      showNotice(text);
      say(text);
    }
    function showNotice(text) {
      if (!node.undo.hidden) {
        say(text);
        return;
      }
      clear(node.undo);
      node.undo.appendChild(el("span", "", text));
      node.undo.hidden = false;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(function() {
        node.undo.hidden = true;
      }, 4e3);
    }
    function loseAuth() {
      state.viewer = null;
      paintViewer();
      if (state.boot)
        state.boot.authed = false;
      state.view = "login";
      state.items = [];
      state.itemsLoaded = false;
      state.openPreview = {};
      state.openText = {};
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
      if (state.view === "board") {
        startPolling();
      } else {
        stopPolling();
      }
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
      var kind = state.kindFilter;
      return state.items.filter(function(it) {
        if (kind && it.kind !== kind)
          return false;
        if (!q)
          return true;
        if (it.secret)
          return false;
        if (it.kind === "text" && it.text)
          return it.text.toLowerCase().indexOf(q) !== -1;
        if (it.name)
          return it.name.toLowerCase().indexOf(q) !== -1;
        return false;
      });
    }
    function controlsBar() {
      var row = el("div", "kindbar");
      var present = ["text", "image", "file"].filter(function(k) {
        return state.items.some(function(it) {
          return it.kind === k;
        });
      });
      if (state.kindFilter && present.indexOf(state.kindFilter) === -1)
        present.push(state.kindFilter);
      if (present.length > 1 || state.kindFilter) {
        var kinds = [""].concat(present);
        kinds.forEach(function(k) {
          var n = k ? state.items.filter(function(it) {
            return it.kind === k;
          }).length : state.items.length;
          var label = (k ? kindLabel(k) : t("kindAll")) + " " + n;
          var b = btn(label, function() {
            state.kindFilter = state.kindFilter === k ? "" : k;
            if (state.view === "board")
              renderBoard();
          }, state.kindFilter === k ? "kindbtn is-on" : "kindbtn");
          b.setAttribute("aria-pressed", state.kindFilter === k ? "true" : "false");
          row.appendChild(b);
        });
      }
      var grid = layoutChoice() === "grid";
      var swap = btn((grid ? "☰ " : "▦ ") + (grid ? t("layoutList") : t("layoutGrid")), function() {
        setLayout(grid ? "list" : "grid");
      }, "textbtn layoutbtn");
      swap.setAttribute("aria-label", grid ? t("layoutList") : t("layoutGrid"));
      row.appendChild(swap);
      return row;
    }
    function layoutChoice() {
      return storeGet("slip.layout") === "grid" ? "grid" : "list";
    }
    function setLayout(next) {
      storeSet("slip.layout", next);
      if (state.view === "board")
        renderBoard();
    }
    function renderBoard() {
      var y = window.pageYOffset;
      clear(node.main);
      paintBoard();
      window.scrollTo(0, y);
      settlePrompt();
    }
    function paintBoard() {
      node.main.appendChild(composer());
      var code = codeCard();
      if (code)
        node.main.appendChild(code);
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
      node.main.appendChild(controlsBar());
      var shown = visibleItems();
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
    function settlePrompt() {
      var box = document.querySelector(".codeprompt");
      if (!box)
        return;
      var rect = box.getBoundingClientRect();
      var view = window.innerHeight || document.documentElement.clientHeight || 0;
      var target = window.pageYOffset + rect.top - Math.max(12, (view - rect.height) / 2);
      window.scrollTo(0, target < 0 ? 0 : target);
      var field = box.querySelector(".codeinput");
      if (!field)
        return;
      try {
        field.focus({ preventScroll: true });
      } catch (e) {
        field.focus();
      }
    }
    function renderBoardList(shown) {
      var lastDay = "";
      shown.forEach(function(it, i) {
        var day = dayKeyOf(it);
        if (day !== lastDay) {
          lastDay = day;
          node.main.appendChild(el("p", "daysep", dayLabel(it)));
        }
        node.main.appendChild(slipNode(it, i === 0 && !state.query.trim() && !state.kindFilter));
      });
    }
    function renderBoardGrid(shown) {
      var wall = el("div", "wall");
      var cols = [el("div", "wallcol"), el("div", "wallcol")];
      var fresh = !state.query.trim() && !state.kindFilter;
      shown.forEach(function(it, i) {
        cols[i % 2].appendChild(gridTile(it, i === 0 && fresh));
      });
      wall.appendChild(cols[0]);
      wall.appendChild(cols[1]);
      node.main.appendChild(wall);
    }
    function gridTile(it, newest) {
      var id = safeID(it.id);
      var tile = el("div", newest ? "tile is-new" : "tile");
      tile.setAttribute("data-kind", it.kind);
      if (it.kind === "image" && it.hasThumb && id) {
        var img = el("img", "tileimg");
        img.alt = it.name || t("imageKind");
        img.loading = "lazy";
        img.src = "/api/items/" + id + "/thumb";
        img.addEventListener("click", function() {
          openViewer(it, id);
        });
        tile.appendChild(img);
        var cap = metaText(it);
        if (cap)
          tile.appendChild(el("p", "tilecap", cap));
        return tile;
      }
      tile.appendChild(slipNode(it, false, true));
      return tile;
    }
    function dayKeyOf(it) {
      var d = new Date(it.createdAt);
      return isNaN(d.getTime()) ? "" : dayKey(d);
    }
    function dayLabel(it) {
      var d = new Date(it.createdAt);
      if (isNaN(d.getTime()))
        return "";
      var now = /* @__PURE__ */ new Date();
      var yest = new Date(now.getTime());
      yest.setDate(now.getDate() - 1);
      if (dayKey(d) === dayKey(now))
        return t("today");
      if (dayKey(d) === dayKey(yest))
        return t("yesterday");
      return dayKey(d);
    }
    function loadMoreSentinel() {
      var mark = el("div", "moresentinel");
      if (typeof IntersectionObserver === "undefined")
        return mark;
      var seen = /* @__PURE__ */ new WeakMap();
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting)
            return;
          if (seen.get(entry.target))
            return;
          seen.set(entry.target, true);
          io.unobserve(entry.target);
          loadMore();
        });
      });
      io.observe(mark);
      return mark;
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
      var composing = false;
      input.addEventListener("compositionstart", function() {
        composing = true;
      });
      input.addEventListener("compositionend", function() {
        composing = false;
        state.query = input.value;
        repaintKeepSearch();
      });
      input.addEventListener("input", function() {
        if (composing)
          return;
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
        if (state.secretOn) {
          showNotice(t("secretTextOnly"));
          return;
        }
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
      form.appendChild(secretOptions());
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
    function secretOptions() {
      var wrap = el("div", "secretopts");
      var line = el("label", "checkline");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = state.secretOn;
      box.addEventListener("change", function() {
        state.secretOn = box.checked;
        if (state.view === "board")
          renderBoard();
      });
      line.appendChild(box);
      line.appendChild(el("span", "checktext", t("secretToggle")));
      line.appendChild(el("span", "checksub", state.secretBurn ? t("secretToggleHint") : t("secretKeepHint")));
      wrap.appendChild(line);
      if (!state.secretOn) {
        return wrap;
      }
      var body = el("div", "optsbody");
      var when = el("div", "optline");
      var burnLabel = el("label", "inlinecheck");
      var burn = document.createElement("input");
      burn.type = "checkbox";
      burn.checked = state.secretBurn;
      burn.addEventListener("change", function() {
        state.secretBurn = burn.checked;
        var sub = line.querySelector(".checksub");
        if (sub)
          sub.textContent = state.secretBurn ? t("secretToggleHint") : t("secretKeepHint");
      });
      burnLabel.appendChild(burn);
      burnLabel.appendChild(el("span", "checktext", t("burn")));
      when.appendChild(burnLabel);
      var keep = el("div", "inlinekeep");
      keep.appendChild(el("span", "keepword", t("ttlLabel")));
      var segs = el("div", "segset");
      segs.setAttribute("role", "group");
      segs.setAttribute("aria-label", t("ttlLabel"));
      var choices = [
        { v: 600, label: t("ttl10") },
        { v: 3600, label: t("ttl60") },
        { v: 86400, label: t("ttl24") }
      ];
      var segBtns = [];
      var i;
      for (i = 0; i < choices.length; i++) {
        var on = choices[i].v === state.secretTTL;
        var seg = btn(choices[i].label, picker(i), on ? "segbtn is-on" : "segbtn");
        seg.setAttribute("aria-pressed", on ? "true" : "false");
        segBtns.push(seg);
        segs.appendChild(seg);
      }
      function picker(index) {
        return function() {
          state.secretTTL = choices[index].v;
          var j;
          for (j = 0; j < segBtns.length; j++) {
            var on2 = j === index;
            segBtns[j].className = on2 ? "segbtn is-on" : "segbtn";
            segBtns[j].setAttribute("aria-pressed", on2 ? "true" : "false");
          }
        };
      }
      keep.appendChild(segs);
      when.appendChild(keep);
      body.appendChild(when);
      var field = el("div", "optfield");
      var head = el("div", "optfieldhead");
      head.appendChild(el("span", "fieldlabel", t("code")));
      head.appendChild(el("span", "fieldaside", t("codeOptional")));
      field.appendChild(head);
      var group = el("div", "codegroup");
      var code = document.createElement("input");
      code.type = state.secretShow ? "text" : "password";
      code.className = "codeinput";
      code.value = state.secretCode;
      code.placeholder = t("codePlaceholder");
      code.setAttribute("autocomplete", "off");
      code.setAttribute("autocapitalize", "characters");
      code.setAttribute("autocorrect", "off");
      code.setAttribute("spellcheck", "false");
      code.setAttribute("aria-label", t("code"));
      code.addEventListener("input", function() {
        state.secretCode = code.value;
      });
      var see = btn(state.secretShow ? t("hide") : t("show"), function() {
        state.secretShow = !state.secretShow;
        code.type = state.secretShow ? "text" : "password";
        see.textContent = state.secretShow ? t("hide") : t("show");
      }, "gbtn");
      see.setAttribute("aria-pressed", state.secretShow ? "true" : "false");
      var gen = btn(t("codeGen"), function() {
        state.secretCode = newCode();
        state.secretShow = true;
        if (state.view === "board")
          renderBoard();
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
    function codeCard() {
      if (!state.lastCode)
        return null;
      var sheet = el("div", "sheet codecard");
      var head = el("div", "codehead");
      head.appendChild(el("span", "kindtag", t("code")));
      var close = btn("×", function() {
        state.lastCode = "";
        state.lastCodeShow = false;
        if (state.view === "board")
          renderBoard();
      }, "textbtn codeclose");
      close.setAttribute("aria-label", t("close"));
      head.appendChild(close);
      sheet.appendChild(head);
      var shown = state.lastCodeShow;
      var line = el("div", "urlrow");
      var value = el("div", shown ? "url codevalue" : "url codevalue is-masked", shown ? state.lastCode : "••••-••••");
      line.appendChild(value);
      line.appendChild(copyButton(state.lastCode));
      var see = btn(shown ? t("hide") : t("show"), function() {
        state.lastCodeShow = !state.lastCodeShow;
        if (state.view === "board")
          renderBoard();
      }, "textbtn codetoggle");
      see.setAttribute("aria-pressed", shown ? "true" : "false");
      line.appendChild(see);
      sheet.appendChild(line);
      sheet.appendChild(el("p", "hint", t("codeOnce")));
      return sheet;
    }
    function newCode() {
      var alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
      var bytes = [];
      var c = window.crypto;
      var i;
      if (c && typeof c.getRandomValues === "function") {
        var buf = new Uint8Array(8);
        c.getRandomValues(buf);
        for (i = 0; i < 8; i++)
          bytes.push(buf[i]);
      } else {
        for (i = 0; i < 8; i++)
          bytes.push(Math.floor(Math.random() * 256));
      }
      var out = "";
      for (i = 0; i < 8; i++) {
        if (i === 4)
          out += "-";
        out += alphabet.charAt(bytes[i] % alphabet.length);
      }
      return out;
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
      var cap = state.secretOn ? secretCap : textCap;
      if (byteLength(text) > cap) {
        showErr(codeErr("text_too_large"));
        return;
      }
      var code = state.secretCode.replace(/^\s+|\s+$/g, "");
      if (state.secretOn && code && code.length < 6) {
        showErr(codeErr("code_too_short"));
        return;
      }
      var body = { text: text };
      if (state.secretOn) {
        body.secret = true;
        body.burn = state.secretBurn;
        body.ttl = state.secretTTL;
        if (code)
          body.code = code;
      }
      run(button, t("drop"), function() {
        return postJSON("/api/text", body).then(function() {
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
    function sendFiles(files, button) {
      var i;
      if (state.secretOn) {
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
        noteNewest();
        startPolling();
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
        noteNewest();
        if (state.view === "board")
          renderBoard();
      });
    }
    function noteNewest() {
      state.newestId = state.items.length ? state.items[0].id : "";
    }
    function startPolling() {
      if (state.pollTimer)
        return;
      state.pollTimer = setInterval(function() {
        if (state.view !== "board" || document.hidden)
          return;
        api("/api/items?limit=1").then(function(body) {
          var top = body.items && body.items[0];
          if (!top || !state.newestId || top.id === state.newestId)
            return;
          if (document.getElementById("newbar"))
            return;
          var bar = btn(t("newItems"), function() {
            if (bar.parentNode)
              bar.parentNode.removeChild(bar);
            refresh();
          }, "newbar");
          bar.id = "newbar";
          document.body.appendChild(bar);
        }).catch(function() {
        });
      }, 2e4);
    }
    function stopPolling() {
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = 0;
      }
      var bar = document.getElementById("newbar");
      if (bar && bar.parentNode)
        bar.parentNode.removeChild(bar);
    }
    function loadMore() {
      if (state.loading || !state.items.length)
        return;
      if (state.query.trim() || state.kindFilter)
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
    function kindGlyph(kind) {
      if (kind === "image")
        return "▣ ";
      if (kind === "file")
        return "▤ ";
      return "❏ ";
    }
    function metaText(it, short) {
      var parts = [];
      var when = formatTime(it.createdAt);
      if (when)
        parts.push(when);
      if (it.secret) {
        if (it.sealed)
          parts.push(t("secretSealed"));
        if (it.takenAt)
          parts.push(t("taken"));
        else {
          var left = leftText(it);
          if (left)
            parts.push(left);
        }
      } else if (it.size && !short) {
        parts.push(formatBytes(it.size));
      }
      if (it.editedAt)
        parts.push(t("edited"));
      return parts.join(" · ");
    }
    function startSecretClock() {
      if (state.secretTimer)
        return;
      state.secretTimer = setInterval(function() {
        if (state.view !== "board")
          return;
        var i;
        for (i = 0; i < state.items.length; i++) {
          var it = state.items[i];
          if (!it.secret || it.takenAt)
            continue;
          var line = document.querySelector('.slip[data-id="' + it.id + '"] .meta');
          if (line)
            line.textContent = metaText(it);
        }
      }, 3e4);
    }
    function leftText(it) {
      if (!it.expiresAt)
        return "";
      var end = new Date(it.expiresAt).getTime();
      if (isNaN(end))
        return "";
      var ms = end - (/* @__PURE__ */ new Date()).getTime();
      if (ms <= 0)
        return t("expired");
      var min = Math.floor(ms / 6e4);
      if (min < 60)
        return tn("leftMin", min < 1 ? 1 : min);
      var hours = Math.floor(min / 60);
      if (hours < 24)
        return tn("leftHour", hours);
      return tn("leftDay", Math.round(hours / 24));
    }
    function narrowScreen() {
      return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches;
    }
    function actionRow(actions, onMenu, compact) {
      var row = el("div", "row");
      var inline2 = compact ? false : actions.length <= 2 || !narrowScreen();
      if (inline2) {
        actions.forEach(function(a) {
          row.appendChild(a);
        });
        return row;
      }
      if (!compact)
        row.appendChild(actions[0]);
      var more = el("details", "actmore");
      more.appendChild(el("summary", "textbtn", t("more")));
      var menu = el("div", "menu");
      (compact ? actions : actions.slice(1)).forEach(function(a) {
        menu.appendChild(a);
      });
      more.appendChild(menu);
      more.addEventListener("toggle", function() {
        onMenu(more.hasAttribute("open"));
      });
      row.appendChild(more);
      return row;
    }
    function slipNode(it, newest, compact) {
      var id = safeID(it.id);
      var secret = !!it.secret;
      var card = el("article", newest ? "slip is-new" : "slip");
      card.setAttribute("data-kind", secret ? "secret" : it.kind);
      if (id)
        card.setAttribute("data-id", id);
      var head = el("div", "sliphead");
      var tagLabel = secret ? t("secretKind") : kindLabel(it.kind);
      var tagGlyph = secret ? "● " : kindGlyph(it.kind);
      var glyph = compact ? tagGlyph.replace(" ", "") : tagGlyph + tagLabel;
      var kindTag = el("span", "kindtag", glyph);
      if (compact)
        kindTag.setAttribute("title", tagLabel);
      head.appendChild(kindTag);
      head.appendChild(el("span", "meta", metaText(it, compact)));
      var actions = [];
      if (secret) {
        if (id && !it.takenAt) {
          var shown = !!state.revealed[id];
          if (shown) {
            var copy_1 = btn(t("copy"), function() {
              copyButtonText(state.revealed[id], copy_1);
            }, "textbtn");
            actions.push(copy_1);
          }
          actions.push(btn(shown ? t("previewClose") : t("open"), function() {
            if (state.revealed[id]) {
              delete state.revealed[id];
            } else {
              openSecret(it, id);
              return;
            }
            if (state.view === "board")
              renderBoard();
          }, "textbtn"));
        }
      } else if (it.kind === "text") {
        var copy_2 = btn(t("copy"), function() {
          copyButtonText(it.text || "", copy_2);
        }, "textbtn");
        actions.push(copy_2);
      }
      if (it.kind !== "text" && id && previewable(it)) {
        var open_1 = !!state.openPreview[id];
        actions.push(btn(open_1 ? t("previewClose") : t("previewFileOpen"), function() {
          if (state.openPreview[id]) {
            delete state.openPreview[id];
          } else {
            state.openPreview[id] = true;
            loadPreview(it, id);
          }
          if (state.view === "board")
            renderBoard();
        }, "textbtn"));
      } else if (!secret && it.kind === "text" && id && state.editing !== id && countLines(it.text || "") > textFoldLines) {
        var open_2 = !!state.openText[id];
        actions.push(btn(open_2 ? t("previewClose") : t("previewOpen"), function() {
          if (state.openText[id]) {
            delete state.openText[id];
          } else {
            state.openText[id] = true;
          }
          if (state.view === "board")
            renderBoard();
        }, "textbtn"));
      }
      if (!secret && it.kind === "text" && id && state.editing !== id) {
        actions.push(btn(t("edit"), function() {
          state.editing = id;
          if (state.view === "board")
            renderBoard();
        }, "textbtn"));
      }
      if (id && page.canPreview(it))
        actions.push(fileLink(t("view"), "/api/items/" + id + "/raw"));
      if (id && it.kind !== "text")
        actions.push(fileLink(t("download"), "/api/items/" + id + "/raw?dl=1"));
      if (id) {
        actions.push(confirmButton(t("remove"), t("confirmRemove"), function() {
          removeItem(id);
        }, "textbtn"));
      }
      head.appendChild(actionRow(actions, function(open) {
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
        var img = el("img", "shot");
        img.alt = it.name || t("imageKind");
        img.src = "/api/items/" + id + "/thumb";
        img.addEventListener("click", function() {
          openViewer(it, id);
        });
        card.appendChild(img);
      } else {
        var nameRow = el("p", "fname", it.name || t("fileKind"));
        card.appendChild(nameRow);
        if (id && previewable(it)) {
          var pv = previewBody(it, id);
          if (pv)
            card.appendChild(pv);
        }
      }
      return card;
    }
    function secretBody(it, id) {
      var shown = state.revealed[id];
      if (shown) {
        var wrap = el("div", "secretbody");
        wrap.appendChild(el("pre", "body", shown));
        wrap.appendChild(el("p", "hint", t("revealHides")));
        return wrap;
      }
      if (it.takenAt) {
        return el("p", "hint secretgone", t("takenBody"));
      }
      var box = el("div", "masked");
      var redact = el("div", "redact");
      redact.setAttribute("aria-hidden", "true");
      redact.appendChild(el("span", "redactline"));
      box.appendChild(redact);
      box.appendChild(el("p", "hint", it.burn ? t("burnHint") : t("secretExpiresHint")));
      if (state.askCode[id])
        box.appendChild(codePrompt(it, id));
      return box;
    }
    function codePrompt(it, id) {
      var wrap = el("div", "codeprompt");
      var group = el("div", "codegroup");
      var input = document.createElement("input");
      input.type = state.revealShow[id] ? "text" : "password";
      input.className = "codeinput";
      input.value = state.codeDraft[id] || "";
      input.placeholder = t("codeAsk");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "characters");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("aria-label", t("codeAsk"));
      input.addEventListener("input", function() {
        state.codeDraft[id] = input.value;
      });
      var go = btn(t("open"), function() {
        var code = (state.codeDraft[id] || "").replace(/^\s+|\s+$/g, "");
        if (code.length < 6) {
          state.codeErr[id] = t("codeTooShort");
          if (state.view === "board")
            renderBoard();
          return;
        }
        revealSecret(it, id, code);
      }, "gbtn is-primary");
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          go.click();
        }
      });
      var see = btn(state.revealShow[id] ? t("hide") : t("show"), function() {
        state.revealShow[id] = !state.revealShow[id];
        input.type = state.revealShow[id] ? "text" : "password";
        see.textContent = state.revealShow[id] ? t("hide") : t("show");
      }, "gbtn");
      group.appendChild(input);
      group.appendChild(see);
      group.appendChild(go);
      wrap.appendChild(group);
      if (state.codeErr[id])
        wrap.appendChild(el("p", "codeerr", state.codeErr[id]));
      return wrap;
    }
    function openSecret(it, id) {
      if (it.sealed) {
        state.askCode[id] = true;
        if (state.view === "board")
          renderBoard();
        return;
      }
      revealSecret(it, id, "");
    }
    function revealSecret(it, id, code) {
      postJSON("/api/items/" + id + "/reveal", { code: code }).then(function(body) {
        state.revealed[id] = body.text || "";
        delete state.askCode[id];
        delete state.codeDraft[id];
        delete state.codeErr[id];
        delete state.revealShow[id];
        if (body.burned) {
          it.takenAt = (/* @__PURE__ */ new Date()).toISOString();
          it.sealed = false;
          it.burn = false;
        }
        if (state.view === "board")
          renderBoard();
        setTimeout(function() {
          if (!state.revealed[id])
            return;
          delete state.revealed[id];
          if (state.view === "board")
            renderBoard();
        }, revealMillis);
      }, function(err) {
        var code2 = err && err.code || "";
        if (code2 === "wrong_code") {
          state.codeErr[id] = t("wrongCode");
          if (state.view === "board")
            renderBoard();
          return;
        }
        if (code2 === "code_required") {
          state.askCode[id] = true;
          if (state.view === "board")
            renderBoard();
          return;
        }
        if (code2 === "gone") {
          delete state.revealed[id];
          showNotice(t("secretGone"));
          reloadItems();
          return;
        }
        if (!guard(err))
          showErr(err);
      });
    }
    function textBody(it, id) {
      var body = el("pre", "body", it.text || "");
      if (countLines(it.text || "") <= textFoldLines)
        return body;
      if (state.editing === id)
        return body;
      var open = !!state.openText[id];
      if (!open)
        body.classList.add("folded");
      body.setAttribute("aria-expanded", open ? "true" : "false");
      return body;
    }
    function countLines(text) {
      var lines = text.split("\n");
      var n = 0;
      var i;
      for (i = 0; i < lines.length; i++) {
        var extra = Math.floor(lines[i].length / 40);
        n = n + 1 + extra;
      }
      return n;
    }
    function confirmButton(label, confirmLabel, act, cls) {
      var b = btn(label, function() {
        if (b.dataset.armed === "1") {
          act();
          return;
        }
        b.dataset.armed = "1";
        b.textContent = confirmLabel;
        b.classList.add("danger");
        setTimeout(function() {
          if (!b.isConnected)
            return;
          b.dataset.armed = "";
          b.textContent = label;
          b.classList.remove("danger");
        }, 3e3);
      });
      if (cls)
        b.className = cls;
      return b;
    }
    function previewBody(it, id) {
      if (!state.openPreview[id])
        return null;
      var wrap = el("div", "preview");
      if (state.previewText[id] === void 0) {
        wrap.appendChild(el("p", "hint", t("previewLoading")));
      } else if (state.previewText[id] === null) {
        wrap.appendChild(el("p", "hint", t("previewBinary")));
      } else if (isMarkdown(it.name, it.mime)) {
        var doc = el("div", "body previewbody md");
        doc.appendChild(render(state.previewText[id]));
        wrap.appendChild(doc);
      } else {
        wrap.appendChild(el("pre", "body previewbody", state.previewText[id]));
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
    function textEditor(it, id) {
      var wrap = el("div", "editor");
      var ta = el("textarea", "editor-input");
      ta.value = it.text || "";
      ta.setAttribute("autocorrect", "off");
      ta.setAttribute("autocapitalize", "off");
      ta.spellcheck = false;
      wrap.appendChild(ta);
      var err = el("p", "err", "");
      err.hidden = true;
      wrap.appendChild(err);
      var row = el("div", "row");
      var cancel = btn(t("cancel"), function() {
        state.editing = "";
        if (state.view === "board")
          renderBoard();
      }, "textbtn");
      var save = btn(t("save"), function() {
        var text = ta.value;
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
        api("/api/items/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text })
        }).then(function(body) {
          state.editing = "";
          state.items = state.items.map(function(x) {
            return x.id === id ? body.item : x;
          });
          if (state.view === "board")
            renderBoard();
          say(t("saved"));
        }).catch(function(e) {
          if (guard(e))
            return;
          save.disabled = false;
          save.textContent = t("save");
          err.hidden = false;
          err.textContent = errText(e);
        });
      }, "seal");
      row.appendChild(cancel);
      row.appendChild(save);
      wrap.appendChild(row);
      ta.addEventListener("keydown", function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          save.click();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel.click();
        }
      });
      setTimeout(function() {
        ta.focus();
      }, 0);
      return wrap;
    }
    function openViewer(it, id) {
      state.viewer = { id: id, name: it.name || t("imageKind") };
      paintViewer();
    }
    function imageItems() {
      return state.items.filter(function(x) {
        return x.kind === "image" && safeID(x.id) !== "";
      });
    }
    function viewerStep(step) {
      var list = imageItems();
      if (!state.viewer || list.length < 2)
        return;
      var at = -1;
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === state.viewer.id)
          at = i;
      }
      if (at === -1)
        return;
      var next = (at + step + list.length) % list.length;
      state.viewer = { id: list[next].id, name: list[next].name || t("imageKind") };
      paintViewer();
    }
    function closeViewer() {
      state.viewer = null;
      paintViewer();
    }
    function paintViewer() {
      var layer = document.getElementById("viewer");
      if (!state.viewer) {
        if (layer && layer.parentNode)
          layer.parentNode.removeChild(layer);
        return;
      }
      if (!layer) {
        layer = el("div", "viewer");
        layer.id = "viewer";
        layer.setAttribute("role", "dialog");
        layer.setAttribute("aria-modal", "true");
        layer.addEventListener("click", function(e) {
          if (e.target === layer)
            closeViewer();
        });
        document.body.appendChild(layer);
      }
      clear(layer);
      var id = state.viewer.id;
      var img = el("img", "viewer-img");
      img.alt = state.viewer.name;
      img.src = "/api/items/" + safeID(id) + "/raw";
      layer.appendChild(img);
      var bar = el("div", "viewer-bar");
      var many = imageItems().length > 1;
      if (many) {
        bar.appendChild(btn("<", function() {
          viewerStep(-1);
        }, "viewer-btn"));
      }
      bar.appendChild(el("span", "viewer-name", state.viewer.name));
      if (many) {
        bar.appendChild(btn(">", function() {
          viewerStep(1);
        }, "viewer-btn"));
      }
      var copyB = btn(t("copy"), function() {
        copyImage(id, copyB);
      }, "viewer-btn");
      bar.appendChild(copyB);
      var dl = el("a", "viewer-btn", t("download"));
      dl.href = "/api/items/" + safeID(id) + "/raw?dl=1";
      bar.appendChild(dl);
      bar.appendChild(btn(t("close"), closeViewer, "viewer-btn"));
      layer.appendChild(bar);
    }
    function copyImage(id, button) {
      var url = "/api/items/" + id + "/raw";
      var label = button.textContent;
      fetch(url, { credentials: "same-origin" }).then(function(res) {
        if (!res.ok)
          throw new Error("bad status");
        return res.blob();
      }).then(function(blob) {
        var _a;
        if (!navigator.clipboard || typeof navigator.clipboard.write !== "function") {
          throw new Error("no clipboard.write");
        }
        return navigator.clipboard.write([new ClipboardItem((_a = {}, _a[blob.type] = blob, _a))]).then(function() {
          button.textContent = t("copied");
          say(t("copied"));
          setTimeout(function() {
            if (button.isConnected)
              button.textContent = label;
          }, 1600);
        });
      }).catch(function() {
        copyText(location.origin + url).then(function(ok) {
          say(ok ? t("copied") : t("copyFail"));
          button.textContent = ok ? t("copied") : label;
          setTimeout(function() {
            if (button.isConnected)
              button.textContent = label;
          }, 1600);
        });
      });
    }
    function removeItem(id) {
      var secret = false;
      var i;
      for (i = 0; i < state.items.length; i++) {
        if (state.items[i].id === id && state.items[i].secret)
          secret = true;
      }
      api("/api/items/" + id, { method: "DELETE" }).then(function() {
        state.items = state.items.filter(function(it) {
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
        if (secret) {
          say(t("secretRemoved"));
        } else {
          queueUndo([id]);
        }
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
      node.undo.appendChild(el("span", "", t("removedUndo")));
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
      var about = el("div", "sheet");
      about.appendChild(el("p", "hint", t("settingsSecret")));
      node.main.appendChild(about);
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
            state.openText = {};
            state.previewText = {};
            state.revealed = {};
            state.askCode = {};
            state.codeDraft = {};
            state.codeErr = {};
            state.view = "board";
            var ids = body.ids || [];
            if (ids.length)
              queueUndo(ids);
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
      node.main.appendChild(versionSheet(boot));
    }
    function versionSheet(boot) {
      var sheet = el("div", "sheet");
      sheet.appendChild(el("p", "lead", t("version")));
      var row = el("div", "urlrow");
      row.appendChild(el("div", "url", boot.version || ""));
      var check = btn(t("checkUpdate"), function() {
        check.disabled = true;
        check.textContent = t("checking");
        api("/api/update").then(function(body) {
          state.update = body;
          if (state.view === "settings")
            renderSettings();
        }).catch(function(err) {
          check.disabled = false;
          check.textContent = t("checkUpdate");
          if (!guard(err))
            showErr(err);
        });
      }, "textbtn");
      row.appendChild(check);
      sheet.appendChild(row);
      var got = state.update;
      if (got) {
        if (got.error) {
          sheet.appendChild(el("p", "hint", t("updateFailed")));
        } else if (got.newer) {
          var line = el("p", "hint");
          line.appendChild(document.createTextNode(t("updateFound") + " " + (got.latest || " ") + " · "));
          line.appendChild(fileLink(t("releasePage"), got.url || ""));
          sheet.appendChild(line);
        } else {
          sheet.appendChild(el("p", "hint", t("updateLatest")));
        }
      }
      return sheet;
    }
    function closeMenus() {
      document.addEventListener("click", function(e) {
        var target = e.target;
        var open = document.querySelectorAll("details.actmore[open]");
        var i;
        for (i = 0; i < open.length; i++) {
          var at = open[i];
          if (!at.contains(target))
            at.removeAttribute("open");
        }
      });
    }
    installDragHandlers();
    installKeys();
    startSecretClock();
    closeMenus();
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
    renderMarkdown: render,
    isMarkdown: isMarkdown,
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
