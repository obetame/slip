package web

import (
	"os"
	"regexp"
	"testing"
)

// i18n.ts holds the two string tables. A key present in one language and
// missing from the other renders as a raw key in the page, which is easy to
// miss in review and impossible to miss here.

// block returns the body of a top-level table in i18n.ts, e.g. "zh" or "en".
// It walks braces so that nested objects would not confuse it.
func block(src, name string) (string, bool) {
	start := regexp.MustCompile(`(?m)^  ` + name + `: \{`).FindStringIndex(src)
	if start == nil {
		return "", false
	}
	depth := 0
	for i := start[1] - 1; i < len(src); i++ {
		switch src[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[start[1]:i], true
			}
		}
	}
	return "", false
}

var keyLine = regexp.MustCompile(`(?m)^\s*"?([A-Za-z_][A-Za-z0-9_]*)"?:\s*"`)

// keys collects the message names in one table.
func keys(body string) []string {
	var out []string
	for _, m := range keyLine.FindAllStringSubmatch(body, -1) {
		out = append(out, m[1])
	}
	return out
}

func tables(t *testing.T) (zh, en string) {
	t.Helper()
	b, err := os.ReadFile("src/i18n.ts")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	zh, ok := block(src, "zh")
	if !ok {
		t.Fatal("i18n.ts has no zh table")
	}
	en, ok = block(src, "en")
	if !ok {
		t.Fatal("i18n.ts has no en table")
	}
	return zh, en
}

func TestMessagesMatch(t *testing.T) {
	zhBody, enBody := tables(t)
	zh := map[string]bool{}
	for _, k := range keys(zhBody) {
		zh[k] = true
	}
	en := map[string]bool{}
	for _, k := range keys(enBody) {
		en[k] = true
	}
	if len(zh) == 0 || len(en) == 0 {
		t.Fatalf("empty table: zh=%d en=%d", len(zh), len(en))
	}
	for k := range zh {
		if !en[k] {
			t.Errorf("en is missing %q", k)
		}
	}
	for k := range en {
		if !zh[k] {
			t.Errorf("zh is missing %q", k)
		}
	}
}
