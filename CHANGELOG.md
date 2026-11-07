# Changelog

What changed in each release, newest first. The release page for a tag
carries that version's section, so the notes and this file cannot drift.

## 0.5.0 - 2026-11-07

### Added

- Handoff: hand a file straight to another device. The bytes never land on
  this Mac and never count against the 5 GB data directory. The receiver
  downloads through its own browser while the sender uploads from the page;
  the two ends meet on a 512 KB pipe in memory and nothing is written to
  disk. When it finishes the board keeps one row with the name, the size,
  both device names, and a checksum. The row has no file behind it.
- A checksum on every handoff record, so either end can verify what arrived.
- An anonymous device identity per browser, so a card can say which device
  offered a file and which one took it. It is not an account: the passphrase
  is still the only lock.

### Changed

- The twenty second board poll now carries presence and live handoff cards,
  so none of this cost a second request or a second connection. A handoff in
  flight adds a one second poll and drops it when the transfer ends.
- The button is called Send direct and sits next to Add file, with a tooltip
  saying it does not use the board. The development name was unreadable to
  anyone who had not been told what it meant, so it is gone.
- The uploader fills a whole 256 KB chunk before handing it to the pipe. A
  network read returns whatever the kernel happens to have, often a couple
  of kilobytes, and the old loop pushed each of those through the pipe and
  flushed the receiver per piece, which breaks throughput on a real link.
- The server log prints the measured rate for each side
  (`handoff push ... MB/s`, `handoff pull ... MB/s`), so a slow transfer says
  which end is slow instead of leaving it to guesswork.

### Fixed

- Asking for the size with HEAD before downloading left the real download
  empty. Browsers do this routinely; the probe now answers from the session
  and leaves the stream alone.
- Two downloads of the same handoff split the bytes between them, so both
  stalled halfway and both failed. There is one reader per pipe now, and the
  newest request takes it: a download manager that grabs the URL from the
  browser asks while the browser's own request is still open, and refusing
  it is what produced "this site will not serve the same file twice". A 400
  ms grace keeps a browser from killing its own transfer, and a takeover
  counts against the restart budget.
- A download being taken over is no longer the end of the handoff. A dropped
  or replaced reader makes the server swap in a fresh pipe and the sender
  sends again from the start, up to four times. The card and the consent
  survive. The bytes still start over: this is not a resume.
- External download managers can fetch the file. They are separate
  processes without the browser's cookie jar, and the download address used
  to require a session, so every one of them got a 401. The ticket in the
  URL is the credential now: 128 random bits, valid for ten minutes, revoked
  when the handoff is cancelled. Whoever holds the link can download, which
  is the trade for a home LAN behind a household passphrase.
- Download replies carry `Accept-Ranges: none`, so a download manager that
  reads it stays on one connection. The stream is one pass by nature: there
  is one copy and it can be read once, in order.
- A receiver could, in a rare ordering, call a finished transfer short.
- The one second poll stopped while the sender's tab was hidden, so the
  upload never learned that its file had been taken. It no longer stops.

### Notes

- A handoff needs both pages open. Closing the sender's page ends it, and no
  record is written. That is the difference from a slip: a slip waits, a
  handoff does not.

## 0.4.0 - 2026-10-23

### Added

- Secret slips. A slip can be marked as a secret when it is written: its body
  never appears in the list, it expires, and it can burn after it is read.
- A code for a secret. With a code, the body is written to disk as ciphertext
  under Argon2id and AES-256-GCM, the code is stored nowhere, and ten wrong
  tries destroy the slip.
- Burn after read. A browser other than the one that put the slip down takes
  it: the body is erased and an hour-long tombstone says only when.
- A countdown on the header of a secret, and a body that returns behind dots
  thirty seconds after it is opened.

### Changed

- Deleting a secret is final. It gets no undo, because the undo bar promises
  the bytes are still there.
- Clearing the board destroys its secrets outright; the undo bar collects only
  what can still be restored.
- A code is masked where it is typed and on the card that shows it once after
  a slip is put down. A Show toggle reveals it; Copy works while it is hidden.
- Opening a secret scrolls its code field into view instead of throwing the
  page back to the top, and a wrong code leaves the caret in the field.
- The secret switch and its description share a baseline, and the warning
  about the network reads as a note rather than as one more sentence.
- A secret's countdown keeps up while the page stays open.
- A file cannot be a secret. Adding one while the switch is on says so instead
  of quietly posting it in the clear.
- The secret options read as one panel: a hairline under the text, burning and
  the clock on one line, and a description a size below its label rather than
  level with it.
- The code is one field group with its two actions inside the same border,
  38px tall, instead of a 44px box standing beside 13px text.
- Checkboxes take the seal colour instead of the system blue.
- Retention is three chips rather than a popup, so no native control renders
  at 16px in a row of 13px labels, and a hidden slip shows one short
  struck-out bar instead of six solid dots.

### Notes

- The page is still HTTP. A code protects a stolen data directory, not the
  wire: a sniffer on the same network sees the body when it is put down and
  again when it is read.

## 0.3.0 - 2026-10-22

### Added

- A kind filter above the board: All, Text, Image, and File chips, each
  with the number of slips it holds.
- A grid layout: a two-column wall where pictures fill a tile and notes and
  files keep their card. The choice is remembered per browser.
- Day separators in the list: Today, Yesterday, then the date.
- A bar that appears when slips arrive from another device, so the board can
  be brought up to date without a reload.
- Copy in the image viewer, so a picture can leave as a picture.
- A kind tag at the head of every slip, with its own colour for text,
  pictures, and files.
- Settings can check whether a newer version has been published and link to
  its release page. Nothing is checked until the button is pressed, and the
  board still never phones home on its own.

### Changed

- A long note starts folded and opens from its header. The header now stays
  at the top while its card is on screen, so a note can be folded, edited, or
  deleted without scrolling back to where it began.
- The header is one line at one size: time on the left, actions on the
  right. On a phone the extra actions fold into More.
- The layout switch moved to the end of the filter row, with an icon for the
  layout a tap switches to.
- Body text is a notch smaller than before, so it reads as content under the
  header instead of competing with it.
- The theme follows the system setting until someone picks one.

### Fixed

- Typing with a Chinese input method no longer narrows the board on the
  pinyin that has not been confirmed yet.
- The preview toggle no longer appears on text slips, where it fetched a body
  it never showed.
- The delete button uses the same quiet style as the actions beside it.

### Packaging

- The macOS archive is signed with a Developer ID and notarized by Apple, so
  it opens without a Gatekeeper prompt.
- A tag keeps one release page. Retagging updates the page in place instead
  of leaving a draft or a duplicate behind.

## 0.2.0 - 2026-10-20

### Added

- One browser controller behind both the modern page and the page served to
  older iPads, so the two cannot drift apart.
- Page-wide drag and drop, paste, search, and a text preview that reads an
  attachment in place.
- Editing after writing: a text slip can be changed once it is on the board,
  and Markdown renders in the viewer.
- An image viewer with arrow keys, Escape, and a full-size copy of the file.

### Changed

- The preview toggle sits in the action row with the other actions.
- Deleting a slip asks once before it acts.
- A failure is reported where the person is looking, not in a line that a
  scrolled-away card hid.

### Packaging

- macOS builds are signed and notarized, and the release is published by one
  tag rather than by hand.
