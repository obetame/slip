package web

import (
	"bytes"
	"os"
	"regexp"
	"testing"
)

// TestLegacySyntax checks the built artifacts, not the TypeScript sources.
// The sources are allowed to use modern syntax; tsc and esbuild are what
// bring them down to ES5 (see tooling/build.mjs). Every bundle the pages
// load is checked, because the legacy page loads core.js and boot.js too.
func TestLegacySyntax(t *testing.T) {
	rx := regexp.MustCompile("\\?\\.|(?:\\?\\?)|=>|`|\\b(?:const|let|class)\\b")
	for _, name := range []string{
		"static/core.js",
		"static/app.js",
		"static/legacy.js",
		"static/boot.js",
	} {
		b, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		if loc := rx.FindIndex(b); loc != nil {
			t.Errorf("%s has modern syntax near %q", name, snippet(b, loc[0]))
		}
	}
}

// TestLegacyCSS and TestLegacyPageAssets live in css_compat_test.go, which uses
// a small CSS declaration scanner instead of a substring match: a substring
// check both fired on comments and values (e.g. `box-shadow: inset`) and missed
// `GAP : 4px` or `aspect-ratio : 1`.

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
