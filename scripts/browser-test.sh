#!/bin/bash
# Drive the built browser client against a real slip server.
#
# Builds the binary, starts it on a free loopback port with a throwaway
# data directory, seeds a few slips, then runs the jsdom scripts in
# tooling/ against it. Used by `just browser-test` and by CI.
set -euo pipefail

cd "$(dirname "$0")/.."
root=$(pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "browser-test: node is not installed, skipping" >&2
  exit 0
fi
if [ ! -d "$root/tooling/node_modules/jsdom" ]; then
  echo "browser-test: run npm ci in tooling/ first, skipping" >&2
  exit 0
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/slip-browser.XXXXXX")
bin="$tmp/slip"
data="$tmp/data"
log="$tmp/server.log"
mkdir -p "$data"

cleanup() {
  if [ -n "${pid:-}" ]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT

go build -o "$bin" ./cmd/slip

port=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
base="http://127.0.0.1:$port"

"$bin" --host 127.0.0.1 --port "$port" --no-open --data "$data" >"$log" 2>&1 &
pid=$!

for _ in $(seq 1 100); do
  if curl -fsS --max-time 1 "$base/api/bootstrap" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

jar="$tmp/cookies"
curl -fsS --max-time 5 -c "$jar" -X POST \
  -H 'Content-Type: application/json' -H 'X-Slip: 1' \
  -d '{"passphrase":"browsertest","again":"browsertest"}' \
  "$base/api/setup" >/dev/null

post_text() {
  curl -fsS --max-time 5 -b "$jar" -X POST \
    -H 'Content-Type: application/json' -H 'X-Slip: 1' \
    -d "{\"text\":$1}" "$base/api/text" >/dev/null
}
post_text '"buy milk and eggs"'
post_text '"hello from the browser test"'
post_text '"meeting notes at https://example.com/meeting"'

printf 'name,age\nada,36\ngrace,85\n' >"$tmp/people.csv"
curl -fsS --max-time 10 -b "$jar" -H 'X-Slip: 1' \
  -F "file=@$tmp/people.csv" "$base/api/files" >/dev/null

cd tooling
SLIP_TEST_PASS=browsertest node smoke.mjs "$base"
SLIP_TEST_PASS=browsertest node features.mjs "$base"
