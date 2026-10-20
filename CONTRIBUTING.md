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
