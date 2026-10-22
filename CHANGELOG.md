# Changelog

What changed in each release, newest first. The release page for a tag
carries that version's section, so the notes and this file cannot drift.

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
