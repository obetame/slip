package web

import (
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"
	"unicode"
)

// CSS features that the legacy page must avoid because iOS 12 Safari cannot
// parse or honour them. The legacy page is served to iPad mini 2 (Safari 12),
// so a single unsupported *property* silently drops a whole declaration, and an
// unsupported *selector* drops a whole rule.
//
// The lists here are deliberately about what Safari 12 cannot do, not about
// "modern" in general: -webkit- prefixes, `position: sticky`, `var()` fallbacks,
// `box-shadow: inset`, `grid-gap` (the old alias) and `color-scheme` are all
// accepted, so the guard does not fire on progressive enhancements that are
// already shipped to the legacy page.
var (
	// forbiddenCSSProperties is matched against declaration property names only.
	forbiddenCSSProperties = map[string]string{
		// Flex gaps. Safari 12 has no `gap`, `row-gap` or `column-gap` for
		// flex containers; the older `grid-gap` alias still works and is
		// therefore allowed. In flex layouts use margins per the legacy sheet.
		"gap":        "no `gap` in Safari 12 flex containers",
		"row-gap":    "no `row-gap` in Safari 12 flex containers",
		"column-gap": "no `column-gap` in Safari 12 flex containers",

		// Logical inset properties.
		"inset":              "no `inset` shorthand in Safari 12",
		"inset-block":        "no `inset-block` in Safari 12",
		"inset-inline":       "no `inset-inline` in Safari 12",
		"inset-block-start":  "no `inset-block-start` in Safari 12",
		"inset-block-end":    "no `inset-block-end` in Safari 12",
		"inset-inline-start": "no `inset-inline-start` in Safari 12",
		"inset-inline-end":   "no `inset-inline-end` in Safari 12",

		"aspect-ratio": "no `aspect-ratio` in Safari 12",

		// Container queries.
		"container":      "no container queries in Safari 12",
		"container-type": "no container queries in Safari 12",
		"container-name": "no container queries in Safari 12",

		"accent-color": "no `accent-color` in Safari 12",

		// Safari 12 only has the -webkit- prefixed form.
		"backdrop-filter": "Safari 12 needs -webkit-backdrop-filter",
	}

	// Color level 4/5 values. These drop the whole declaration on Safari 12,
	// which usually means an invisible or unreadable element.
	forbiddenCSSFunctions = map[string]string{
		"color-mix":  "no `color-mix()` in Safari 12",
		"oklch":      "no `oklch()` in Safari 12",
		"oklab":      "no `oklab()` in Safari 12",
		"lab":        "no `lab()` in Safari 12",
		"lch":        "no `lch()` in Safari 12",
		"hwb":        "no `hwb()` in Safari 12",
		"color":      "no `color()` in Safari 12",
		"light-dark": "no `light-dark()` in Safari 12",
	}

	// Selectors and pseudo-classes/elements Safari 12 cannot match. A rule
	// using one of these is dropped entirely, so the styles never apply.
	forbiddenCSSSelectors = []struct{ token, why string }{
		{":has(", "no `:has()` in Safari 12"},
		{":is(", "no `:is()` in Safari 12"},
		{":where(", "no `:where()` in Safari 12"},
		{":focus-visible", "no `:focus-visible` in Safari 12"},
		{":focus-within", "no `:focus-within` in Safari 12"},
		{"::backdrop", "no `::backdrop` in Safari 12"},
		{"::file-selector-button", "no `::file-selector-button` in Safari 12"},
		{"::marker", "no `::marker` in Safari 12"},
	}
)

// cssViolation is one unsupported CSS feature found by scanCSS.
type cssViolation struct {
	Line   int    // 1-based line in the source
	Kind   string // "property", "function", "selector" or "at-rule"
	Name   string // the offending name, e.g. "gap" or ":has("
	Reason string // human readable explanation
}

func (v cssViolation) String() string {
	return fmt.Sprintf("line %d: %s %q: %s", v.Line, v.Kind, v.Name, v.Reason)
}

