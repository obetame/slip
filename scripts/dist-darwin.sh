#!/bin/bash
# Build the macOS archives the way a release needs them: universal
# binaries, signed with a Developer ID, and notarized so Gatekeeper does
# not stop the first run.
#
# This has to run on macOS. notarytool talks to Apple and only ships with
# the macOS toolchain, so the Linux and Windows archives stay on the
# cheaper Ubuntu runner.
#
# Environment:
#   SLIP_RELEASE_TAG     v plus the version in source. Optional locally.
#   SLIP_SIGN_IDENTITY   Certificate SHA-1 or exact common name. Required.
#   SLIP_NOTARY_PROFILE  Optional. A notarytool keychain profile, set up with
#                        `xcrun notarytool store-credentials`. Takes priority
#                        over the Apple ID trio below.
#   SLIP_APPLE_ID        Apple ID for notarization.
#   SLIP_APPLE_PASSWORD  An app-specific password for that Apple ID. This is
#                        the same kind audio-note uses.
#   SLIP_APPLE_TEAM_ID   The Apple Developer team, e.g. QXATE9NQ6Y.
#                        When none of these are set, signing is verified but
#                        notarization and stapling are skipped, so a local run
#                        can check the signature without Apple credentials.
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

skip_sign=${SLIP_SKIP_SIGN:-}
identity=${SLIP_SIGN_IDENTITY:-}
if [ -z "$skip_sign" ] && [ -z "$identity" ]; then
  echo "slip: SLIP_SIGN_IDENTITY is not set" >&2
  echo "slip: list candidates with: security find-identity -v -p codesigning" >&2
  exit 1
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "slip: signing and notarizing needs macOS" >&2
  exit 1
fi

profile=${SLIP_NOTARY_PROFILE:-}
apple_id=${SLIP_APPLE_ID:-}
apple_pass=${SLIP_APPLE_PASSWORD:-}
apple_team=${SLIP_APPLE_TEAM_ID:-}

can_notarize=0
if [ -n "$profile" ]; then
  can_notarize=1
elif [ -n "$apple_id" ] && [ -n "$apple_pass" ] && [ -n "$apple_team" ]; then
  can_notarize=1
fi
if [ "$can_notarize" = "0" ]; then
  echo "slip: no notarization credentials; the result will be signed but not notarized"
  echo "slip: Gatekeeper will still refuse it on another Mac"
fi

rm -rf dist
mkdir -p dist

# One universal binary is simpler to sign, notarize, and staple than two
# per-architecture archives, and one code signature covers both slices.
build_universal() {
  local out=$1
  local tmp
  tmp=$(mktemp -d)
  CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o "$tmp/slip-amd64" ./cmd/slip
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 \
    go build -trimpath -ldflags="-s -w" -o "$tmp/slip-arm64" ./cmd/slip
  lipo -create -output "$out" "$tmp/slip-amd64" "$tmp/slip-arm64"
  rm -rf "$tmp"
}

echo "build slip_${version}_darwin_universal"
bin="dist/slip"
build_universal "$bin"

if [ -n "$skip_sign" ]; then
  echo "sign: skipped"
else
  echo "sign"
  # --options runtime is required for notarization. --timestamp embeds an
  # Apple timestamp so the signature outlives the certificate.
  codesign --force --options runtime --timestamp --sign "$identity" "$bin"

  echo "verify signature"
  codesign --verify --strict --verbose=2 "$bin"
fi

stem="slip_${version}_darwin_universal"
archive="dist/${stem}.tar.gz"
tar -C dist -czf "$archive" slip

if [ "$can_notarize" = "1" ]; then
  echo "notarize"
  # Apple wants a zip, dmg, or pkg. A zip of the archive is the simplest.
  if [ -n "$profile" ]; then
    xcrun notarytool submit "$archive" --keychain-profile "$profile" --wait
  else
    xcrun notarytool submit "$archive" \
      --apple-id "$apple_id" \
      --password "$apple_pass" \
      --team-id "$apple_team" \
      --wait
  fi

  echo "staple"
  # Stapling attaches the ticket to the archive so it works offline.
  xcrun stapler staple "$archive"
  xcrun stapler validate "$archive"
else
  echo "skip notarization: no credentials"
fi

# The unsigned binary is a build input, not a release file. Remove it so the
# archive and the checksums are the only things left.
rm -f dist/slip

(
  cd dist
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum *.tar.gz | LC_ALL=C sort -k2 > SHA256SUMS
  else
    shasum -a 256 *.tar.gz | LC_ALL=C sort -k2 > SHA256SUMS
  fi
)

echo "version ${version}"
