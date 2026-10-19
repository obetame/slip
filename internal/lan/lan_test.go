package lan

import (
	"net"
	"testing"
)

func TestAllowed(t *testing.T) {
	ok := []string{"127.0.0.1", "::1", "10.1.2.3", "192.168.0.20", "172.16.0.4", "169.254.1.1", "fd00::1", "fe80::1"}
	for _, s := range ok {
		if !Allowed(net.ParseIP(s)) {
			t.Errorf("expected allow %s", s)
		}
	}
	bad := []string{"8.8.8.8", "1.1.1.1", "172.15.1.1", "100.64.0.1", "2001:4860:4860::8888"}
	for _, s := range bad {
		if Allowed(net.ParseIP(s)) {
			t.Errorf("expected reject %s", s)
		}
	}
	if Allowed(nil) {
		t.Fatal("nil ip should be rejected")
	}
}

func TestFromAddr(t *testing.T) {
	ip := FromAddr("192.168.1.9:54321")
	if ip.String() != "192.168.1.9" {
		t.Fatalf("got %v", ip)
	}
	if !Loopback(FromAddr("127.0.0.1:80")) {
		t.Fatal("expected loopback")
	}
	if Loopback(FromAddr("192.168.1.9:80")) {
		t.Fatal("lan is not loopback")
	}
}

func TestShareURLOrder(t *testing.T) {
	ips := []net.IP{net.ParseIP("10.0.0.2"), net.ParseIP("192.168.1.2"), net.ParseIP("172.16.0.2")}
	sortIPs(ips)
	if ips[0].String() != "192.168.1.2" || ips[1].String() != "10.0.0.2" {
		t.Fatalf("order %v", ips)
	}
}

func sortIPs(ips []net.IP) {
	// local copy of the production ranking, so a future sort change is visible
	for i := 0; i < len(ips); i++ {
		for j := i + 1; j < len(ips); j++ {
			if rank(ips[j]) < rank(ips[i]) || (rank(ips[j]) == rank(ips[i]) && ips[j].String() < ips[i].String()) {
				ips[i], ips[j] = ips[j], ips[i]
			}
		}
	}
}
