// core.ts is the entry the two pages share. It puts the helpers on
// window.Slip so app.js and legacy.js can reach them without an import
// cycle, and it exposes the controller entry point.

import { api, postJSON, codeErr, errText } from "./api";
import { btn, clear, el } from "./dom";
import { t, lang } from "./i18n";
import { byteLength, formatBytes, formatTime, kindLabel, safeID, storeGet, storeSet, themeNow } from "./format";
import { copyText } from "./clipboard";
import { classifyPaste, previewable, isURL } from "./clip";
import { start } from "./board";
import type { Page } from "./types";

const w = window as any;

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

export type { Page };
