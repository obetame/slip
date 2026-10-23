package store

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/obetame/slip/internal/seal"
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

func TestEditText(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	first, err := st.AddText("before")
	if err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(time.Minute)
	second, err := st.AddText("second")
	if err != nil {
		t.Fatal(err)
	}

	// Editing keeps the place in the stack and the original CreatedAt.
	cur = cur.Add(time.Minute)
	edited, err := st.EditText(first.ID, "after")
	if err != nil {
		t.Fatal(err)
	}
	if edited.Text != "after" {
		t.Fatalf("text = %q", edited.Text)
	}
	if !edited.CreatedAt.Equal(first.CreatedAt) {
		t.Fatalf("CreatedAt moved: %v -> %v", first.CreatedAt, edited.CreatedAt)
	}
	if edited.EditedAt == nil {
		t.Fatal("EditedAt not set")
	}
	if !edited.EditedAt.Equal(cur) {
		t.Fatalf("EditedAt = %v, want %v", edited.EditedAt, cur)
	}

	// The order is unchanged: newest still comes first in List.
	list, _ := st.List(10, "")
	if len(list) != 2 || list[0].ID != second.ID || list[1].ID != first.ID {
		t.Fatalf("order changed after edit: %+v", list)
	}
	if list[1].Text != "after" || list[1].EditedAt == nil {
		t.Fatalf("edited slip not visible in List: %+v", list[1])
	}

	// The change survives a reopen.
	reopened := openTest(t, dir)
	got, err := reopened.Get(first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "after" || got.EditedAt == nil {
		t.Fatalf("edit not persisted: %+v", got)
	}

	// Rejections.
	if _, err := st.EditText(first.ID, "   "); err != ErrEmpty {
		t.Fatalf("blank: %v", err)
	}
	if _, err := st.EditText("0123456789abcdef", "x"); err != ErrNotFound {
		t.Fatalf("unknown id: %v", err)
	}
	st.SetLimits(0, 3, 0)
	if _, err := st.EditText(first.ID, "too long"); err != ErrTooLarge {
		t.Fatalf("too long: %v", err)
	}
	st.SetLimits(0, 100, 0)

	// A deleted slip cannot be edited.
	if _, err := st.SoftDelete([]string{first.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.EditText(first.ID, "gone"); err != ErrNotFound {
		t.Fatalf("deleted: %v", err)
	}
}

func TestEditOnlyText(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	tmp := filepath.Join(dir, "incoming", "f")
	if err := os.WriteFile(tmp, []byte("some bytes"), 0o600); err != nil {
		t.Fatal(err)
	}
	it, err := st.AddFile(tmp, "note.txt", "text/plain", int64(len("some bytes")))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.EditText(it.ID, "rewrite"); err != ErrNotText {
		t.Fatalf("file slip edit: %v, want ErrNotText", err)
	}
	// The body is untouched.
	got, err := st.Get(it.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.EditedAt != nil {
		t.Fatal("file slip got an EditedAt")
	}
}

var cheapSeal = seal.Cost{Time: 1, Memory: 64, Threads: 1}

// TestSecretNeverListsBody is the rule the whole feature rests on: the list
// endpoint is what every browser loads on refresh, so a body that appears
// there is not hidden at all.
func TestSecretNeverListsBody(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	it, err := st.AddSecret("ghp_tok3n", nil, "tag-a", time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	if !it.Secret || it.ExpiresAt == nil {
		t.Fatalf("item %+v", it)
	}
	page, _ := st.List(10, "")
	if len(page) != 1 {
		t.Fatalf("page %+v", page)
	}
	if page[0].Text != "" {
		t.Fatalf("body leaked into the list: %q", page[0].Text)
	}
	if !page[0].Secret || page[0].Sealed {
		t.Fatalf("flags %+v", page[0])
	}
	// The body is still there for reveal to read.
	got, err := st.Get(it.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "ghp_tok3n" {
		t.Fatalf("stored body %q", got.Text)
	}
}

func TestSealedBodySurvivesReopen(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	w, err := seal.Wrap(cheapSeal, "K7QM-3XPD", []byte("ghp_tok3n"))
	if err != nil {
		t.Fatal(err)
	}
	it, err := st.AddSecret("", w, "tag-a", time.Hour, true)
	if err != nil {
		t.Fatal(err)
	}
	// Nothing readable is left in the file.
	raw, err := os.ReadFile(filepath.Join(dir, "items.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "ghp_tok3n") {
		t.Fatal("plaintext reached items.json")
	}

	again := openTest(t, dir)
	again.SetClock(func() time.Time { return cur })
	got, err := again.Get(it.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Wrapped == nil {
		t.Fatal("wrapper lost on reopen")
	}
	plain, err := seal.Open(cheapSeal, "K7QM-3XPD", got.Wrapped)
	if err != nil {
		t.Fatalf("Open after reopen: %v", err)
	}
	if string(plain) != "ghp_tok3n" {
		t.Fatalf("body %q", plain)
	}
	page, _ := again.List(10, "")
	if len(page) != 1 || !page[0].Sealed || page[0].Text != "" {
		t.Fatalf("list %+v", page)
	}
}

func TestSecretExpiresAndVanishes(t *testing.T) {
	dir := t.TempDir()
	st := openTest(t, dir)
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	it, err := st.AddSecret("short lived", nil, "tag-a", 10*time.Minute, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.Get(it.ID); err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(9 * time.Minute)
	st.Purge()
	if _, err := st.Get(it.ID); err != nil {
		t.Fatalf("gone too early: %v", err)
	}
	cur = cur.Add(2 * time.Minute)
	st.Purge()
	if _, err := st.Get(it.ID); err != ErrNotFound {
		t.Fatalf("still there after expiry: %v", err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "items.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "short lived") {
		t.Fatal("expired body still in items.json")
	}
}

func TestSecretTTLIsClamped(t *testing.T) {
	st := openTest(t, t.TempDir())
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	// Nothing asks for a secret that never expires.
	it, err := st.AddSecret("x", nil, "", 0, false)
	if err != nil {
		t.Fatal(err)
	}
	if !it.ExpiresAt.Equal(cur.Add(DefaultSecretTTL)) {
		t.Fatalf("default ttl = %v", it.ExpiresAt.Sub(cur))
	}
	it, err = st.AddSecret("y", nil, "", 90*24*time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	if it.ExpiresAt.After(cur.Add(MaxSecretTTL)) {
		t.Fatalf("ttl not capped: %v", it.ExpiresAt.Sub(cur))
	}
}

// TestSecretBurnsForAnotherDevice is the burn rule: the browser that put the
// slip down can read it again; any other browser takes it away.
func TestSecretBurnsForAnotherDevice(t *testing.T) {
	st := openTest(t, t.TempDir())
	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	it, err := st.AddSecret("one time", nil, "tag-a", time.Hour, true)
	if err != nil {
		t.Fatal(err)
	}
	burned, err := st.Take(it.ID, "tag-a")
	if err != nil || burned {
		t.Fatalf("creator reveal: burned=%v err=%v", burned, err)
	}
	if got, err := st.Get(it.ID); err != nil || got.Text != "one time" {
		t.Fatalf("creator reveal consumed it: %+v %v", got, err)
	}
	burned, err = st.Take(it.ID, "tag-b")
	if err != nil || !burned {
		t.Fatalf("other device: burned=%v err=%v", burned, err)
	}
	got, err := st.Get(it.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "" || got.Wrapped != nil {
		t.Fatalf("body survived the burn: %+v", got)
	}
	if got.TakenAt == nil {
		t.Fatal("no tombstone time")
	}
	// A second reader finds a grave, not a slip.
	if _, err := st.Take(it.ID, "tag-c"); err != ErrGone {
		t.Fatalf("second take: %v", err)
	}
	// The tombstone itself expires.
	cur = cur.Add(TombstoneTTL + time.Minute)
	st.Purge()
	if _, err := st.Get(it.ID); err != ErrNotFound {
		t.Fatalf("tombstone outlived its hour: %v", err)
	}
}

// TestBurnWithoutTagTreatsAnyoneAsAnotherDevice covers a browser that sends no
// tag at all: the safe reading is that it may not be the one that wrote it.
func TestBurnWithoutTag(t *testing.T) {
	st := openTest(t, t.TempDir())
	it, err := st.AddSecret("x", nil, "", time.Hour, true)
	if err != nil {
		t.Fatal(err)
	}
	if burned, err := st.Take(it.ID, ""); err != nil || !burned {
		t.Fatalf("burned=%v err=%v", burned, err)
	}
}

func TestSecretWrongCodeLimit(t *testing.T) {
	st := openTest(t, t.TempDir())
	it, err := st.AddSecret("x", nil, "tag-a", time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i < MaxWrong; i++ {
		destroyed, err := st.NoteWrong(it.ID)
		if err != nil {
			t.Fatal(err)
		}
		if destroyed {
			t.Fatalf("destroyed after %d wrong codes", i)
		}
	}
	destroyed, err := st.NoteWrong(it.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !destroyed {
		t.Fatalf("survived %d wrong codes", MaxWrong)
	}
	if _, err := st.Get(it.ID); err != ErrNotFound {
		t.Fatalf("after the limit: %v", err)
	}
}

func TestSecretDeleteHasNoUndo(t *testing.T) {
	st := openTest(t, t.TempDir())
	normal, err := st.AddText("ordinary")
	if err != nil {
		t.Fatal(err)
	}
	secret, err := st.AddSecret("token", nil, "", time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	done, err := st.SoftDelete([]string{normal.ID, secret.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(done) != 1 || done[0] != normal.ID {
		t.Fatalf("undo list %v, want only the ordinary slip", done)
	}
	if _, err := st.Get(secret.ID); err != ErrNotFound {
		t.Fatalf("secret was only hidden: %v", err)
	}
	if _, err := st.Restore([]string{secret.ID}); err != ErrGone {
		t.Fatalf("secret was restorable: %v", err)
	}
}

func TestClearDestroysSecrets(t *testing.T) {
	st := openTest(t, t.TempDir())
	normal, err := st.AddText("ordinary")
	if err != nil {
		t.Fatal(err)
	}
	secret, err := st.AddSecret("token", nil, "", time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	done, err := st.SoftDeleteAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(done) != 1 || done[0] != normal.ID {
		t.Fatalf("undo list %v", done)
	}
	if _, err := st.Get(secret.ID); err != ErrNotFound {
		t.Fatalf("secret survived clear: %v", err)
	}
}

func TestSecretCannotBeEdited(t *testing.T) {
	st := openTest(t, t.TempDir())
	it, err := st.AddSecret("token", nil, "", time.Hour, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.EditText(it.ID, "rewritten"); err != ErrSecret {
		t.Fatalf("edit: %v, want ErrSecret", err)
	}
	if got, _ := st.Get(it.ID); got.Text != "token" {
		t.Fatalf("body changed: %q", got.Text)
	}
}

func TestSecretTooLarge(t *testing.T) {
	st := openTest(t, t.TempDir())
	big := strings.Repeat("a", MaxSecret+1)
	if _, err := st.AddSecret(big, nil, "", time.Hour, false); err != ErrTooLarge {
		t.Fatalf("big: %v", err)
	}
	if _, err := st.AddSecret("   ", nil, "", time.Hour, false); err != ErrEmpty {
		t.Fatalf("blank: %v", err)
	}
}
