// format holds the small presentation helpers. They never throw on
// odd input, because they sit on the path that renders a slip.

import { t, lang } from "./i18n";
import type { Lang } from "./types";

export function storeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export function storeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Private mode and full quotas both land here. The choice just does
    // not persist; the page still works.
  }
}

export function themeNow(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// byteLength counts UTF-8 bytes, which is what the 200 KB text cap
// measures on the server.
export function byteLength(s: string): number {
  let n = 0;
  let i;
  for (i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) n = n + 1;
    else if (c < 2048) n = n + 2;
    else if (c >= 55296 && c <= 56319) {
      n = n + 4;
      i = i + 1;
    } else n = n + 3;
  }
  return n;
}

export function formatBytes(n: number): string {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  const units = ["KB", "MB", "GB"];
  let i = -1;
  do {
    n = n / 1024;
    i = i + 1;
  } while (n >= 1024 && i < units.length - 1);
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return rounded + " " + units[i];
}

function two(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const hm = two(d.getHours()) + ":" + two(d.getMinutes());
  if (d.toDateString() === now.toDateString()) return t("today") + " " + hm;
  const yest = new Date(now.getTime());
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return t("yesterday") + " " + hm;
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + hm;
}

// safeID keeps a server id usable in a URL and drops anything else.
export function safeID(id: string): string {
  return /^[0-9a-fA-F]{16}$/.test(id) ? id : "";
}

export function kindLabel(kind: string): string {
  if (kind === "image") return t("imageKind");
  if (kind === "file") return t("fileKind");
  return t("textKind");
}

// langNow re-exports the current language for callers that build URLs.
export function langNow(): Lang {
  return lang();
}
