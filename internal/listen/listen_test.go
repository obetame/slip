package listen

import (
	"net"
	"strconv"
	"testing"
)

func TestListenSkipsBusyPort(t *testing.T) {
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer busy.Close()
	_, portStr, err := net.SplitHostPort(busy.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	port, _ := strconv.Atoi(portStr)
	ln, got, err := Listen("127.0.0.1", port, 2)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	if got == port {
		t.Fatalf("expected a different port, still %d", got)
	}
}

func TestListenExactFail(t *testing.T) {
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer busy.Close()
	_, portStr, _ := net.SplitHostPort(busy.Addr().String())
	port, _ := strconv.Atoi(portStr)
	if _, _, err := Listen("127.0.0.1", port, 0); err == nil {
		t.Fatal("expected busy port to fail when scan is off")
	}
}
