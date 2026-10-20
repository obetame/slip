(function() {
  // ../.webuild/legacy.js
  var S = window.Slip;
  (function() {
    var node = {
      main: document.getElementById("main"),
      nav: document.getElementById("nav"),
      undo: document.getElementById("undo"),
      live: document.getElementById("live"),
      mark: document.getElementById("mark"),
      switchLink: document.getElementById("modern-link"),
      switchLabel: function() {
        return S.t("modern");
      }
    };
    var page = {
      say: function(text) {
        var live = document.getElementById("live");
        if (live)
          live.textContent = text || "";
      },
      setTheme: function(theme) {
        S.storeSet("slip.theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
        var meta = document.getElementById("theme-color");
        if (meta)
          meta.setAttribute("content", theme === "dark" ? "#1a1816" : "#f3efe6");
      },
      setLang: function(next) {
        S.storeSet("slip.lang", next);
        document.documentElement.setAttribute("data-lang", next);
      },
      canPreview: function(it) {
        var m = String(it.mime || "").toLowerCase();
        return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp";
      },
      // No in-place reading here. The link and Download stay available.
      previewText: function(_it, done) {
        done(null);
      },
      // This page has no drag and drop.
      setDragging: function(_on) {
      },
      uploadBatch: function(files, done) {
        var fd = new FormData();
        var i;
        for (i = 0; i < files.length; i++)
          fd.append("file", files[i], files[i].name);
        S.api("/api/files", { method: "POST", body: fd }).then(function() {
          done(true);
        }, function() {
          done(false);
        });
      }
    };
    S.start(page, node);
  })();
})();
