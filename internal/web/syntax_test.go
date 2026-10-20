package web

import (
	"bytes"
	"os"
	"regexp"
	"testing"
)

// modernSyntax matches what the legacy page cannot run.
var modernSyntax = regexp.MustCompile("\\?\\.|(?:\\?\\?)|=>|`|\\b(?:const|let|class)\\b")

// TestLegacySyntax checks the built artifacts, not the TypeScript sources.
// The sources are allowed to use modern syntax; tsc and esbuild are what
// bring them down to ES5 (see tooling/build.mjs). Every bundle the pages
// load is checked, because the legacy page loads core.js and boot.js too.
func TestLegacySyntax(t *testing.T) {
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
		bare := stripJSStrings(stripJSRegexLiterals(b))
		if loc := modernSyntax.FindIndex(bare); loc != nil {
			t.Errorf("%s has modern syntax near %q", name, snippet(bare, loc[0]))
		}
	}
}

// stripJSRegexLiterals blanks out regular expression literals. A backtick is a
// legal character in a regex, and the Markdown reader matches /^```/, so a
// plain text search for a backtick reports a template literal that is not
// there. The same blind spot would hide a real one, which is why this removes
// the regex instead of skipping the file.
func stripJSRegexLiterals(src []byte) []byte {
	out := make([]byte, len(src))
	copy(out, src)
	for i := 0; i < len(out); i++ {
		if out[i] != '/' || i+1 >= len(out) || out[i+1] == '/' || out[i+1] == '*' {
			continue
		}
		if !regexCanStart(out, i) {
			continue
		}
		inClass := false
		j := i + 1
		for j < len(out) {
			c := out[j]
			if c == '\\' {
				j += 2
				continue
			}
			if c == '\n' {
				break
			}
			if c == '[' {
				inClass = true
			} else if c == ']' {
				inClass = false
			} else if c == '/' && !inClass {
				break
			}
			j++
		}
		if j < len(out) && out[j] == '/' {
			for k := i + 1; k < j; k++ {
				out[k] = ' '
			}
			i = j
		}
	}
	return out
}

// regexCanStart reports whether a slash at i can open a regular expression,
// which is only true where an expression may begin.
func regexCanStart(src []byte, i int) bool {
	k := i - 1
	for k >= 0 && (src[k] == ' ' || src[k] == '\t' || src[k] == '\n' || src[k] == '\r') {
		k--
	}
	if k < 0 {
		return true
	}
	switch src[k] {
	case '=', '(', '[', ',', ':', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>':
		return true
	}
	// A keyword such as return can also be followed by a regex. esbuild
	// drops the parentheses around such an expression, so this case is real.
	end := k + 1
	start := end
	for start > 0 && isIdentByte(src[start-1]) {
		start--
	}
	word := string(src[start:end])
	switch word {
	case "return", "typeof", "case", "do", "else", "in", "of", "new",
		"delete", "void", "throw", "instanceof", "yield", "await":
		return true
	}
	return false
}

// stripJSStrings blanks out single and double quoted literals. A backtick is a
// legal character in a string, and the Markdown reader compares against it
// directly, so only a real template literal should count.
func stripJSStrings(src []byte) []byte {
	out := make([]byte, len(src))
	copy(out, src)
	for i := 0; i < len(out); i++ {
		c := out[i]
		if c != '"' && c != '\'' {
			continue
		}
		j := i + 1
		for j < len(out) {
			if out[j] == '\\' {
				j += 2
				continue
			}
			if out[j] == c || out[j] == '\n' {
				break
			}
			j++
		}
		if j < len(out) && out[j] == c {
			for k := i + 1; k < j; k++ {
				out[k] = ' '
			}
			i = j
		}
	}
	return out
}

func isIdentByte(c byte) bool {
	return c == '_' || c == '$' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
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

// TestLegacySyntaxCatching guards the guard: stripping strings and regexes
// must not turn the check into a no-op.
func TestLegacySyntaxCatching(t *testing.T) {
	bt := "`"
	dirty := map[string]string{
		"arrow":       "var f = () => 1;",
		"optchain":    "var x = a?.b;",
		"nullish":     "var x = a ?? b;",
		"template":    "var s = " + bt + "hi" + bt + ";",
		"const":       "const x = 1;",
		"let":         "let y = 2;",
		"class":       "class A {}",
		"afterString": "var s = \"a\"; var f = () => 2;",
		"afterRegex":  "var r = /a/g; var f = () => 3;",
	}
	for name, src := range dirty {
		bare := stripJSStrings(stripJSRegexLiterals([]byte(src)))
		if !modernSyntax.Match(bare) {
			t.Errorf("%s: modern syntax not detected in %s", name, src)
		}
	}
	clean := map[string]string{
		"backtickRegex":  "var a = /^\\s*" + bt + bt + bt + "/.test(x);",
		"backtickString": "var b = \"" + bt + "\";",
		"indexOf":        "var c = line.indexOf(\"" + bt + "\", 1);",
		"regexReturn":    "return /^\\s*" + bt + bt + bt + "/.test(x);",
		"regexClass":     "var d = /[a-z]+/g.test(y);",
		"classInString":  "var e = \"class\";",
	}
	for name, src := range clean {
		bare := stripJSStrings(stripJSRegexLiterals([]byte(src)))
		if modernSyntax.Match(bare) {
			t.Errorf("%s: false positive in %s", name, src)
		}
	}
}
