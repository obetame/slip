package web

import (
	"bytes"
	"os"
	"regexp"
	"testing"
)

func TestLegacySyntax(t *testing.T) {
	rx := regexp.MustCompile("\\?\\.|(?:\\?\\?)|=>|`|\\b(?:const|let|class)\\b")
	for _, name := range []string{"static/legacy.js", "static/api.js", "static/boot.js"} {
		b, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		if loc := rx.FindIndex(b); loc != nil {
			t.Errorf("%s has modern syntax near %q", name, snippet(b, loc[0]))
		}
	}
}

func TestLegacyCSS(t *testing.T) {
	bad := []string{"gap:", ":has(", "aspect-ratio", "inset:", "oklch(", "color-mix(", ":focus-visible"}
	for _, name := range []string{"static/legacy.css", "static/tokens.css"} {
		b, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, s := range bad {
			if bytes.Contains(b, []byte(s)) {
				t.Errorf("%s contains %s", name, s)
			}
		}
	}
	legacy, err := os.ReadFile("static/legacy.html")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(legacy, []byte("app.css")) || bytes.Contains(legacy, []byte("app.js")) {
		t.Fatal("legacy page loads the modern assets")
	}
	index, err := os.ReadFile("static/index.html")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(index, []byte("app.js")) || bytes.Contains(index, []byte("legacy.js")) {
		t.Fatal("modern page should load app.js only")
	}
}

func TestNoEmDash(t *testing.T) {
	ents, err := os.ReadDir("static")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range ents {
		b, err := os.ReadFile("static/" + e.Name())
		if err != nil {
			t.Fatal(err)
		}
		if bytes.Contains(b, []byte("—")) || bytes.Contains(b, []byte("–")) {
			t.Errorf("%s contains an em dash or en dash", e.Name())
		}
	}
}

func snippet(b []byte, at int) string {
	start := at - 12
	if start < 0 {
		start = 0
	}
	end := at + 12
	if end > len(b) {
		end = len(b)
	}
	return string(b[start:end])
}
