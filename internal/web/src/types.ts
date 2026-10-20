// Types shared by the page controllers. They mirror the JSON that
// internal/server writes, so a change there is the only place to follow.
// This file is type-only: every declaration is erased.

export type Lang = "zh" | "en";

export type Theme = "light" | "dark";

export type View = "loading" | "setup" | "waiting" | "login" | "board" | "settings";

// Item is one slip as the browser sees it. Optional fields are absent
// when the server leaves them empty.
export interface Item {
  id: string;
  kind: string;
  createdAt: string;
  text?: string;
  name?: string;
  size?: number;
  mime?: string;
  hasThumb?: boolean;
}

export interface Bootstrap {
  ready: boolean;
  authed: boolean;
  loopback: boolean;
  version: string;
  port: number;
  urls?: string[];
  used?: number;
  limit?: number;
}

export interface ItemsBody {
  items: Item[];
  hasMore: boolean;
}

// ApiError is what core's request helper throws on a failed call.
export interface ApiError extends Error {
  code?: string;
  status?: number;
}

export interface RunLabels {
  busy: string;
  idle: string;
}

export interface FormReply {
  ok: boolean;
  code?: string;
}

// Page is the narrow slice of the DOM and the browser that the core
// needs. The modern and legacy pages each provide one. Keeping this
// interface small is what lets one controller serve both.
export interface Page {
  // say shows a status line for assistive technology.
  say(text: string): void;

  // setTheme and setLang persist and apply the choice.
  setTheme(theme: Theme): void;
  setLang(lang: Lang): void;

  // canPreview reports whether pressing View in a new tab works here.
  canPreview(item: Item): boolean;

  // previewText fetches a text attachment so it can be read in place.
  // It resolves to null when the body is not text or is unavailable.
  previewText(item: Item, done: (text: string | null) => void): void;

  // syncDropZone updates the page-wide drag feedback.
  setDragging(on: boolean): void;

  // uploadProgress is called with the completed count while a batch
  // uploads. The 50 MB per file cap is checked before this runs.
  uploadBatch(files: File[], done: (ok: boolean) => void): void;
}
