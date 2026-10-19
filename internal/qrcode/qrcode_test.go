package qrcode

import (
	"strings"
	"testing"
)

func TestSVGHidesText(t *testing.T) {
	const target = "http://192.0.2.1:8787"
	svg, err := SVG(target, 4)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(svg, "<svg") || strings.Contains(svg, "<script") {
		t.Fatalf("unexpected svg")
	}
	if strings.Contains(svg, "192.0.2.1") {
		t.Fatal("target was written into the svg as text")
	}
	term, err := Terminal(target)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(term, "█") {
		t.Fatal("terminal qr is empty")
	}
}
