# Slip 0.1.0

[中文](design.zh-CN.md)

Slip is one board for a household. A person puts down a piece of text, a picture, or a file on the computer that runs Slip. Someone else, on the same home router, opens a browser and takes it. There is no account, no background sync, and no menu bar in this version.

The screen name is 纸条. The command is `slip`. English UI calls it Slip.

## What it is not

Tools that already exist solve a nearby problem and miss this one.

- PairDrop and LocalSend move a file while both devices are awake and willing. Slip keeps the slip after the sender closes the laptop lid.
- File browsers and upload pages are folders. Slip is a stack, newest on top, read by copying or downloading one card.
- A cloud clipboard leaves the house. Slip stays on the LAN.

## Product rules

- One shared passphrase. Minimum 6 characters, maximum 200, counted in Unicode code points. It is not trimmed. It is stored only as a hash.
- A browser that passes the check gets an HttpOnly cookie for 180 days.
- Slips stay until someone deletes them, or clears the board. Delete can be undone.
- One file is at most 50 MB. One text slip is at most 200 KB of UTF-8. The data directory is at most 5 GB of file bytes.
- Text is plain text. There is no Markdown rendering.
- The interface is Chinese first, with an English toggle kept in `localStorage` under `slip.lang`. The theme is light unless the person chooses dark (`slip.theme`).
- There is no WebSocket. Opening the page, or pressing refresh, loads the stack.
- The wire is HTTP. HTTPS certificates are a poor fit for iOS 12, which is a device this version still serves. The passphrase must not be reused from email or a bank.

## Two pages

Modern browsers get the full page: a paper sheet, a seal-colored bar, drag and drop, and paste of images.

iPad mini 2 stops at iOS 12.5.7. Its Safari does not get the modern page. The server looks at the user agent for `CPU OS 12_` or `CPU iPhone OS 12_` and sends `legacy.html`. `/?ui=legacy` and `/?ui=modern` set a `slip_ui` cookie for a year and redirect to `/`. The cookie wins over the user agent.

The legacy page uses the same API and the same actions: setup, waiting, login, write, add file, copy, view, download, delete, undo, refresh, settings, passphrase change, clear, and sign out everywhere. Script and CSS for it stay in the language of iOS 12: no optional chaining, no `const` or `let`, no arrows, no flexbox `gap`, no `:has`, no `aspect-ratio`. Copy uses `document.execCommand` when the clipboard API is missing. Inputs are at least 16px so the page does not zoom on focus, and tap targets are at least 44px. A picture is saved by opening it and pressing and holding, which is what that iPad can do.

The award-level craft is for the modern page. The legacy page has to be complete and readable.

## Process

One Go binary. The standard library serves HTTP and embeds the pages. Argon2id comes from `golang.org/x/crypto`. Thumbnails are decoded in process, with `golang.org/x/image/draw` for scaling. On macOS, `sips` is tried first so HEIC can get a preview without linking libheif. QR codes use `rsc.io/qr`, drawn as SVG for the page and as block characters for the terminal. There is no cgo, no SQLite, and no Docker.

The module is `github.com/obetame/slip` and the language version is Go 1.27. `GET /{$}` needs Go 1.22 or newer. CI uses Go 1.27 with `GOTOOLCHAIN=local`, so a dependency that needs a newer Go fails the check instead of downloading another toolchain.

A stripped macOS arm64 build (`go build -ldflags="-s -w"`, compiled with Go 1.27.2) is 7,296,994 bytes, about 7.0 MiB. The size moves with the Go release, the dependencies, and the target operating system. A later Homebrew bottle would ship one architecture.

A tag `vX.Y.Z` on `main` publishes the release. The tag has to be `v` plus `version.Current`. GitHub Actions builds the archives on Ubuntu with Go 1.27, `CGO_ENABLED=0`, `-trimpath`, and `-ldflags="-s -w"`, for Linux, macOS, and Windows, on amd64 and arm64. `SHA256SUMS` is published with them. The byte count above is that local binary, not one of the archives.

Argon2id at the production cost uses a 64 MiB working set while a passphrase is hashed. That memory is not the idle size of the process.

## Data directory

