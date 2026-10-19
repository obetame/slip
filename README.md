# Slip

[中文](README.zh-CN.md)

Slip is a board for text, pictures, and files on a home network. One computer runs it. Every other device only needs a browser.

New slips sit on top. Nothing syncs in the background, and nothing disappears until someone deletes it.

## Run

Go 1.23 or newer:

```sh
git clone https://github.com/obetame/slip.git
cd slip
go build -ldflags="-s -w" -o slip ./cmd/slip
./slip
```

The terminal prints a local URL. When Slip listens on the local network, it also prints the addresses other devices can open, and a QR code for the first of them. Binding `127.0.0.1`, `localhost`, or `::1` prints only the local URL. On a first run, the Mac also opens the page so you can choose a household passphrase of at least 6 characters. Do not reuse a passphrase from email or a bank. The page is plain HTTP on the local network.

Other devices join the same Wi-Fi, open the LAN address, and enter that passphrase once. The browser remembers it for 180 days.

## Flags

| Flag | Meaning |
| --- | --- |
| `--port` | Port to bind. The default is 8787, or the port saved from last time. An explicit port is not moved if it is busy. |
| `--data` | Directory for slips and the passphrase hash. |
| `--host` | Bind address. The default is every interface. `127.0.0.1` keeps it on this computer. |
| `--no-open` | Do not open a browser on first run. |
| `--version` | Print the version and exit. |

Environment variables: `SLIP_PORT`, `SLIP_DATA`, and `SLIP_NO_OPEN=1`.

The data directory defaults to `~/Library/Application Support/slip` on macOS. Files are mode `0600` and the directory is mode `0700`.

## Limits

| Limit | Value |
| --- | --- |
| One file | 50 MB |
| One text slip | 200 KB |
| Data directory | 5 GB |
| Passphrase | 6 to 200 characters, stored only as an Argon2id hash |

Pictures can be viewed and downloaded. Other files are downloaded. PDF files can also be viewed. Text stays selectable, and the copy button copies the whole slip.

## Older iPads

iPad mini 2, and other devices on iOS 12, get a simpler page with the same actions. Open `/?ui=legacy` to force it, or `/?ui=modern` to leave it. The choice is remembered on that browser.

## Development

```sh
make test
make build
```

`make test` runs `go test ./...`. The module stays on Go 1.23 so the tests match CI.

## More

- [Design](docs/design.md) and [设计说明](docs/design.zh-CN.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
