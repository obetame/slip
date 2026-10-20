// clip.ts reads what the user pasted or dropped and sorts it into the
// three things the board accepts: files, plain text, and a URL.

import { t } from "./i18n";

// isURL is a deliberately narrow check. It only needs to catch the
// common case of a single pasted address.
export function isURL(text: string): boolean {
  const s = text.trim();
  if (!s || s.indexOf(" ") !== -1 || s.indexOf("\n") !== -1) return false;
  return /^https?:\/\/\S+$/i.test(s) || /^www\.\S+\.\S+$/i.test(s);
}

// looksLikeFile reports whether a plain text paste should become an
// attachment rather than a slip. Long pastes are easier to keep as a
// file, and the server caps slips at 200 KB.
export function looksLikeFile(text: string, cap: number): boolean {
  return text.length > 0 && utf8Length(text) > cap;
}

function utf8Length(s: string): number {
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

export function stripURL(text: string): string {
  const s = text.trim();
  if (/^www\./i.test(s)) return "http://" + s;
  return s;
}

// imageFiles pulls images out of a clipboard event. Returns an empty
// array when there is nothing to take.
export function imageFiles(cd: DataTransfer | null): File[] {
  const out: File[] = [];
  if (!cd) return out;
  let i;
  if (cd.files && cd.files.length) {
    for (i = 0; i < cd.files.length; i++) {
      if (cd.files[i].type.indexOf("image/") === 0) out.push(cd.files[i]);
    }
  }
  if (out.length || !cd.items) return out;
  for (i = 0; i < cd.items.length; i++) {
    const item = cd.items[i];
    if (item.kind === "file" && item.type.indexOf("image/") === 0) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

// allFiles takes every file in a clipboard event or a drop.
export function allFiles(cd: DataTransfer | null): File[] {
  const out: File[] = [];
  if (!cd) return out;
  let i;
  if (cd.files && cd.files.length) {
    for (i = 0; i < cd.files.length; i++) out.push(cd.files[i]);
  }
  if (out.length || !cd.items) return out;
  for (i = 0; i < cd.items.length; i++) {
    const item = cd.items[i];
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

// typeText names the paste kinds the page needs to distinguish.
export type PasteKind = "image" | "files" | "url" | "text" | "none";

export function classifyPaste(cd: DataTransfer | null, textCap: number): { kind: PasteKind; text: string; files: File[] } {
  const text = cd ? cd.getData("text/plain") || "" : "";
  const files = cd ? allFiles(cd) : [];
  if (files.length) {
    let onlyImages = true;
    let i;
    for (i = 0; i < files.length; i++) {
      if (files[i].type.indexOf("image/") !== 0) onlyImages = false;
    }
    return { kind: onlyImages ? "image" : "files", text: text, files: files };
  }
  const trimmed = text.trim();
  if (!trimmed) return { kind: "none", text: "", files: [] };
  if (isURL(trimmed)) return { kind: "url", text: stripURL(trimmed), files: [] };
  if (looksLikeFile(text, textCap)) return { kind: "files", text: text, files: [] };
  return { kind: "text", text: text, files: [] };
}

// previewable decides whether an attachment can be shown as text in
// place. Only plain text types qualify. HTML and SVG are excluded on
// purpose: they are same-origin documents and must never be rendered.
export function previewable(item: { mime?: string; name?: string; size?: number }): boolean {
  const mime = String(item.mime || "").toLowerCase();
  if (!mime || mime.indexOf("text/") === 0) {
    const name = String(item.name || "").toLowerCase();
    const dot = name.lastIndexOf(".");
    const ext = dot === -1 ? "" : name.slice(dot);
    switch (ext) {
      case ".html":
      case ".htm":
      case ".svg":
      case ".xml":
      case ".xhtml":
        return false;
    }
    if (mime && mime.indexOf("text/html") === 0) return false;
    if (mime && mime.indexOf("text/xml") === 0) return false;
    if (mime && mime.indexOf("application/xml") === 0) return false;
    return true;
  }
  return (
    mime === "application/json" ||
    mime === "application/javascript" ||
    mime === "application/x-yaml" ||
    mime === "application/toml"
  );
}

export { t };