Mode `0700` on the directory, mode `0600` on files. The default on macOS is `~/Library/Application Support/slip`. `--data` and `SLIP_DATA` override it. On Linux the default is `$XDG_DATA_HOME/slip` or `~/.local/share/slip`.

| Path | Role |
| --- | --- |
| `config.json` | Port, Argon2id hash, creation time |
| `sessions.json` | SHA-256 of each token, and when it expires |
| `items.json` | The stack, including slips waiting out the undo window |
| `blobs/` | File bytes, named by SHA-256 |
| `thumbs/` | JPEG previews, `<hash>.jpg` |
| `incoming/` | Upload temp files on the same filesystem as the blobs |
| `slip.lock` | Advisory lock held by the running process |

Writes use a temp file in the same directory, mode `0600`, a sync, and a rename. A second process fails the lock and exits. The janitor in `main` calls purge every 5 seconds. Library code does not start that loop.

Identical file bytes are stored once. A slip keeps its own id, name, and time.

Names are cleaned with the base name, NUL bytes removed, and a cap of 180 characters taken from the end. The blob path is the hash, never the uploaded name.

## Passphrase and sessions

The hash looks like `argon2id$v=19$m=65536,t=2,p=2$<salt>$<sum>`. Production parameters are time 2, memory 64 MiB, threads 2, a 16 byte salt, and a 32 byte key. Comparison is constant time. Tests use a tiny cost (time 1, memory 64 KiB, threads 1) so the suite stays fast.

Error codes, not translated strings, cross the API: `passphrase_too_short`, `passphrase_too_long`, `passphrase_mismatch`, `wrong_passphrase`, `locked`, `too_large`, `text_too_large`, `quota`, `empty`, `unauthorized`, `setup_required`, `already_setup`, `forbidden`, `bad_request`, `not_found`, `gone`.

Eight failures from one remote address inside 10 minutes lock that address for 15 minutes. The address is `RemoteAddr`, not a forwarded header. A lock returns 429. A good passphrase clears the counter.

The cookie is `slip_session`. It is HttpOnly, SameSite=Lax, and not Secure, because the page is HTTP. Changing the passphrase keeps the current cookie and deletes the others. Signing out everywhere deletes all of them.

Setup is `POST /api/setup` and only from loopback, and only while no passphrase is set.

## Who can connect

Allowed: loopback, RFC 1918, IPv6 unique local, and link-local. Rejected: public addresses, and carrier-grade NAT `100.64.0.0/10`, which Go does not treat as private. IPv4-mapped IPv6 is unmapped before the check.

This does not stop a port-forward. A forwarded connection still arrives from the router's LAN address. The passphrase is the lock.

Share URLs prefer `192.168.0.0/16`, then `10.0.0.0/8`, then `172.16.0.0/12`, then `hostname.local` when the hostname is a safe DNS label. The first URL is the one in the QR code. The banner also prints `http://127.0.0.1:<port>`. A bind of `127.0.0.1`, `localhost`, or `::1` prints only that local line. Those addresses are not reachable from the other devices, so a LAN line or a QR would be a dead link. An empty bind, or `0.0.0.0`, still prints the share URLs.

`GET /api/bootstrap` tells the page whether a passphrase exists (`ready`), whether this browser is signed in, and whether the peer is loopback. URLs are included only for loopback or a signed-in browser. Usage is included only when signed in. The word `ready` means the passphrase exists. It does not mean "needs setup".

## HTTP

Default bind is every interface, port 8787. If that default (or a saved port) is busy, Slip tries the next 10 ports and saves the one it bound. `--port` and `SLIP_PORT` do not scan.

Timeouts: header 10 seconds, read and write 5 minutes, idle 2 minutes. SIGINT and SIGTERM shut down within 3 seconds.

On first run, with no passphrase and without `--no-open` or `SLIP_NO_OPEN=1`, macOS opens the browser when the bind address is empty, `127.0.0.1`, `localhost`, or `::1`.

Mutating requests need header `X-Slip: 1`. If `Origin` is present, its host must match the request host. Logs record method, path, and status for 4xx and 5xx only. Bodies and passphrases are not logged. HTML and JSON are `Cache-Control: no-store`.

Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, and

