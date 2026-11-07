// Types shared by the page controllers. They mirror the JSON that
// internal/server writes, so a change there is the only place to follow.
// This file is type-only: every declaration is erased.

export type Lang = "zh" | "en";

export type Theme = "light" | "dark";

export type View = "loading" | "setup" | "waiting" | "login" | "board" | "settings";

// Transfer is the trace a handoff leaves on the board. There is no file
// behind it: the bytes went from one device to the other.
export interface Transfer {
  from: string;
  fromId?: string;
  to?: string;
  toId?: string;
  sha256: string;
  durationMs?: number;
}

// Item is one slip as the browser sees it. Optional fields are absent
// when the server leaves them empty.
export interface Item {
  id: string;
  kind: string;
  createdAt: string;
  editedAt?: string;
  text?: string;
  name?: string;
  size?: number;
  mime?: string;
  hasThumb?: boolean;
  // A secret slip never carries its body here. Sealed means the body is
  // ciphertext, so reading it needs the code that opened it. TakenAt marks
  // the tombstone a burn slip leaves behind.
  secret?: boolean;
  sealed?: boolean;
  expiresAt?: string;
  burn?: boolean;
  takenAt?: string;

  // transfer is the trace a handoff leaves. There is no file behind it.
  transfer?: Transfer;
}

// RevealBody is what POST /api/items/{id}/reveal answers with.
export interface RevealBody {
  text: string;
  burned: boolean;
}

// Device is one browser that has talked to slip recently. There are no
// accounts, so this is only "something is open right now".
export interface Device {
  id: string;
  name: string;
}

// HandoffView is one live card: an offer nobody has taken, or a
// transfer in flight. It never carries bytes.
export interface HandoffView {
  id: string;
  name: string;
  size: number;
  mime?: string;
  state: string;
  from: string;
  fromId: string;
  to?: string;
  toId?: string;
  mine?: boolean;
  sent: number;
  sha256?: string;
  durationMs?: number;
  expiresAt: string;
  // gen is the attempt number. A change means the pipe was replaced and
  // the upload has to start over.
  gen?: number;
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
  device?: Device;
}

export interface ItemsBody {
  items: Item[];
  hasMore: boolean;
  device?: Device;
  devices?: Device[];
  handoffs?: HandoffView[];
}

// UpdateBody answers the check in Settings. Error is set instead of the
// release fields when GitHub could not be reached.
export interface UpdateBody {
  current: string;
  latest?: string;
  url?: string;
  newer?: boolean;
  error?: string;
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
