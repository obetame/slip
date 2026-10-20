.PHONY: fmt test build

fmt:
	gofmt -w .

test:
	go test ./...

build:
	go build -trimpath -ldflags="-s -w" -o slip ./cmd/slip
