.PHONY: fmt test build web web-check browser-test

fmt:
	gofmt -w .

test:
	go test ./...

# Rebuild the browser client from internal/web/src into internal/web/static.
# The generated .js files are committed, so this is only needed after a
# frontend change.
web:
	cd tooling && npm run build

# Fail if the committed bundles do not match the TypeScript sources.
web-check:
	cd tooling && npm run build --silent && git diff --exit-code -- internal/web/static

# Drive the built client in jsdom against a real server.
browser-test:
	bash scripts/browser-test.sh

build:
	go build -trimpath -ldflags="-s -w" -o slip ./cmd/slip
