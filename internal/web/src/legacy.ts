// legacy.ts is the page for iOS 12, which is where the iPad mini 2
// stops. It uses the same controller as the modern page. What it does
// not do is drag and drop, an overlay, or reading a text attachment in
// place: that hardware saves a picture by opening it and pressing and
// holding, and the rest of the interaction stays plain.

import type { Item, Page } from "./types";

const S = (window as any).Slip;

(function () {
  const node = {
    main: document.getElementById("main") as HTMLElement,
    nav: document.getElementById("nav") as HTMLElement,
    undo: document.getElementById("undo") as HTMLElement,
    live: document.getElementById("live") as HTMLElement,
    mark: document.getElementById("mark") as HTMLElement,
    switchLink: document.getElementById("modern-link") as HTMLElement,
    switchLabel: function (): string {
      return S.t("modern");
    }
  };

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
      return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp";
    },

    // No in-place reading here. The link and Download stay available.
    previewText: function (_it: Item, done): void {
      done(null);
    },

    // This page has no drag and drop.
    setDragging: function (_on: boolean): void {},

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
