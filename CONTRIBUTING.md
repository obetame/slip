# Contributing

Issues and pull requests are welcome in English or Chinese.

## Branches

`main` is the only long-lived branch. It should build and pass the tests.

Do the work on a short-lived branch and open a pull request. A small fix can land on `main` directly. There is no `develop` branch.

A tag `vX.Y.Z` on `main` publishes the binaries. The tag has to match `internal/version.Current`: tag `v0.1.0` means that file says `0.1.0`. Move the constant in the same commit as the change it names, then tag that commit.

## Tests

Go 1.27 or newer. [just](https://github.com/casey/just) is optional:

```sh
just test
just fmt
```

The same commands without just:

```sh
gofmt -w .
go test ./...
```

CI runs the gofmt check and `go test ./...` on Ubuntu with Go 1.27. It runs on a pull request, and again when the result reaches `main`. `GOTOOLCHAIN=local`, so the job does not download a newer Go to satisfy a dependency. A module update that raises the `go` line is a language-version change and should update the docs, the CI version, and the minimum version in `README.md` in the same pull request.

## The browser client

The sources are TypeScript in `internal/web/src/`. Node 20 or newer builds them:

```sh
cd tooling
npm ci
npm run build
```

`npm run build` type-checks, lowers the sources to ES5 with `tsc`, and bundles `core.ts`, `app.ts`, `legacy.ts`, and `boot.ts` into `internal/web/static/*.js` with `esbuild`. Those four files are committed, so `go build` never needs Node, and CI rebuilds them and fails if the result differs from what is committed. Rebuild before you commit a frontend change.

Both pages run the same controller in `board.ts`. A change to behavior belongs there, not in `app.ts` or `legacy.ts`. Those two only implement the `Page` interface in `types.ts`, which is what actually differs between the modern page and the iOS 12 page: status output, the drag overlay, the View target, and reading a text attachment in place.

TypeScript is allowed to use modern syntax; the compiler is what makes the output ES5. What the sources must not use is a runtime the iPad lacks: no `AbortController`, no `Promise.finally`, no `globalThis`, no `String.prototype.replaceAll`, and no `for...of` over a `Map`, `Set`, or generator. `downlevelIteration` is off so that last one is a compile error.

CSS has no compiler, so `internal/web/css_compat_test.go` scans `tokens.css` and `legacy.css` for properties and functions iOS 12 ignores, including `gap`, `:has`, `aspect-ratio`, `inset`, `oklch`, and `color-mix`. Do not use those in either sheet; `app.css` is only loaded by the modern page.

Markdown for text attachments is rendered by `internal/web/src/markdown.ts`. It builds nodes with the DOM API and puts text in through `textContent`, never `innerHTML`, and it only turns http and https into links. Keep it that way: the content comes from a file someone dropped on the board and the page shares an origin with the passphrase form.

The strings for both languages are in `internal/web/src/i18n.ts`. `internal/web/text_test.go` checks that the two tables have the same keys.

User-facing text should not use an em dash.

## What not to commit

- The built `slip` binary, coverage files, or editor state. `.gitignore` already names them.
- A data directory, `config.json`, session files, or anything from `~/Library/Application Support/slip`.
- Passphrases, tokens, home directory paths, or personal hostnames.
- Screenshots that show a real LAN address or a real passphrase.

A local git name and email belong in this clone's `.git/config`, not in the files.

## Design

Behavior for 0.1.0 is described in [docs/design.md](docs/design.md) and [docs/design.zh-CN.md](docs/design.zh-CN.md). A change to limits, routes, or the threat model should update both.
