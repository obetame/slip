set shell := ["bash", "-cu"]

default:
	@just --list

# Format Go files.
fmt:
	gofmt -w .

# Run the tests.
test:
	go test ./...

# Rebuild the browser client into internal/web/static.
web:
	cd tooling && npm run build

# Fail if the committed bundles differ from the sources.
web-check:
	cd tooling && npm run build --silent && git diff --exit-code -- internal/web/static

# Drive the built client in jsdom against a real server.
browser-test:
	bash scripts/browser-test.sh

# Build ./slip for this machine.
build:
	go build -trimpath -ldflags="-s -w" -o slip ./cmd/slip

# Run from source. Extra arguments are slip flags.
dev *args:
	go run ./cmd/slip {{args}}

# Listen on this computer only, using a temporary data directory.
dev-local:
	#!/usr/bin/env bash
	set -euo pipefail
	dir="${TMPDIR:-/tmp}/slip-dev"
	mkdir -p "$dir"
	printf 'data directory: %s\n' "$dir"
	exec go run ./cmd/slip --host 127.0.0.1 --no-open --data "$dir"

# Build release archives into ./dist.
dist:
	bash scripts/dist.sh

# Remove ./slip and ./dist.
clean:
	rm -rf slip dist
