// api.ts is the only place that talks to the server. Every request
// carries the X-Slip header, which is what the server uses to tell a
// deliberate write from a cross-site one.

import { t } from "./i18n";
import type { ApiError } from "./types";

export type Opts = {
  method?: string;
  headers?: { [name: string]: string };
  body?: any;
};

export function api<T>(path: string, opts?: Opts): Promise<T> {
  opts = opts || {};
  const headers: { [name: string]: string } = opts.headers || {};
  headers["X-Slip"] = "1";
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