// scanCSS reports every construct in src that Safari 12 cannot handle.
//
// It is a small, forgiving CSS tokenizer rather than a regex sweep:
//   - comments are skipped, so `/* gap: 4px */` is not a declaration;
//   - strings are skipped, so `content: ":has("` is not a selector;
//   - a block is classified by the prelude before its `{`: a prelude starting
//     with `@` is an at-rule, anything else is a selector list. Inside a normal
//     rule, the text before the first top-level `:` is a property name, so
//     selectors (`a{b:c}` inside @media) are not mistaken for declarations;
//   - property names are lowercased and trimmed, so `GAP : 4px` is caught while
//     `--gap` and `var(--gap)` are not.
func scanCSS(src []byte) []cssViolation {
	s := &cssScanner{src: string(src), line: 1}
	s.run()
	return s.violations
}

type cssScanner struct {
	src        string
	i          int
	line       int
	violations []cssViolation
	// buf accumulates the prelude of the current block with comments removed
	// and strings replaced by empty quotes.
	buf strings.Builder
}

func (s *cssScanner) add(line int, kind, name, reason string) {
	s.violations = append(s.violations, cssViolation{Line: line, Kind: kind, Name: name, Reason: reason})
}

// run tokenizes the stylesheet, keeping one accumulation buffer for the text
// since the last structural character. bufLine remembers the line the current
// token started on so violations point at the token, not at its `;`.
func (s *cssScanner) run() {
	depth := 0 // brace nesting; 0 means we are in a top-level prelude
	bufLine := 1
	started := false // whether bufLine has been pinned to the current token
	reset := func() {
		s.buf.Reset()
		started = false
	}
	// appendToken adds text to the buffer and pins bufLine on first use.
	appendToken := func(text string) {
		if !started {
			bufLine = s.line
			started = true
		}
		s.buf.WriteString(text)
	}
	for s.i < len(s.src) {
		c := s.src[s.i]
		switch {
		case c == '/' && s.i+1 < len(s.src) && s.src[s.i+1] == '*':
			s.skipComment()
		case c == '"' || c == '\'':
			appendToken(`""`)
			s.skipString(c)
		case c == '\\':
			// Escaped character: copy it verbatim so an escaped `:` or `(`
			// stays inside the identifier instead of being structural.
			s.i++
			esc := string(c)
			if s.i < len(s.src) {
				esc += string(s.src[s.i])
				s.i++
			}
			appendToken(esc)
		case c == '\n':
			s.line++
			s.i++
			if depth > 0 {
				// Newlines are just whitespace inside a block.
				if started {
					s.buf.WriteByte(' ')
				}
			} else {
				// At top level a newline ends a prelude such as an @import.
				reset()
			}
		case c == '{':
			s.checkPrelude(s.buf.String(), bufLine)
			s.i++
			depth++
			reset()
		case c == '}':
			// The last declaration in a block often has no trailing `;`.
			if depth > 0 {
				s.checkDeclaration(s.buf.String(), bufLine)
			}
			s.i++
			if depth > 0 {
				depth--
			}
			reset()
		case c == ';':
			s.i++
			if depth > 0 {
				s.checkDeclaration(s.buf.String(), bufLine)
			}
			reset()
		default:
			if isCSSSpace(c) {
				// Whitespace never starts a token; keep it inside a token
				// only if one has begun (it may separate a comment).
				if started {
					s.buf.WriteByte(c)
				}
				s.i++
				continue
			}
			appendToken(string(c))
			s.i++
		}
	}
	// A trailing declaration without a semicolon is still a declaration.
	if depth > 0 && started {
		s.checkDeclaration(s.buf.String(), bufLine)
	}
}

func isCSSSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f'
}

func (s *cssScanner) skipComment() {
	s.i += 2
	for s.i < len(s.src) {
		if s.src[s.i] == '*' && s.i+1 < len(s.src) && s.src[s.i+1] == '/' {
			s.i += 2
			return
		}
		if s.src[s.i] == '\n' {
			s.line++
		}
		s.i++
	}
}

