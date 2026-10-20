"use strict";
(function() {
  // ../.webuild/boot.js
  (function() {
    var theme = "light";
    var lang = "zh";
    try {
      var savedTheme = localStorage.getItem("slip.theme");
      var savedLang = localStorage.getItem("slip.lang");
      if (savedTheme === "dark")
        theme = "dark";
      if (savedLang === "en")
        lang = "en";
    } catch (e) {
    }
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-lang", lang);
    root.lang = lang === "en" ? "en" : "zh-CN";
    document.title = lang === "en" ? "Slip" : "纸条";
    var meta = document.getElementById("theme-color");
    if (meta)
      meta.setAttribute("content", theme === "dark" ? "#1a1816" : "#f3efe6");
  })();
})();
