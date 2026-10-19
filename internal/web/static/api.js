(function () {
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
      version: "版本"
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
      version: "Version"
    }
  };

  function lang() {
    return document.documentElement.getAttribute("data-lang") === "en" ? "en" : "zh";
  }

  function t(key) {
    var table = STR[lang()] || STR.zh;
    if (table[key]) return table[key];
    if (STR.zh[key]) return STR.zh[key];
    return key;
  }

  function storeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["X-Slip"] = "1";
    opts.headers = headers;
    opts.credentials = "same-origin";
    return fetch(path, opts).then(function (res) {
      var ct = res.headers.get("Content-Type") || "";
      if (ct.indexOf("json") !== -1) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error((body && body.error) || "bad_request");
            err.code = body && body.error;
            err.status = res.status;
            throw err;
          }
          return body;
        });
      }
      if (!res.ok) {
        var err2 = new Error("bad_request");
        err2.code = "bad_request";
        err2.status = res.status;
        throw err2;
      }
      return null;
    });
  }

  function errText(err) {
    if (!err || !err.code) return t("errorNet");
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
    if (map[err.code]) return t(map[err.code]);
    return t("errorGeneric");
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.className = "copy-buffer";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, ta.value.length); } catch (e) {}
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          resolve(true);
        }, function () {
          resolve(legacyCopy(text));
        });
        return;
      }
      resolve(legacyCopy(text));
    });
  }

  function byteLength(s) {
    var n = 0;
    var i;
    for (i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) n = n + 1;
      else if (c < 2048) n = n + 2;
      else if (c >= 55296 && c <= 56319) {
        n = n + 4;
        i = i + 1;
      } else n = n + 3;
    }
    return n;
  }

  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
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
    if (isNaN(d.getTime())) return "";
    var now = new Date();
    var hm = two(d.getHours()) + ":" + two(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return t("today") + " " + hm;
    var yest = new Date(now.getTime());
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return t("yesterday") + " " + hm;
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + hm;
  }

  window.Slip = {
    t: t,
    lang: lang,
    api: api,
    errText: errText,
    copyText: copyText,
    byteLength: byteLength,
    formatBytes: formatBytes,
    formatTime: formatTime,
    storeGet: storeGet,
    storeSet: storeSet
  };
})();
