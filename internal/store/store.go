package store

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/obetame/slip/internal/seal"
)

const (
	MaxFile = 50 << 20
	MaxText = 200 << 10
	MaxData = 5 << 30
	// UndoWindow is longer than the 8 second button so a slow phone
	// can still restore after the bar has appeared.
	UndoWindow = 60 * time.Second

	// MaxSecret caps a secret body. A token or a password is bytes, not a
	// document, and a low ceiling is what lets a sealed slip keep its
	// ciphertext inline in items.json.
	MaxSecret = 4 << 10
	// MaxWrong is how many wrong codes a sealed slip tolerates. The tenth
	// destroys it, which turns online guessing into a dead end instead of a
	// slow leak. The counter lives in items.json so a restart does not
	// hand an attacker a fresh ten tries.
	MaxWrong = 10

	// MinSecretTTL and MaxSecretTTL bound what a browser may ask for.
	// DefaultSecretTTL is what it gets when it asks for nothing.
	MinSecretTTL     = time.Minute
	MaxSecretTTL     = 7 * 24 * time.Hour
	DefaultSecretTTL = 24 * time.Hour
	// TombstoneTTL is how long the sender can still see that a burn slip
	// was taken. Only the time survives; the body is gone.
	TombstoneTTL = time.Hour
)

const (
	KindText  = "text"
	KindImage = "image"
	KindFile  = "file"
)

var (
	ErrNotFound = errors.New("not_found")
	ErrTooLarge = errors.New("too_large")
	ErrQuota    = errors.New("quota")
	ErrEmpty    = errors.New("empty")
	ErrGone     = errors.New("gone")
	ErrNotText  = errors.New("not_text")
	// ErrSecret refuses an edit. A secret slip is written once and read
	// once; rewriting the body from a browser would let a slip that was
	// about to expire come back to life.
	ErrSecret = errors.New("secret_locked")
)

// Item is one slip. Blob is the sha256 of a file body and is not sent
// to browsers.
type Item struct {
	ID        string     `json:"id"`
	Kind      string     `json:"kind"`
	CreatedAt time.Time  `json:"createdAt"`
	DeletedAt *time.Time `json:"deletedAt,omitempty"`
	EditedAt  *time.Time `json:"editedAt,omitempty"`
	Text      string     `json:"text,omitempty"`
	Name      string     `json:"name,omitempty"`
	Size      int64      `json:"size,omitempty"`
	Mime      string     `json:"mime,omitempty"`
	Blob      string     `json:"blob,omitempty"`
	HasThumb  bool       `json:"hasThumb,omitempty"`

	// A secret slip is a text slip that does not show its body in the list
	// and that goes away on its own. Wrapped means the body is ciphertext:
	// the material that opens it is here, the code that opens it is not.
	Secret    bool          `json:"secret,omitempty"`
	ExpiresAt *time.Time    `json:"expiresAt,omitempty"`
	Burn      bool          `json:"burn,omitempty"`
	TakenAt   *time.Time    `json:"takenAt,omitempty"`
	Wrapped   *seal.Wrapped `json:"wrapped,omitempty"`
	Wrong     int           `json:"wrong,omitempty"`
	Tag       string        `json:"tag,omitempty"`
}