```
Content-Security-Policy: default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

There is no inline script, which is why the theme is applied by `/boot.js` rather than a snippet in the page. `robots.txt` disallows everything.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/` | Anyone on the LAN. Page choice as above. |
| GET | assets, `/favicon.png`, `/robots.txt` | Anyone on the LAN |
| GET | `/api/bootstrap` | Anyone on the LAN. Some fields are withheld. |
| GET | `/api/qr.svg` | Loopback or a signed-in browser |
| POST | `/api/setup` | Loopback, and only before a passphrase exists |
| POST | `/api/login` | Anyone on the LAN, subject to the lockout |
| POST | `/api/logout`, `/api/logout-all`, `/api/passphrase` | Signed in |
| GET | `/api/items` | Signed in. `limit` defaults to 40 and caps at 100. `before` is an id. An unknown id restarts at the newest. |
| POST | `/api/text` | Signed in. JSON `{"text":"..."}`. |
| POST | `/api/files` | Signed in. Multipart field `file`, at most 8 files. |
| GET | `/api/items/{id}/raw` | Signed in. `?dl=1` forces a download. |
| GET | `/api/items/{id}/thumb` | Signed in, JPEG preview |
| DELETE | `/api/items/{id}` | Signed in. Soft delete. |
| POST | `/api/restore` | Signed in. JSON `{"ids":[...]}` inside the undo window. |
| POST | `/api/clear` | Signed in. Soft delete of every visible slip. |

The button keeps an undo for 8 seconds and can collect several ids. The server still accepts a restore for 60 seconds, so a slow phone can succeed after the bar has gone. After that the janitor drops the slip and, when no slip still points at the blob, the blob and its thumbnail.

Inline responses are allowed for `image/jpeg`, `image/png`, `image/gif`, `image/webp`, and `application/pdf`. Everything else, including HTML and SVG, is `Content-Disposition: attachment` and `Content-Type: application/octet-stream`. The filename is an ASCII fallback plus an RFC 5987 `filename*`.

A thumbnail is a JPEG at most 960 px on the long edge, quality 70. Images over 20 million pixels are not decoded in process. If a preview cannot be made, the log line is `thumbnail skipped` and it does not include a filesystem path. The slip can still be downloaded.

## The page

Paper `#f3efe6`, sheet `#faf7f2`, ink `#1c1915`, muted `#5e584e`, line `#ddd4c6`, seal `#8f2d2a` with ink `#f6f1e8`. Dark mode uses `#1a1816`, `#24211d`, `#f3efe6`, and `#b7aea0`, and it keeps the same seal. Radius is 2 px. The Chinese wordmark uses Songti SC. The English word "Slip" uses the UI sans. A 4 px seal bar is fixed to the top of the viewport.

The composer is at the top. The newest slip has a 3 px seal inset. Text is submitted with the button or with Command/Control+Enter. Enter is a newline. Dragging a file, pasting an image, or using the file button uploads immediately, in batches of 8. There is no icon font and no stock photography. Motion is a loading sheen, and `prefers-reduced-motion` turns it off.

The strings live in `internal/web/static/api.js`. The server does not translate.

## Threat model

| Threat | Response in 0.1.0 |
| --- | --- |
| Guest on the Wi-Fi | They still need the passphrase. Traffic is not encrypted. |
| Port forward, or a public bind | Public source addresses are refused. A forward from the router is not. Do not publish the port. |
| Cross-site request from another tab | `X-Slip` plus an Origin check. The cookie is SameSite=Lax. |
| Uploaded HTML or SVG | Never rendered inline on the Slip origin. |
| Path in an uploaded name | The stored path is a hash. The download name is the base name, with header escaping. |
| Passphrase guessing | Argon2id, a short lockout, and a minimum length. This is not a defense against a passphrase that was reused from somewhere else. |
| Two processes, one directory | The second process exits. |
| Stolen data directory | The passphrase is a hash. Sessions on disk are hashes. The slips themselves are readable, which is the point of the files. |

## Not in 0.1.0

- A Homebrew formula.
- `slip install` as a LaunchAgent. If it is added later, it should be off unless the person asks.
- Optional HTTPS.
- A menu bar icon or a global hotkey.
- Accounts, sync, or Markdown.
