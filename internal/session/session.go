package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const Lifetime = 180 * 24 * time.Hour

// Book stores sha256 hashes of session tokens, never the tokens themselves.
type Book struct {
	mu   sync.Mutex
	path string
	exp  map[string]time.Time
	now  func() time.Time
}

func Open(dir string, now func() time.Time) (*Book, error) {
	if now == nil {
		now = time.Now
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	b := &Book{
		path: filepath.Join(dir, "sessions.json"),
		exp:  map[string]time.Time{},
		now:  now,
	}
	raw, err := os.ReadFile(b.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return b, nil
		}
		return nil, err
	}
	if len(raw) == 0 {
		return b, nil
	}
	if err := json.Unmarshal(raw, &b.exp); err != nil {
		return nil, err
	}
	b.purgeLocked()
	return b, nil
}

// Put creates a new token and remembers its hash until Lifetime from now.
func (b *Book) Put() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := hex.EncodeToString(buf)
	b.mu.Lock()
	defer b.mu.Unlock()
	b.purgeLocked()
	b.exp[hash(token)] = b.now().Add(Lifetime)
	if err := b.saveLocked(); err != nil {
		delete(b.exp, hash(token))
		return "", err
	}
	return token, nil
}

func (b *Book) Valid(token string) bool {
	if token == "" {
		return false
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	until, ok := b.exp[hash(token)]
	if !ok {
		return false
	}
	if !b.now().Before(until) {
		delete(b.exp, hash(token))
		_ = b.saveLocked()
		return false
	}
	return true
}

func (b *Book) Delete(token string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.exp, hash(token))
	return b.saveLocked()
}

// DeleteExcept drops every session but the caller's.
func (b *Book) DeleteExcept(token string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	keep := hash(token)
	next := map[string]time.Time{}
	if until, ok := b.exp[keep]; ok {
		next[keep] = until
	}
	b.exp = next
	return b.saveLocked()
}

func (b *Book) DeleteAll() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.exp = map[string]time.Time{}
	return b.saveLocked()
}

func (b *Book) purgeLocked() {
	now := b.now()
	changed := false
	for k, until := range b.exp {
		if !now.Before(until) {
			delete(b.exp, k)
			changed = true
		}
	}
	if changed {
		_ = b.saveLocked()
	}
}

func (b *Book) saveLocked() error {
	raw, err := json.MarshalIndent(b.exp, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	dir := filepath.Dir(b.path)
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
	if _, err := f.Write(raw); err != nil {
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
	if err := os.Rename(tmp, b.path); err != nil {
		_ = os.Remove(b.path)
		if err2 := os.Rename(tmp, b.path); err2 != nil {
			return err
		}
	}
	ok = true
	return nil
}

func hash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