// Public is the browser view of an item.
type Public struct {
	ID        string     `json:"id"`
	Kind      string     `json:"kind"`
	CreatedAt time.Time  `json:"createdAt"`
	EditedAt  *time.Time `json:"editedAt,omitempty"`
	Text      string     `json:"text,omitempty"`
	Name      string     `json:"name,omitempty"`
	Size      int64      `json:"size,omitempty"`
	Mime      string     `json:"mime,omitempty"`
	HasThumb  bool       `json:"hasThumb,omitempty"`

	// Secret, Sealed, ExpiresAt, Burn and TakenAt describe a secret slip
	// without describing what is in it.
	Secret    bool       `json:"secret,omitempty"`
	Sealed    bool       `json:"sealed,omitempty"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	Burn      bool       `json:"burn,omitempty"`
	TakenAt   *time.Time `json:"takenAt,omitempty"`
}

func (it Item) Public() Public {
	p := Public{
		ID: it.ID, Kind: it.Kind, CreatedAt: it.CreatedAt, EditedAt: it.EditedAt,
		Name: it.Name, Size: it.Size, Mime: it.Mime, HasThumb: it.HasThumb,
		Secret: it.Secret, Sealed: it.Wrapped != nil,
		ExpiresAt: it.ExpiresAt, Burn: it.Burn, TakenAt: it.TakenAt,
	}
	// The body of a secret slip never appears in the list. The only way to
	// read one is reveal, which is where the read is counted.
	if !it.Secret {
		p.Text = it.Text
	}
	return p
}

// Store keeps slips in one JSON file plus content-addressed blobs.
type Store struct {
	mu      sync.Mutex
	dir     string
	items   []Item
	now     func() time.Time
	undo    time.Duration
	maxFile int64
	maxText int
	maxData int64
}

func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	for _, sub := range []string{"blobs", "thumbs", "incoming"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o700); err != nil {
			return nil, err
		}
	}
	s := &Store{
		dir:     dir,
		now:     time.Now,
		undo:    UndoWindow,
		maxFile: MaxFile,
		maxText: MaxText,
		maxData: MaxData,
	}
	b, err := os.ReadFile(s.itemsPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return s, nil
		}
		return nil, err
	}
	if len(bytesTrim(b)) == 0 {
		return s, nil
	}
	if err := json.Unmarshal(b, &s.items); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) SetClock(now func() time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.now = now
}

func (s *Store) SetUndo(d time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.undo = d
}

func (s *Store) SetLimits(maxFile int64, maxText int, maxData int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if maxFile > 0 {
		s.maxFile = maxFile
	}
	if maxText > 0 {
		s.maxText = maxText
	}
	if maxData > 0 {
		s.maxData = maxData
	}
}

func (s *Store) Usage() (used, limit int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.usedLocked(), s.maxData
}

func (s *Store) AddText(text string) (Item, error) {
	if strings.TrimSpace(text) == "" || !utf8.ValidString(text) {
		return Item{}, ErrEmpty
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(text) > s.maxText {
		return Item{}, ErrTooLarge
	}
	it := Item{
		ID:        newID(),
		Kind:      KindText,
		CreatedAt: s.now().UTC(),
		Text:      text,
	}
	s.items = append(s.items, it)
	if err := s.saveLocked(); err != nil {
		s.items = s.items[:len(s.items)-1]
		return Item{}, err
	}
	return it, nil
}

// AddSecret stores a body that must not appear on the board. wrapped is nil
// for a slip that only hides its body; otherwise text is empty and the body is
// already ciphertext. The slip always carries an expiry: a secret that lives
// forever is the risk this exists to remove.
func (s *Store) AddSecret(text string, wrapped *seal.Wrapped, tag string, ttl time.Duration, burn bool) (Item, error) {
	if wrapped == nil && (strings.TrimSpace(text) == "" || !utf8.ValidString(text)) {
		return Item{}, ErrEmpty
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	// A ciphertext is the body plus the 16 byte GCM tag.
	if len(text) > MaxSecret || (wrapped != nil && len(wrapped.CT) > MaxSecret+16) {
		return Item{}, ErrTooLarge
	}
	switch {
	case ttl <= 0:
		ttl = DefaultSecretTTL
	case ttl < MinSecretTTL:
		ttl = MinSecretTTL
	case ttl > MaxSecretTTL:
		ttl = MaxSecretTTL
	}
	now := s.now().UTC()
	exp := now.Add(ttl)
	it := Item{
		ID:        newID(),
		Kind:      KindText,
		CreatedAt: now,
		Text:      text,
		Secret:    true,
		ExpiresAt: &exp,
		Burn:      burn,
		Wrapped:   wrapped,
		Tag:       tag,
	}
	s.items = append(s.items, it)
	if err := s.saveLocked(); err != nil {
		s.items = s.items[:len(s.items)-1]
		return Item{}, err
	}
	return it, nil
}

// Take records that a browser read a secret slip. A burn slip becomes a
// tombstone when the reader is not the browser that put it down, and burned
// says so. The body is already in the caller's hands by then: this only
// decides what stays behind.
func (s *Store) Take(id, tag string) (burned bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		it := &s.items[i]
		if it.ID != id || !it.Secret || it.DeletedAt != nil {
			continue
		}
		if it.TakenAt != nil {
			return false, ErrGone
		}
		burned = it.Burn && (it.Tag == "" || it.Tag != tag)
		it.Wrong = 0
		if burned {
			now := s.now().UTC()
			exp := now.Add(TombstoneTTL)
			it.Text = ""
			it.Wrapped = nil
			it.Burn = false
			it.TakenAt = &now
			it.ExpiresAt = &exp
		}
		if err := s.saveLocked(); err != nil {
			return false, err
		}
		return burned, nil
	}
	return false, ErrNotFound
}

// NoteWrong counts a code that did not open. The slip is destroyed at
// MaxWrong, so guessing is a way to lose the slip rather than a way to win it.
func (s *Store) NoteWrong(id string) (destroyed bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		it := &s.items[i]
		if it.ID != id || it.DeletedAt != nil {
			continue
		}
		it.Wrong++
		if it.Wrong >= MaxWrong {
			s.items = append(s.items[:i], s.items[i+1:]...)
			s.sweepLocked()
			if err := s.saveLocked(); err != nil {
				return false, err
			}
			return true, nil
		}
		if err := s.saveLocked(); err != nil {
			return false, err
		}
		return false, nil
	}
	return false, ErrNotFound
}

// EditText replaces the body of a text slip. The slip keeps its place in
// the stack and its original CreatedAt, so editing does not reshuffle the
// board; EditedAt records when the body last changed. Only text slips can
// be edited: a file slip's body is a blob, not something to rewrite here.
func (s *Store) EditText(id, text string) (Item, error) {
	if strings.TrimSpace(text) == "" || !utf8.ValidString(text) {
		return Item{}, ErrEmpty
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(text) > s.maxText {
		return Item{}, ErrTooLarge
	}
	for i := range s.items {
		it := &s.items[i]
		if it.ID != id || it.DeletedAt != nil {
			continue
		}
		if it.Kind != KindText {
			return Item{}, ErrNotText
		}
		if it.Secret {
			return Item{}, ErrSecret
		}
		prevText, prevEdited := it.Text, it.EditedAt
		now := s.now().UTC()
		it.Text = text
		it.EditedAt = &now
		if err := s.saveLocked(); err != nil {
			it.Text, it.EditedAt = prevText, prevEdited
			return Item{}, err
		}
		return *it, nil
	}
	return Item{}, ErrNotFound
}

// FileLimit is the configured per-file cap.
func (s *Store) FileLimit() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.maxFile
}

// IncomingDir is the same-filesystem temp folder used for uploads.
func (s *Store) IncomingDir() string {
	return filepath.Join(s.dir, "incoming")
}

// AddFile stores r as a blob. The caller has already capped the read.
// size is the number of bytes in the temp file.
func (s *Store) AddFile(tmpPath, name, mime string, size int64) (Item, error) {
	if size <= 0 {
		return Item{}, ErrEmpty
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if size > s.maxFile {
		return Item{}, ErrTooLarge
	}
	hash, err := hashFile(tmpPath)
	if err != nil {
		return Item{}, err
	}
	dest := filepath.Join(s.dir, "blobs", hash)
	existed := fileExists(dest)
	if !existed {
		if s.usedLocked()+size > s.maxData {
			return Item{}, ErrQuota
		}
		if err := os.Rename(tmpPath, dest); err != nil {
			if err := copyFile(tmpPath, dest); err != nil {
				return Item{}, err
			}
		}
		_ = os.Chmod(dest, 0o600)
	}
	it := Item{
		ID:        newID(),
		Kind:      kindFor(mime, name),
		CreatedAt: s.now().UTC(),
		Name:      cleanName(name),
		Size:      size,
		Mime:      mime,
		Blob:      hash,
	}
	s.items = append(s.items, it)
	if err := s.saveLocked(); err != nil {
		s.items = s.items[:len(s.items)-1]
		if !existed {
			_ = os.Remove(dest)
		}
		return Item{}, err
	}
	return it, nil
}

func (s *Store) MarkThumb(id string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			s.items[i].HasThumb = ok
			_ = s.saveLocked()
			return
		}
	}
}

func (s *Store) List(limit int, before string) ([]Public, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked()
	if limit <= 0 {
		limit = 40
	}
	if limit > 100 {
		limit = 100
	}
	vis := make([]Item, 0, len(s.items))
	for _, it := range s.items {
		if it.DeletedAt == nil {
			vis = append(vis, it)
		}
	}
	sortNewest(vis)
	start := 0
	if before != "" {
		start = 0
		found := false
		for i, it := range vis {
			if it.ID == before {
				start = i + 1
				found = true
				break
			}
		}
		if !found {
			start = 0
		}
	}
	end := start + limit
	more := end < len(vis)
	if end > len(vis) {
		end = len(vis)
	}
	out := make([]Public, 0, end-start)
	for _, it := range vis[start:end] {
		out = append(out, it.Public())
	}
	return out, more
}

func (s *Store) Get(id string) (Item, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, it := range s.items {
		if it.ID == id && it.DeletedAt == nil {
			return it, nil
		}
	}
	return Item{}, ErrNotFound
}

func (s *Store) BlobPath(it Item) (string, error) {
	if len(it.Blob) != 64 || !isHex(it.Blob) {
		return "", ErrNotFound
	}
	return filepath.Join(s.dir, "blobs", it.Blob), nil
}

func (s *Store) ThumbPath(it Item) (string, error) {
	if len(it.Blob) != 64 || !isHex(it.Blob) || !it.HasThumb {
		return "", ErrNotFound
	}
	return filepath.Join(s.dir, "thumbs", it.Blob+".jpg"), nil
}

// SoftDelete hides slips for the undo window. A secret is not offered an undo:
// the bar says the bytes are still there, and that is the one thing a secret
// should not promise. It is dropped at once, and the ids it returns are only
// the ones that can still be restored.
func (s *Store) SoftDelete(ids []string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	want := map[string]bool{}
	for _, id := range ids {
		if isHex(id) && len(id) == 16 {
			want[id] = true
		}
	}
	var done []string
	kept := make([]Item, 0, len(s.items))
	sweep := false
	for i := range s.items {
		it := s.items[i]
		if it.DeletedAt == nil && want[it.ID] {
			if it.Secret {
				sweep = true
				continue
			}
			t := now
			it.DeletedAt = &t
			done = append(done, it.ID)
		}
		kept = append(kept, it)
	}
	if len(done) == 0 && !sweep {
		return nil, ErrNotFound
	}
	s.items = kept
	if sweep {
		s.sweepLocked()
	}
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return done, nil
}

// SoftDeleteAll clears the board. Secrets are destroyed; everything else waits
// out the undo window.
func (s *Store) SoftDeleteAll() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	var done []string
	kept := make([]Item, 0, len(s.items))
	sweep := false
	for i := range s.items {
		it := s.items[i]
		if it.DeletedAt != nil {
			kept = append(kept, it)
			continue
		}
		if it.Secret {
			sweep = true
			continue
		}
		t := now
		it.DeletedAt = &t
		done = append(done, it.ID)
		kept = append(kept, it)
	}
	if len(done) == 0 && !sweep {
		return []string{}, nil
	}
	s.items = kept
	if sweep {
		s.sweepLocked()
	}
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return done, nil
}

func (s *Store) Restore(ids []string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	var done []string
	for i := range s.items {
		it := &s.items[i]
		if it.DeletedAt == nil || !want[it.ID] {
			continue
		}
		if now.Sub(*it.DeletedAt) > s.undo {
			continue
		}
		it.DeletedAt = nil
		done = append(done, it.ID)
	}
	if len(done) == 0 {
		return nil, ErrGone
	}
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return done, nil
}

func (s *Store) Purge() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked()
}

// purgeLocked drops slips whose undo window has passed and secrets whose time
// is up. An expired secret is removed outright: it was never waiting on an
// undo, and the whole point of the expiry is that the bytes stop existing.
func (s *Store) purgeLocked() {
	now := s.now()
	keep := make([]Item, 0, len(s.items))
	changed := false
	for _, it := range s.items {
		if it.DeletedAt != nil && now.Sub(*it.DeletedAt) > s.undo {
			changed = true
			continue
		}
		if it.ExpiresAt != nil && !now.Before(*it.ExpiresAt) {
			changed = true
			continue
		}
		keep = append(keep, it)
	}
	if !changed {
		return
	}
	s.items = keep
	s.sweepLocked()
	_ = s.saveLocked()
}

func (s *Store) sweepLocked() {
	need := map[string]bool{}
	for _, it := range s.items {
		if it.Blob != "" {
			need[it.Blob] = true
		}
	}
	sweepDir(filepath.Join(s.dir, "blobs"), func(name string) bool {
		return !need[name]
	})
	sweepDir(filepath.Join(s.dir, "thumbs"), func(name string) bool {
		hash := strings.TrimSuffix(name, ".jpg")
		return !need[hash]
	})
}

func (s *Store) usedLocked() int64 {
	var n int64
	entries, err := os.ReadDir(filepath.Join(s.dir, "blobs"))
	if err != nil {
		return 0
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err == nil {
			n += info.Size()
		}
	}
	return n
}

func (s *Store) saveLocked() error {
	b, err := json.MarshalIndent(s.items, "", "  ")
	if err != nil {
		return err
	}
	if s.items == nil {
		b = []byte("[]")
	}
	b = append(b, '\n')
	return writeAtomic(s.itemsPath(), b)
}

func (s *Store) itemsPath() string {
	return filepath.Join(s.dir, "items.json")
}

func (s *Store) Dir() string { return s.dir }

func sortNewest(items []Item) {
	for i := 1; i < len(items); i++ {
		j := i
		for j > 0 && newer(items[j], items[j-1]) {
			items[j], items[j-1] = items[j-1], items[j]
			j--
		}
	}
}

func newer(a, b Item) bool {
	if a.CreatedAt.Equal(b.CreatedAt) {
		return a.ID > b.ID
	}
	return a.CreatedAt.After(b.CreatedAt)
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func isHex(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		case r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}

func kindFor(mime, name string) string {
	m := strings.ToLower(strings.TrimSpace(mime))
	switch m {
	case "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif":
		return KindImage
	}
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif":
		return KindImage
	}
	return KindFile
}

func cleanName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\x00", ""))
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "file"
	}
	if utf8.RuneCountInString(name) > 180 {
		rs := []rune(name)
		name = string(rs[len(rs)-180:])
	}
	return name
}

func fileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func sweepDir(dir string, drop func(name string) bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if drop(e.Name()) {
			_ = os.Remove(filepath.Join(dir, e.Name()))
		}
	}
}

func writeAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	ok := false
	defer func() {
		if !ok {
			_ = os.Remove(tmp)
		}
	}()
	if err := f.Chmod(0o600); err != nil {
		f.Close()
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(path)
		if err2 := os.Rename(tmp, path); err2 != nil {
			return err
		}
	}
	ok = true
	return nil
}

func bytesTrim(b []byte) []byte {
	return []byte(strings.TrimSpace(string(b)))
}

// InlineOK reports whether a browser may render this type on the slip origin.
// SVG and HTML are never inline: a script there would be same-origin.
func InlineOK(it Item) bool {
	switch strings.ToLower(it.Mime) {
	case "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf":
		return true
	default:
		return false
	}
}
