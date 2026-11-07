// handoff.ts owns the "hand me that file" flow. Three things happen
// here and nowhere else:
//
//   1. an offer goes up as metadata only, so the board can show a card
//      before a single byte exists;
//   2. once the other side takes it, this page streams the file with
//      XHR, because only XHR reports upload progress;
//   3. the receiver hands the download to the browser itself, which is
//      the only thing on a plain HTTP origin that can write a large
//      file to disk without holding it in memory.
//
// Nothing here keeps the file. The server pipes it and forgets it.

import { api, postJSON } from "./api";
import { btn, clear, el } from "./dom";
import { t } from "./i18n";
import { formatBytes } from "./format";
import type { Device, HandoffView, ItemsBody } from "./types";

// HandoffHost is what this module needs from the page it lives on.
export interface HandoffHost {
  say(text: string): void;
  showErr(err: any): void;
  notice(text: string): void;
  reload(): void;
}

let hostRef: HandoffHost | null = null;
let zone: HTMLElement | null = null;
let picker: HTMLInputElement | null = null;
let cards: HandoffView[] = [];
let peers: Device[] = [];
let self = "";
// myOffer is the card this tab is responsible for uploading. It is not
// persisted: after a reload the card is still on the board but this tab
// can no longer push it, so only Cancel is offered.
let myOffer = "";
let pending: File | null = null;
let pushing: { [id: string]: boolean } = {};
let accepting: { [id: string]: boolean } = {};
let sent: { [id: string]: number } = {};
// gen is the attempt number this page last sent for. When the server
// replaces the pipe, it bumps the generation and the page sends again.
let gen: { [id: string]: number } = {};
let fast = 0;
let lastPaint = 0;

// throttle is how often a progress repaint may happen. Upload events
// arrive far faster than a bar needs to move.
const throttle = 200;

export function host(h: HandoffHost): void {
  hostRef = h;
}

// selfID is this browser's device id, as the server sees it. A record
// uses it to say whether the file went out or came in.
export function selfID(): string {
  return self;
}

// pickButton is the entry point in the composer. It keeps its own file
// input, because the drop zone's one is wired to the ordinary upload.
export function pickButton(label: string): HTMLButtonElement {
  const b = btn(label, openPicker, "textbtn");
  b.title = t("hoSendHint");
  return b;
}

function openPicker(): void {
  if (!picker) {
    const input = el("input") as HTMLInputElement;
    input.type = "file";
    input.className = "clip";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.addEventListener("change", function () {
      const f = input.files && input.files[0];
      input.value = "";
      if (f) offer(f);
    });
    document.body.appendChild(input);
    picker = input;
  }
  picker.click();
}

// mount puts the card zone back under the composer. The board rebuilds
// its whole main element on every render, so this runs again each time
// and re-appends the same node rather than making a new one.
export function mount(parent: HTMLElement): void {
  if (!zone) zone = el("section", "handoff");
  parent.appendChild(zone);
  paint();
}

// live takes the block the poll folded in. It is also where an accepted
// offer turns into an upload.
export function live(body: ItemsBody): void {
  if (body.device) self = body.device.id;
  peers = body.devices || [];
  cards = body.handoffs || [];
  let i;
  for (i = 0; i < cards.length; i++) {
    const h = cards[i];
    if (h.id !== myOffer || !pending || pushing[h.id]) continue;
    if (h.state !== "accepted") continue;
    if (gen[h.id] === (h.gen || 0)) continue;
    // A new attempt: the old pipe is dead, so this file goes again from
    // the beginning. The consent and the card survive; only the bytes
    // start over.
    if (gen[h.id] !== undefined && hostRef) hostRef.notice(t("hoAgain"));
    startPush(h.id, pending, h.gen || 0);
  }
  paint();
  if (busy()) startFast();
  else stopFast();
}

// offer opens the card. Nothing but the name, size, and type is sent.
function offer(f: File): void {
  if (!hostRef) return;
  if (f.size <= 0) {
    hostRef.notice(t("hoFailed"));
    return;
  }
  pending = f;
  postJSON<{ handoff: HandoffView }>("/api/handoff", {
    name: f.name,
    size: f.size,
    mime: f.type || "application/octet-stream",
    to: ""
  }).then(
    function (r) {
      myOffer = r.handoff.id;
      cards = [r.handoff].concat(cards);
      paint();
      startFast();
      if (hostRef) {
        hostRef.say(t("hoKeep"));
        if (!peers.length) hostRef.notice(t("hoNobody"));
      }
    },
    function (err) {
      pending = null;
      if (hostRef) hostRef.showErr(err);
    }
  );
}

