package main

import "testing"

func TestLoopbackOnly(t *testing.T) {
	if !loopbackOnly("127.0.0.1") || !loopbackOnly("localhost") || !loopbackOnly("::1") {
		t.Fatal("loopback binds should skip LAN lines")
	}
	if !loopbackOnly(" LocalHost ") {
		t.Fatal("host should be trimmed and compared case-insensitively")
	}
	for _, host := range []string{"", "0.0.0.0", "::", "192.0.2.1"} {
		if loopbackOnly(host) {
			t.Fatalf("%q still serves the LAN", host)
		}
	}
}
