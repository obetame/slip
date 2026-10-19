# Contributing

Issues and pull requests are welcome in English or Chinese.

## Tests

Go 1.23 or newer:

```sh
gofmt -w .
go test ./...
```

CI on GitHub runs the same gofmt check and `go test ./...` on Ubuntu with Go 1.23.

The compatible page is `internal/web/static/legacy.js` plus `legacy.css`. It has to stay readable on iOS 12. Do not use optional chaining, nullish coalescing, arrow functions, template literals, `const`, `let`, `class`, flexbox `gap`, `:has`, `aspect-ratio`, `inset`, `oklch`, or `color-mix` in those files or in the shared `api.js`, `boot.js`, and `tokens.css`. `internal/web/syntax_test.go` checks this.

User-facing text should not use an em dash.

## What not to commit

- The built `slip` binary, coverage files, or editor state. `.gitignore` already names them.
- A data directory, `config.json`, session files, or anything from `~/Library/Application Support/slip`.
- Passphrases, tokens, home directory paths, or personal hostnames.
- Screenshots that show a real LAN address or a real passphrase.

A local git name and email belong in this clone's `.git/config`, not in the files.

## Design

Behavior for 0.1.0 is described in [docs/design.md](docs/design.md) and [docs/design.zh-CN.md](docs/design.zh-CN.md). A change to limits, routes, or the threat model should update both.