// startPush streams the file. XHR rather than fetch: upload progress
// exists only on XHR, and a two gigabyte transfer with no progress is
// indistinguishable from a stuck one.
function startPush(id: string, f: File, attempt: number): void {
  pushing[id] = true;
  sent[id] = 0;
  gen[id] = attempt;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/handoff/" + id + "/push");
  xhr.setRequestHeader("X-Slip", "1");
  xhr.setRequestHeader("Content-Type", "application/octet-stream");
  xhr.upload.onprogress = function (e) {
    if (!e.lengthComputable) return;
    sent[id] = e.loaded;
    paintSoon();
  };
  xhr.onload = function () {
    delete pushing[id];
    if (xhr.status >= 200 && xhr.status < 300) {
      myOffer = "";
      pending = null;
      if (hostRef) {
        hostRef.notice(t("hoDone"));
        hostRef.reload();
      }
    } else if (isRestart(xhr)) {
      // The reader was replaced. The poll starts the next attempt on
      // its own, so this is not a failure and must not be reported as
      // one.
    } else if (hostRef) {
      hostRef.notice(t("hoFailed"));
    }
    paint();
  };
  xhr.onerror = function () {
    delete pushing[id];
    if (hostRef) hostRef.notice(t("errorNet"));
    paint();
  };
  xhr.onabort = function () {
    delete pushing[id];
    paint();
  };
  xhr.send(f);
  paint();
}

// isRestart tells a replaced pipe apart from a real failure. The server
// answers 409 with this code when it has already moved on to a fresh
// attempt, and that is not something to report as an error.
function isRestart(xhr: XMLHttpRequest): boolean {
  if (xhr.status !== 409) return false;
  try {
    const body = JSON.parse(xhr.responseText);
    return !!body && body.error === "restart";
  } catch (e) {
    return false;
  }
}

function take(h: HandoffView): void {
  // One accept per card per page. Two downloads on one pipe would each
  // get half the bytes and both would fail at the end.
  if (accepting[h.id]) return;
  accepting[h.id] = true;
  paint();
  postJSON<{ pullUrl: string }>("/api/handoff/" + h.id + "/accept", {}).then(
    function (r) {
      delete accepting[h.id];
      startPull(r.pullUrl);
      startFast();
      if (hostRef) hostRef.reload();
    },
    function (err) {
      delete accepting[h.id];
      if (hostRef) {
        hostRef.showErr(err);
        hostRef.reload();
      }
    }
  );
}

function withdraw(id: string, action: string): void {
  postJSON("/api/handoff/" + id + "/" + action, {}).then(
    function () {
      if (id === myOffer) {
        myOffer = "";
        pending = null;
      }
      if (hostRef) hostRef.reload();
    },
    function (err) {
      if (hostRef) hostRef.showErr(err);
    }
  );
}