func (s *cssScanner) skipString(quote byte) {
	s.i++ // opening quote
	for s.i < len(s.src) {
		c := s.src[s.i]
		if c == '\\' {
			s.i += 2
			continue
		}
		if c == '\n' {
			// Unterminated string; CSS would drop it. Stop so we do not
			// swallow the rest of the sheet.
			s.line++
			s.i++
			return
		}
		s.i++
		if c == quote {
			return
		}
	}
}

// checkPrelude inspects the text before an opening brace: the declaration or
// selector list of a normal rule, or an at-rule such as `@media (...)`,
// `@supports (...)`, `@container (...)`, `@layer`, `@property`.
func (s *cssScanner) checkPrelude(raw string, line int) {
	prelude := strings.TrimSpace(raw)
	if prelude == "" {
		return
	}
	if strings.HasPrefix(prelude, "@") {
		name := strings.ToLower(strings.TrimLeft(prelude, "@"))
		if i := strings.IndexAny(name, " \t\r\n("); i >= 0 {
			name = name[:i]
		}
		switch name {
		case "container", "property", "scope", "starting-style":
			s.add(line, "at-rule", "@"+name, fmt.Sprintf("no `@%s` in Safari 12", name))
		}
		// A @supports/@media prelude only tests conditions; the properties it
		// mentions are not applied, so only selector/function checks apply.
	}
	s.checkSelectors(prelude, line)
	s.checkFunctions(prelude, "selector", line)
}

// checkDeclaration inspects a single declaration body: everything that follows a
// `;` or `{` up to the next `;` or `}`.
func (s *cssScanner) checkDeclaration(body string, line int) {
	t := strings.TrimSpace(body)
	if t == "" {
		return
	}
	colon := strings.IndexByte(t, ':')
	if colon < 0 {
		return // no colon yet: a partial declaration, nothing to check
	}
	name := strings.ToLower(strings.TrimSpace(t[:colon]))
	value := t[colon+1:]
	// Custom properties (--gap) are opaque: Safari 12 supports var() and the
	// name is not a real property, so never flag them.
	if name != "" && !strings.HasPrefix(name, "--") {
		if reason, bad := forbiddenCSSProperties[name]; bad {
			s.add(line, "property", name, reason)
		}
	}
	s.checkFunctions(value, "value", line)
}

// unescapeCSS removes CSS escapes so an escaped `:` or `(` cannot be mistaken
// for the structural character that starts a selector token. `a\:has(` is a
// class named ":has", not the `:has()` pseudo-class.
func unescapeCSS(s string) string {
	if !strings.ContainsRune(s, '\\') {
		return s
	}
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '\\' || i+1 >= len(s) {
			b.WriteByte(s[i])
			continue
		}
		i++
		// Skip a hex escape's remaining digits (CSS allows up to six).
		if isHexDigit(s[i]) {
			n := 1
			for n < 6 && i+1 < len(s) && isHexDigit(s[i+1]) {
				i++
				n++
			}
			b.WriteByte('_') // placeholder: never part of a forbidden token
			if i+1 < len(s) && s[i+1] == ' ' {
				i++
			}
			continue
		}
		b.WriteByte('_')
	}
	return b.String()
}

