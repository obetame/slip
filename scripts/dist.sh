#!/bin/bash
# Build release archives into ./dist.
# SLIP_RELEASE_TAG, when set, must be v plus the version in source.
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(sed -n 's/^const Current = "\([^"]*\)"$/\1/p' internal/version/version.go)
if [ -z "$version" ]; then
  echo "slip: could not read the version" >&2
  exit 1
fi

tag=${SLIP_RELEASE_TAG:-}
if [ -n "$tag" ] && [ "$tag" != "v$version" ]; then
  echo "slip: tag $tag does not match version $version" >&2
  exit 1
fi

rm -rf dist
mkdir -p dist

set -- \
  linux amd64 \
  linux arm64 \
  darwin amd64 \
  darwin arm64 \
  windows amd64 \
  windows arm64

while [ "$#" -ge 2 ]; do
  goos=$1
  goarch=$2
  shift 2
  stem="slip_${version}_${goos}_${goarch}"
  bin="slip"
  if [ "$goos" = "windows" ]; then
    bin="slip.exe"
  fi
  echo "build ${stem}"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
    go build -trimpath -ldflags="-s -w" -o "dist/${bin}" ./cmd/slip
  if [ "$goos" = "windows" ]; then
    (cd dist && zip -q -X "${stem}.zip" "$bin")
  else
    tar -C dist -czf "dist/${stem}.tar.gz" "$bin"
  fi
  rm -f "dist/${bin}"
done

(
  cd dist
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum *.tar.gz *.zip | LC_ALL=C sort -k2 > SHA256SUMS
  else
    shasum -a 256 *.tar.gz *.zip | LC_ALL=C sort -k2 > SHA256SUMS
  fi
)

echo "version ${version}"