// startPull gives the download to the browser. A download manager
// streams to disk with a flat memory footprint, which is exactly what
// no secure-context disk API and a two gigabyte file require.
function startPull(url: string): void {
  const a = document.createElement("a");
  if ("download" in a) {
    a.href = url;
    a.setAttribute("download", "");
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  // iOS 12 has no download attribute. The reply carries
  // Content-Disposition: attachment, so Safari starts a download and
  // leaves the page where it is.
  window.location.href = url;
}

// ---- polling ---------------------------------------------------------

// startFast runs while a card this tab is part of is still moving. It
// stops itself as soon as nothing is in flight, so an idle board keeps
// exactly one request every twenty seconds.
function startFast(): void {
  if (fast) return;
  fast = window.setInterval(tick, 1000);
}

function stopFast(): void {
  if (!fast) return;
  window.clearInterval(fast);
  fast = 0;
}

function tick(): void {
  // No document.hidden guard here. The person sending is very likely
  // looking at the other device, and a hidden tab that stops polling
  // would never see the card being taken, so the upload would never
  // start. Browsers throttle a background timer, but they still fire.
  api<ItemsBody>("/api/items?limit=1&live=1").then(
    function (body) {
      live(body);
    },
    function () {
      // Offline for a moment; the next tick tries again.
    }
  );
}

function busy(): boolean {
  let i;
  for (i = 0; i < cards.length; i++) {
    const h = cards[i];
    if (!h.mine) continue;
    if (h.state === "offered" || h.state === "accepted" || h.state === "sending") return true;
  }
  return false;
}

// ---- drawing ---------------------------------------------------------

function paint(): void {
  if (!zone) return;
  lastPaint = Date.now();
  clear(zone);
  if (!cards.length) {
    zone.hidden = true;
    return;
  }
  zone.hidden = false;
  let i;
  for (i = 0; i < cards.length; i++) zone.appendChild(card(cards[i]));
}

function paintSoon(): void {
  const now = Date.now();
  if (now - lastPaint < throttle) return;
  paint();
}

function card(h: HandoffView): HTMLElement {
  const box = el("div", "ho");
  box.setAttribute("data-state", h.state);
  box.setAttribute("data-mine", h.fromId === self ? "out" : "in");

  const head = el("div", "ho-head");
  head.appendChild(el("span", "ho-name", h.name || t("fileKind")));
  box.appendChild(head);

  const other = h.fromId === self ? h.to : h.from;
  const parts: string[] = [formatBytes(h.size), stateText(h)];
  if (other) parts.push((h.fromId === self ? t("hoTo") : t("hoFrom")) + " " + other);
  box.appendChild(el("p", "ho-meta", joinDots(parts)));

  if (h.state === "sending" && h.fromId === self) {
    const bar = el("div", "ho-bar");
    const fill = el("i", "ho-fill");
    const done = sent[h.id] || h.sent || 0;
    const ratio = h.size > 0 ? Math.min(1, done / h.size) : 0;
    fill.style.width = Math.round(ratio * 100) + "%";
    bar.appendChild(fill);
    box.appendChild(bar);
    box.appendChild(el("p", "ho-hint", t("hoKeep")));
  }
  if (h.state === "offered" && h.fromId === self && !peers.length) {
    box.appendChild(el("p", "ho-hint", t("hoNobody")));
  }

  const acts = el("div", "ho-acts");
  if (h.state === "offered" && h.fromId !== self) {
    const takeBtn = btn(t("hoTake"), function () { take(h); }, "textbtn ho-take");
    takeBtn.disabled = !!accepting[h.id];
    acts.appendChild(takeBtn);
    acts.appendChild(btn(t("hoDecline"), function () { withdraw(h.id, "decline"); }, "textbtn"));
  } else if (h.state === "accepted" && h.toId === self) {
    // After a dropped attempt the ticket is still good, so the person
    // who took the file can ask for it again without waiting for a new
    // card.
    if ((h.gen || 0) > 0) {
      const again = btn(t("hoTakeAgain"), function () { take(h); }, "textbtn ho-take");
      again.disabled = !!accepting[h.id];
      acts.appendChild(again);
    }
    acts.appendChild(btn(t("hoCancel"), function () { withdraw(h.id, "cancel"); }, "textbtn"));
  } else if (h.state === "accepted" || h.state === "sending") {
    acts.appendChild(btn(t("hoCancel"), function () { withdraw(h.id, "cancel"); }, "textbtn"));
  }
  if (acts.firstChild) box.appendChild(acts);
  return box;
}

function stateText(h: HandoffView): string {
  const out = h.fromId === self;
  if (h.state === "offered") return out ? t("hoWaiting") : t("hoWaitingYou");
  if (h.state === "accepted") return (h.gen || 0) > 0 ? t("hoRestarting") : t("hoAccepted");
  if (h.state === "sending") return out ? t("hoSending") : t("hoReceiving");
  if (h.state === "done") return out ? t("hoDone") : t("hoGot");
  if (h.state === "declined") return t("hoTaken");
  if (h.state === "expired") return t("hoExpired");
  if (h.state === "failed") return t("hoFailed");
  return t("hoWaiting");
}

function joinDots(parts: string[]): string {
  let out = "";
  let i;
  for (i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    out = out ? out + " · " + p : p;
  }
  return out;
}