func isHexDigit(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

func (s *cssScanner) checkSelectors(text string, line int) {
	lower := strings.ToLower(unescapeCSS(text))
	for _, f := range forbiddenCSSSelectors {
		if strings.Contains(lower, f.token) {
			s.add(line, "selector", f.token, f.why)
		}
	}
}

// checkFunctions finds forbidden CSS functions used in a value or a selector.
// Function names are matched at an identifier boundary and followed by `(`, so
// `color` in `color: red` or `-webkit-backdrop-filter` in a value is not a hit.
func (s *cssScanner) checkFunctions(text, kind string, line int) {
	lower := strings.ToLower(text)
	for i := 0; i < len(lower); i++ {
		if lower[i] != '(' {
			continue
		}
		// Walk backwards over the function name characters.
		j := i
		for j > 0 && isIdentChar(lower[j-1]) {
			j--
		}
		if j == i {
			continue
		}
		name := lower[j:i]
		// Skip a vendor prefix when looking up the table: -webkit-color-mix()
		// is just as unsupported as color-mix().
		lookup := name
		if k := strings.LastIndex(lookup, "-"); k > 0 && isVendorPrefix(lookup[:k]) {
			lookup = lookup[k+1:]
		}
		if reason, bad := forbiddenCSSFunctions[lookup]; bad {
			s.add(line, kind, name+"(", reason)
		}
		// A preceding `-` that is part of a longer identifier (e.g.
		// `my-color-mix(`) is rare enough to ignore; the boundary check above
		// already keeps `var(--gap)` and `--gap` out of the property table.
	}
}

func isIdentChar(c byte) bool {
	return c == '-' || c == '_' || unicode.IsLetter(rune(c)) || unicode.IsDigit(rune(c)) || c >= 0x80
}

func isVendorPrefix(s string) bool {
	switch s {
	case "-webkit", "-moz", "-ms", "-o", "-khtml":
		return true
	}
	return false
}

// TestLegacyCSS uses the scanner above to prove that the stylesheets the legacy
// page loads avoid every construct Safari 12 cannot handle.
func TestLegacyCSS(t *testing.T) {
	for _, name := range []string{"static/legacy.css", "static/tokens.css"} {
		b, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		violations := scanCSS(b)
		sort.Slice(violations, func(i, j int) bool { return violations[i].Line < violations[j].Line })
		for _, v := range violations {
			t.Errorf("%s: %s", name, v)
		}
	}
}

// TestCSSScanner is the behavioural spec for scanCSS. Every case states the
// offending names it expects so a false positive is as visible as a miss.
func TestCSSScanner(t *testing.T) {
	cases := []struct {
		name string
		css  string
		want []string // expected violation names, in source order; nil = clean
	}{
		// Baseline: these must be flagged.
		{name: "gap", css: `a{gap:4px}`, want: []string{"gap"}},
		{name: "gap uppercase", css: `a{ GAP : 4px }`, want: []string{"gap"}},
		{name: "gap no space", css: `a{gap:4px}`, want: []string{"gap"}},
		{name: "row-gap", css: `a{row-gap:1px}`, want: []string{"row-gap"}},
		{name: "column-gap", css: `a{column-gap:1px}`, want: []string{"column-gap"}},
		{name: "aspect-ratio", css: `a{aspect-ratio:16/9}`, want: []string{"aspect-ratio"}},
		{name: "aspect-ratio spaced", css: `a{aspect-ratio : 1}`, want: []string{"aspect-ratio"}},
		{name: "prefixed aspect-ratio", css: `a{-webkit-aspect-ratio:1}`, want: nil},
		{name: "inset", css: `a{inset:0}`, want: []string{"inset"}},
		{name: "inset-inline-start", css: `a{inset-inline-start:0}`, want: []string{"inset-inline-start"}},
		{name: "container-type", css: `a{container-type:inline-size}`, want: []string{"container-type"}},
		{name: "accent-color", css: `a{accent-color:red}`, want: []string{"accent-color"}},
		{name: "backdrop-filter", css: `a{backdrop-filter:blur(2px)}`, want: []string{"backdrop-filter"}},
		{name: "forbidden function in value", css: `a{color:color-mix(in srgb, red, blue)}`, want: []string{"color-mix("}},
		{name: "oklch value", css: `a{color:oklch(0.5 0.1 20)}`, want: []string{"oklch("}},
		{name: "has selector", css: `a:has(b){}`, want: []string{":has("}},
		{name: "is selector", css: `a:is(b, c){color:red}`, want: []string{":is("}},
		{name: "where selector", css: `:where(a){color:red}`, want: []string{":where("}},
		{name: "focus-visible", css: `button:focus-visible{outline:2px solid red}`, want: []string{":focus-visible"}},
		{name: "focus-within", css: `a:focus-within{b:c}`, want: []string{":focus-within"}},
		{name: "marker pseudo element", css: `li::marker{color:red}`, want: []string{"::marker"}},
		{name: "backdrop pseudo element", css: `dialog::backdrop{background:red}`, want: []string{"::backdrop"}},
		{name: "container at-rule", css: `@container (min-width:10px){a{b:c}}`, want: []string{"@container"}},
		{name: "multiple violations", css: `a{gap:1px;inset:0}`, want: []string{"gap", "inset"}},

		// Things Safari 12 handles, or that are not declarations at all.
		{name: "grid-gap alias", css: `a{grid-gap:4px}`, want: nil},
		{name: "box-shadow inset value", css: `a{box-shadow: inset 0 0 0 1px red}`, want: nil},
		{name: "comment only", css: `/* gap: 4px */`, want: nil},
		{name: "comment inside rule", css: "a{b:c /* gap: 1px */}", want: nil},
		{name: "comment between token and colon", css: "a{gap/*x*/:4px}", want: []string{"gap"}},
		{name: "custom property looking like gap", css: `a{width: calc(100% - var(--gap, 0px))}`, want: nil},
		{name: "custom property declaration", css: `a{--gap:4px}`, want: nil},
		{name: "media query with declarations", css: `@media (hover:hover){a{b:c}}`, want: nil},
		{name: "supports prelude is not applied", css: `@supports (gap:1px){a{b:c}}`, want: nil},
		{name: "focus pseudo class", css: `a:focus{outline:2px solid red}`, want: nil},
		{name: "outline-offset", css: `a{outline-offset:2px}`, want: nil},
		{name: "linear-gradient value", css: `a{background:linear-gradient(#fff,#000)}`, want: nil},
		{name: "flex", css: `a{display:flex;flex:1 1 auto}`, want: nil},
		{name: "webkit appearance", css: `input{-webkit-appearance:none}`, want: nil},
		{name: "position sticky", css: `a{position:sticky;top:0}`, want: nil},
		{name: "webkit backdrop filter", css: `a{-webkit-backdrop-filter:blur(2px)}`, want: nil},
		{name: "color-scheme allowed", css: `:root{color-scheme:dark}`, want: nil},
		{name: "color property is not color()", css: `a{color:red}`, want: nil},
		{name: "string mentions has", css: `a{content:":has(c)"}`, want: nil},
		{name: "escaped selector", css: `a\:has(b){c:d}`, want: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := scanCSS([]byte(tc.css))
			names := make([]string, 0, len(got))
			for _, v := range got {
				names = append(names, v.Name)
			}
			if len(names) != len(tc.want) {
				t.Fatalf("scanCSS(%q) = %v, want %v", tc.css, got, tc.want)
			}
			for i := range names {
				if names[i] != tc.want[i] {
					t.Fatalf("scanCSS(%q) = %v, want %v", tc.css, got, tc.want)
				}
			}
		})
	}
}

