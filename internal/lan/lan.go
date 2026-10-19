package lan

import (
	"fmt"
	"net"
	"os"
	"sort"
	"strings"
)

// Allowed reports whether a TCP peer may talk to slip.
// It allows loopback, RFC1918, IPv6 ULA, and link-local addresses.
// It does not trust X-Forwarded-For. A router port-forward still
// looks like a LAN address, so the passphrase is the real lock.
func Allowed(ip net.IP) bool {
	ip = normalize(ip)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// Loopback reports whether the peer is this machine.
func Loopback(ip net.IP) bool {
	ip = normalize(ip)
	return ip != nil && ip.IsLoopback()
}

func normalize(ip net.IP) net.IP {
	if ip == nil {
		return nil
	}
	if v4 := ip.To4(); v4 != nil {
		return v4
	}
	return ip
}

// FromAddr parses the host part of a net/http RemoteAddr.
func FromAddr(remote string) net.IP {
	host, _, err := net.SplitHostPort(remote)
	if err != nil {
		host = remote
	}
	return normalize(net.ParseIP(host))
}

// ShareURLs returns browser URLs other devices can try.
// IPv4 LAN addresses come first, then hostname.local.
// The first entry is the one encoded in the QR code.
func ShareURLs(port int) []string {
	ips := privateIPv4s()
	sort.Slice(ips, func(i, j int) bool {
		ri, rj := rank(ips[i]), rank(ips[j])
		if ri != rj {
			return ri < rj
		}
		return ips[i].String() < ips[j].String()
	})
	urls := make([]string, 0, len(ips)+1)
	for _, ip := range ips {
		urls = append(urls, fmt.Sprintf("http://%s:%d", ip.String(), port))
	}
	if host := bonjourHost(); host != "" {
		urls = append(urls, fmt.Sprintf("http://%s:%d", host, port))
	}
	return urls
}

func rank(ip net.IP) int {
	v4 := ip.To4()
	if v4 == nil {
		return 9
	}
	switch {
	case v4[0] == 192 && v4[1] == 168:
		return 0
	case v4[0] == 10:
		return 1
	default:
		return 2
	}
}

func privateIPv4s() []net.IP {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var out []net.IP
	seen := map[string]bool{}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			ip = normalize(ip)
			if ip == nil || ip.To4() == nil || !ip.IsPrivate() {
				continue
			}
			s := ip.String()
			if seen[s] {
				continue
			}
			seen[s] = true
			out = append(out, ip)
		}
	}
	return out
}

func bonjourHost() string {
	host, err := os.Hostname()
	if err != nil {
		return ""
	}
	host = strings.TrimSpace(host)
	if !safeHost(host) {
		return ""
	}
	if !strings.HasSuffix(strings.ToLower(host), ".local") {
		host += ".local"
	}
	return host
}

func safeHost(h string) bool {
	if h == "" || len(h) > 253 {
		return false
	}
	for _, r := range h {
		if r <= 32 || r == '/' || r == '\\' || r == '@' || r == ':' {
			return false
		}
	}
	return true
}
