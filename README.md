# Slip

[中文](README.zh-CN.md)

Slip is a board for text, pictures, and files on a home network. One computer runs it. Every other device only needs a browser.

New slips sit on top. Nothing syncs in the background, and nothing disappears until someone deletes it.

## Install

### Download a release

Open the [latest release](https://github.com/obetame/slip/releases/latest). Pick the archive for this computer:

| System              | Archive                                  |
| ------------------- | ---------------------------------------- |
| Linux x86-64        | `slip_<version>_linux_amd64.tar.gz`      |
| Linux arm64         | `slip_<version>_linux_arm64.tar.gz`      |
| macOS universal     | `slip_<version>_darwin_universal.tar.gz` |
| Windows x86-64      | `slip_<version>_windows_amd64.zip`       |
| Windows arm64       | `slip_<version>_windows_arm64.zip`       |

The macOS archive holds one universal binary, so it runs on both Apple silicon and Intel.

`SHA256SUMS` in the same release lists every archive. On macOS or Linux, unpack it and put `slip` somewhere on `PATH`:

```sh
tar -xzf slip_*_darwin_universal.tar.gz
chmod +x slip
sudo mv slip /usr/local/bin/slip
```

The macOS archive is signed with a Developer ID and notarized by Apple, so it opens without a Gatekeeper prompt and needs no extra step.

On Windows, unzip `slip.exe` and run it from a command prompt. Windows may warn that the publisher is unknown. The file is not signed with a paid certificate.

### Install with Go

Go 1.27 or newer:

```sh
go install github.com/obetame/slip/cmd/slip@v0.1.0
```

The binary is placed in `$(go env GOPATH)/bin`. That directory has to be on `PATH`.

## Run

```sh
slip
```

The terminal prints a local URL. When Slip listens on the local network, it also prints the addresses other devices can open, and a QR code for the first of them. Binding `127.0.0.1`, `localhost`, or `::1` prints only the local URL. On a first run, the Mac also opens the page so you can choose a household passphrase of at least 6 characters. Do not reuse a passphrase from email or a bank. The page is plain HTTP on the local network.

Other devices join the same Wi-Fi, open the LAN address, and enter that passphrase once. The browser remembers it for 180 days.

## Flags

| Flag        | Meaning                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `--port`    | Port to bind. The default is 8787, or the port saved from last time. An explicit port is not moved if it is busy. |
| `--data`    | Directory for slips and the passphrase hash.                                                                      |
| `--host`    | Bind address. The default is every interface. `127.0.0.1` keeps it on this computer.                              |
| `--no-open` | Do not open a browser on first run.                                                                               |
| `--version` | Print the version and exit.                                                                                       |

Environment variables: `SLIP_PORT`, `SLIP_DATA`, and `SLIP_NO_OPEN=1`.

The data directory defaults to `~/Library/Application Support/slip` on macOS. Files are mode `0600` and the directory is mode `0700`.

## Limits

| Limit          | Value                                                |
| -------------- | ---------------------------------------------------- |
| One file       | 50 MB                                                |
| One text slip  | 200 KB                                               |
| One secret     | 4 KB                                                 |
| Data directory | 5 GB                                                 |
| Passphrase     | 6 to 200 characters, stored only as an Argon2id hash |

Pictures can be viewed and downloaded. Other files are downloaded. PDF files can also be viewed. Text stays selectable, and the copy button copies the whole slip.

## Secrets

A slip can be marked as a secret when it is written. Its body stays out of the
board until someone opens it, it expires, and it can burn once another device
has read it.

Add a code and the body is written to disk as ciphertext. The code is stored
nowhere, so a lost code means a lost slip, and ten wrong tries destroy it.

A code protects a stolen data directory, not the network. The page is HTTP, so
anyone who can see the traffic sees the body when it is put down and again when
it is read. Do not keep anything here that must not survive on disk.

## Older iPads

iPad mini 2, and other devices on iOS 12, get a simpler page with the same actions. Open `/?ui=legacy` to force it, or `/?ui=modern` to leave it. The choice is remembered on that browser.

## Develop

Clone the repository. [just](https://github.com/casey/just) runs the common commands. `make test` and `make build` do the same two jobs without just.

```sh
git clone https://github.com/obetame/slip.git
cd slip
just test
just dev-local
```

`just dev-local` listens only on this computer and keeps its slips in a temporary directory. It does not open a browser and it does not use the household data directory. The terminal prints the URL, which is `http://127.0.0.1:8787` unless that port is already taken. Delete the temporary directory to choose the passphrase again.

| Command              | What it does                                 |
| -------------------- | -------------------------------------------- |
| `just test`          | Run `go test ./...`.                         |
| `just build`         | Write `./slip` for this machine.             |
| `just dev --no-open` | Run from source. Extra words are slip flags. |
| `just dev-local`     | Local trial, temporary data directory.       |
| `just dist`          | Write release archives into `./dist`.        |
| `just fmt`           | Run `gofmt`.                                 |
| `just clean`         | Remove `./slip` and `./dist`.                |

Without just:

```sh
go test ./...
go run ./cmd/slip --host 127.0.0.1 --no-open
```

GitHub runs the tests on a pull request, and once more when that work reaches `main`. A tag `vX.Y.Z` on `main` builds the release. How branches and tags work is in [Contributing](CONTRIBUTING.md).

## More

- [Design](docs/design.md) and [设计说明](docs/design.zh-CN.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
