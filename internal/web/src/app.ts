// app.ts is the modern page. Everything that both pages share lives in
// board.ts; this file only supplies what differs: status output, the
// drag overlay, how a batch uploads, which files View can open, and
// reading a text attachment in place.

import type { Item, Page } from "./types";

const S = (window as any).Slip;

(function () {
  const node = {
    main: document.getElementById("main") as HTMLElement,
    nav: document.getElementById("nav") as HTMLElement,
    undo: document.getElementById("undo") as HTMLElement,
    live: document.getElementById("live") as HTMLElement,
    mark: document.getElementById("mark") as HTMLElement,
    switchLink: document.getElementById("legacy-link") as HTMLElement,
    switchLabel: function (): string {
      return S.t("legacy");
    }
  };

  // The overlay is created once and toggled, so dragging does not
  // rebuild the DOM on every dragenter.
  let overlay: HTMLElement | null = null;

  function ensureOverlay(): HTMLElement {
    if (overlay) return overlay;
    const o = document.createElement("div");
    o.className = "dropzone";
    o.hidden = true;
    const label = document.createElement("div");
    label.className = "dropzone-label";
    o.appendChild(label);
    document.body.appendChild(o);
    overlay = o;
    return o;
  }

  const page: Page = {
    say: function (text: string): void {
      const live = document.getElementById("live");
      if (live) live.textContent = text || "";
    },

    setTheme: function (theme): void {
      S.storeSet("slip.theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      const meta = document.getElementById("theme-color");
      if (meta) meta.setAttribute("content", theme === "dark" ? "#1a1816" : "#f3efe6");
    },

    setLang: function (next): void {
      S.storeSet("slip.lang", next);
      document.documentElement.setAttribute("data-lang", next);
    },

    canPreview: function (it: Item): boolean {
      const m = String(it.mime || "").toLowerCase();
      return (
        m === "image/jpeg" ||
        m === "image/png" ||
        m === "image/gif" ||
        m === "image/webp" ||
        m === "application/pdf"
      );
    },

    previewText: function (it: Item, done): void {
      const id = S.safeID(it.id);
      if (!id) {
        done(null);
        return;
      }
      fetch("/api/items/" + id + "/raw", { credentials: "same-origin", headers: { "X-Slip": "1" } })
        .then(function (res) {
          if (!res.ok) {
            done(null);
            return null;
          }
          return res.text();
        })
        .then(function (text) {
          if (text == null) return;
          // A NUL byte in the first chunk means it is not text.
          if (text.indexOf("\u0000") !== -1) {
            done(null);
            return;
          }
          done(text);
        })
        .catch(function () {
          done(null);
        });
    },

    setDragging: function (on: boolean): void {
      const o = ensureOverlay();
      o.hidden = !on;
      const label = o.firstChild as HTMLElement;
      if (label) label.textContent = S.t("dragHint");
    },

    uploadBatch: function (files: File[], done): void {
      const fd = new FormData();
      let i;
      for (i = 0; i < files.length; i++) fd.append("file", files[i], files[i].name);
      S.api("/api/files", { method: "POST", body: fd }).then(
        function () {
          done(true);
        },
        function () {
          done(false);
        }
      );
    }
  };

  S.start(page, node);
})();
