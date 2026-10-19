package store

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestTextOrderAndPersist(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	if _, err := st.AddText("   "); err != ErrEmpty {
		t.Fatalf("blank: %v", err)
	}
	if _, err := st.AddText(string([]byte{0xff})); err != ErrEmpty {
		t.Fatalf("invalid: %v", err)
	}
	st.SetLimits(0, 4, 0)
	if _, err := st.AddText("hello"); err != ErrTooLarge {
		t.Fatalf("long: %v", err)
	}
	st.SetLimits(0, 100, 0)

	first, err := st.AddText("  one  ")
	if err != nil {
		t.Fatal(err)
	}
	if first.Text != "  one  " {
		t.Fatalf("trimmed text %q", first.Text)
	}
	cur = cur.Add(time.Second)
	second, err := st.AddText("two")
	if err != nil {
		t.Fatal(err)
	}
	page, more := st.List(10, "")
	if more || len(page) != 2 || page[0].ID != second.ID || page[1].ID != first.ID {
		t.Fatalf("order %+v more %v", page, more)
	}
	if page[0].Text == "" {
		t.Fatal("public text missing")
	}

	again, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	page, _ = again.List(10, "missing")
	if len(page) != 2 || page[0].ID != second.ID {
		t.Fatalf("reopen %+v", page)
	}
	info, err := os.Stat(filepath.Join(dir, "items.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %o", info.Mode().Perm())
	}
}

func TestListPage(t *testing.T) {
	st := openTest(t, t.TempDir())
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })
	var ids []string
	for _, text := range []string{"a", "b", "c"} {
		cur = cur.Add(time.Second)
		it, err := st.AddText(text)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, it.ID)
	}
	page, more := st.List(2, "")
	if !more || len(page) != 2 || page[0].Text != "c" || page[1].Text != "b" {
		t.Fatalf("page %+v", page)
	}
	rest, more := st.List(2, page[1].ID)
	if more || len(rest) != 1 || rest[0].Text != "a" {
		t.Fatalf("rest %+v more %v", rest, more)
	}
	empty, _ := st.List(10, "")
	if len(ids) != 3 || empty == nil {
		t.Fatal("nil page")
	}
}

func TestDeleteRestorePurge(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })
	it, err := st.AddText("keep")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.SoftDelete([]string{"nope"}); err != ErrNotFound {
		t.Fatalf("missing: %v", err)
	}
	if _, err := st.SoftDelete([]string{it.ID}); err != nil {
		t.Fatal(err)
	}
	page, _ := st.List(10, "")
	if len(page) != 0 {
		t.Fatalf("still visible %+v", page)
	}
	if _, err := st.Restore([]string{it.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Get(it.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SoftDelete([]string{it.ID}); err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(61 * time.Second)
	if _, err := st.Restore([]string{it.ID}); err != ErrGone {
		t.Fatalf("late restore: %v", err)
	}
	st.Purge()
	if _, err := st.Get(it.ID); err != ErrNotFound {
		t.Fatalf("after purge: %v", err)
	}
}

func TestFileDedupQuotaAndName(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	body := "hello"
	p := filepath.Join(dir, "incoming", "a.txt")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	st.SetLimits(100, 100, 4)
	if _, err := st.AddFile(p, "a.txt", "text/plain", int64(len(body))); err != ErrQuota {
		t.Fatalf("quota: %v", err)
	}
	st.SetLimits(100, 100, 100)
	it, err := st.AddFile(p, "../../etc/passwd", "text/plain", int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	if it.Name != "passwd" {
		t.Fatalf("name %q", it.Name)
	}
	blob := filepath.Join(dir, "blobs", it.Blob)
	info, err := os.Stat(blob)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("blob mode %o", info.Mode().Perm())
	}
	p2 := filepath.Join(dir, "incoming", "b.txt")
	if err := os.WriteFile(p2, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	it2, err := st.AddFile(p2, "b.txt", "text/plain", int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	if it2.Blob != it.Blob {
		t.Fatal("expected one blob")
	}
	used, limit := st.Usage()
	if used != int64(len(body)) || limit != 100 {
		t.Fatalf("used %d limit %d", used, limit)
	}
	if _, err := st.AddFile(p2, "c.txt", "text/plain", 0); err != ErrEmpty {
		t.Fatalf("empty: %v", err)
	}

	long := strings.Repeat("名", 200)
	p3 := filepath.Join(dir, "incoming", "c.txt")
	if err := os.WriteFile(p3, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	it3, err := st.AddFile(p3, long, "text/plain", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len([]rune(it3.Name)) != 180 {
		t.Fatalf("runes %d", len([]rune(it3.Name)))
	}
}

func TestInlineOK(t *testing.T) {
	if InlineOK(Item{Mime: "text/html"}) || InlineOK(Item{Mime: "image/svg+xml"}) {
		t.Fatal("active types must not be inline")
	}
	if !InlineOK(Item{Mime: "image/jpeg"}) || !InlineOK(Item{Mime: "application/pdf"}) {
		t.Fatal("expected inline types")
	}
}

func TestPurgeDropsBlob(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })
	p := filepath.Join(dir, "incoming", "a.bin")
	if err := os.WriteFile(p, []byte("abcde"), 0o600); err != nil {
		t.Fatal(err)
	}
	it, err := st.AddFile(p, "a.bin", "application/octet-stream", 5)
	if err != nil {
		t.Fatal(err)
	}
	blob := filepath.Join(dir, "blobs", it.Blob)
	if _, err := st.SoftDelete([]string{it.ID}); err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(61 * time.Second)
	st.Purge()
	if _, err := os.Stat(blob); !os.IsNotExist(err) {
		t.Fatalf("blob still there: %v", err)
	}
}

func openTest(t *testing.T, dir string) *Store {
	t.Helper()
	st, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	return st
}
