(function() {
  // ../.webuild/app.js
  var S = window.Slip;
  (function() {
    var node = {
      main: document.getElementById("main"),
      nav: document.getElementById("nav"),
      undo: document.getElementById("undo"),
      live: document.getElementById("live"),
      mark: document.getElementById("mark"),
      switchLink: document.getElementById("legacy-link"),
      switchLabel: function() {
        return S.t("legacy");
      }
    };
    var overlay = null;
    function ensureOverlay() {
      if (overlay)
        return overlay;
      var o = document.createElement("div");
      o.className = "dropzone";
      o.hidden = true;
      var label = document.createElement("div");
      label.className = "dropzone-label";
      o.appendChild(label);
      document.body.appendChild(o);
      overlay = o;
      return o;
    }
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
        return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp" || m === "application/pdf";
      },
      previewText: function(it, done) {
        var id = S.safeID(it.id);
        if (!id) {
          done(null);
          return;
        }
        fetch("/api/items/" + id + "/raw", { credentials: "same-origin", headers: { "X-Slip": "1" } }).then(function(res) {
          if (!res.ok) {
            done(null);
            return null;
          }
          return res.text();
        }).then(function(text) {
          if (text == null)
            return;
          if (text.indexOf("\0") !== -1) {
            done(null);
            return;
          }
          done(text);
        }).catch(function() {
          done(null);
        });
      },
      setDragging: function(on) {
        var o = ensureOverlay();
        o.hidden = !on;
        var label = o.firstChild;
        if (label)
          label.textContent = S.t("dragHint");
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
