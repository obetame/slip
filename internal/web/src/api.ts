// api.ts is the only place that talks to the server. Every request
// carries the X-Slip header, which is what the server uses to tell a
// deliberate write from a cross-site one.

import { t } from "./i18n";
import { storeGet, storeSet } from "./format";
import type { ApiError } from "./types";

export type Opts = {
  method?: string;
  headers?: { [name: string]: string };
  body?: any;
};

// deviceTag names this browser so a burn slip can tell the browser that put it
// down from one that came to read it. It is not an identity and nothing trusts
// it: the value only decides whether a refresh on the same phone burns the
// token you pasted on your laptop. It lives in localStorage beside the theme.
export function deviceTag(): string {
  const saved = storeGet("slip.dev");
  if (saved && /^[0-9a-f]{16}$/.test(saved)) return saved;
  const fresh = randomHex();
  storeSet("slip.dev", fresh);
  return fresh;
}

function randomHex(): string {
  const bytes: number[] = [];
  let i;
  const c = (window as any).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint8Array(8);
    c.getRandomValues(buf);
    for (i = 0; i < buf.length; i++) bytes.push(buf[i]);
  } else {
    // No Web Crypto: the tag only names a browser, it protects nothing.
    for (i = 0; i < 8; i++) bytes.push(Math.floor(Math.random() * 256));
  }
  let out = "";
  for (i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return out;
}

export function api<T>(path: string, opts?: Opts): Promise<T> {
  opts = opts || {};
  const headers: { [name: string]: string } = opts.headers || {};
  headers["X-Slip"] = "1";
  headers["X-Slip-Device"] = deviceTag();
  opts.headers = headers;
  (opts as any).credentials = "same-origin";
  return fetch(path, opts as RequestInit).then(function (res) {
    const ct = res.headers.get("Content-Type") || "";
    if (ct.indexOf("json") !== -1) {
      return res.json().then(function (body: any) {
        if (!res.ok) {
          const err = new Error((body && body.error) || "bad_request") as ApiError;
          err.code = body && body.error;
          err.status = res.status;
          throw err;
        }
        return body as T;
      });
    }
    if (!res.ok) {
      const err = new Error("bad_request") as ApiError;
      err.code = "bad_request";
      err.status = res.status;
      throw err;
    }
    return null as any as T;
  });
}

export function postJSON<T>(path: string, obj: any): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  });
}

// codeErr makes a client-side error that looks like a server one, so
// the same message lookup handles both.
export function codeErr(code: string): ApiError {
  const err = new Error(code) as ApiError;
  err.code = code;
  return err;
}

// errText turns an error into a sentence in the current language.
export function errText(err: ApiError | null | undefined): string {
  if (!err || !err.code) return t("errorNet");
  const map: { [code: string]: string } = {
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
  const key = err.code ? map[err.code] : "";
  if (key) return t(key);
  return t("errorGeneric");
}

// reply runs a call and reports failure as a code instead of throwing,
// for callers that are not built around promises.
export function reply(work: Promise<any>, done: (scenario: { ok: boolean; code?: string }) => void): void {
  work.then(
    function () {
      done({ ok: true });
    },
    function (err: ApiError) {
      done({ ok: false, code: (err && err.code) || "bad_request" });
    }
  );
}
