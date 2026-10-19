package listen

import (
	"fmt"
	"net"
	"strconv"
)

// Listen binds host:port. When extra > 0 and the port is busy, it tries
// the next ports. host may be empty, which listens on every interface.
func Listen(host string, port, extra int) (net.Listener, int, error) {
	if port < 1 || port > 65535 {
		return nil, 0, fmt.Errorf("port out of range")
	}
	if extra < 0 {
		extra = 0
	}
	var last error
	for i := 0; i <= extra; i++ {
		p := port + i
		if p > 65535 {
			break
		}
		ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(p)))
		if err == nil {
			return ln, p, nil
		}
		last = err
	}
	if last == nil {
		last = fmt.Errorf("no port available")
	}
	return nil, 0, last
}