// TestCSSScannerLines makes sure reported line numbers point at the offending
// declaration, which is what makes a failure actionable.
func TestCSSScannerLines(t *testing.T) {
	css := "a {\n  color: red;\n  gap: 4px;\n}\nb {\n  inset: 0;\n}\n"
	got := scanCSS([]byte(css))
	if len(got) != 2 {
		t.Fatalf("got %v, want 2 violations", got)
	}
	if got[0].Line != 3 || got[0].Name != "gap" {
		t.Errorf("first violation = %v, want line 3 gap", got[0])
	}
	if got[1].Line != 6 || got[1].Name != "inset" {
		t.Errorf("second violation = %v, want line 6 inset", got[1])
	}
}

// TestLegacyPageAssets pins which stylesheet and script each page loads. The
// legacy page must stay on legacy.css/legacy.js/tokens.css; the modern page
// must not pull in the legacy bundle.
func TestLegacyPageAssets(t *testing.T) {
	legacy, err := os.ReadFile("static/legacy.html")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(legacy), "app.css") || strings.Contains(string(legacy), "app.js") {
		t.Fatal("legacy page loads the modern assets")
	}
	for _, want := range []string{"tokens.css", "legacy.css", "legacy.js"} {
		if !strings.Contains(string(legacy), want) {
			t.Errorf("legacy page does not load %s", want)
		}
	}
	index, err := os.ReadFile("static/index.html")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(index), "app.js") || strings.Contains(string(index), "legacy.js") {
		t.Fatal("modern page should load app.js only")
	}
}
