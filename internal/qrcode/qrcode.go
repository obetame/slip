package qrcode

import (
	"fmt"
	"strings"

	"rsc.io/qr"
)

// SVG renders text as a square QR image. The text is not placed in the
// markup, only in the module bitmap, so it cannot break out of the SVG.
func SVG(text string, module int) (string, error) {
	if module < 2 {
		module = 4
	}
	code, err := qr.Encode(text, qr.M)
	if err != nil {
		return "", err
	}
	quiet := 4
	size := code.Size + quiet*2
	dim := size * module
	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges">`, dim, dim, dim, dim)
	b.WriteString(`<rect width="100%" height="100%" fill="#f3efe6"/>`)
	for y := 0; y < code.Size; y++ {
		for x := 0; x < code.Size; x++ {
			if !code.Black(x, y) {
				continue
			}
			fmt.Fprintf(&b, `<rect x="%d" y="%d" width="%d" height="%d" fill="#1c1915"/>`, (x+quiet)*module, (y+quiet)*module, module, module)
		}
	}
	b.WriteString(`</svg>`)
	return b.String(), nil
}

// Terminal draws a QR with half-block characters for the startup log.
func Terminal(text string) (string, error) {
	code, err := qr.Encode(text, qr.M)
	if err != nil {
		return "", err
	}
	quiet := 2
	n := code.Size + quiet*2
	var b strings.Builder
	for y := 0; y < n; y += 2 {
		for x := 0; x < n; x++ {
			top := dark(code, x-quiet, y-quiet)
			bot := dark(code, x-quiet, y+1-quiet)
			switch {
			case top && bot:
				b.WriteString("█")
			case top && !bot:
				b.WriteString("▀")
			case !top && bot:
				b.WriteString("▄")
			default:
				b.WriteString(" ")
			}
		}
		b.WriteByte('\n')
	}
	return b.String(), nil
}

func dark(code *qr.Code, x, y int) bool {
	if x < 0 || y < 0 || x >= code.Size || y >= code.Size {
		return false
	}
	return code.Black(x, y)
}
