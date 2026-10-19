package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Config is the on-disk household settings. The passphrase is stored
// only as an Argon2id hash. Mode 0600.
type Config struct {
	mu             sync.Mutex
	path           string
	Port           int       `json:"port,omitempty"`
	PassphraseHash string    `json:"passphraseHash,omitempty"`
	CreatedAt      time.Time `json:"createdAt,omitempty"`
}

func Open(dir string) (*Config, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	c := &Config{path: filepath.Join(dir, "config.json")}
	b, err := os.ReadFile(c.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return c, nil
		}
		return nil, err
	}
	if len(b) == 0 {
		return c, nil
	}
	if err := json.Unmarshal(b, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (c *Config) HasPassphrase() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.PassphraseHash != ""
}

func (c *Config) Hash() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.PassphraseHash
}

func (c *Config) SavedPort() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Port
}

func (c *Config) SetPassphrase(hash string, now time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.PassphraseHash = hash
	if c.CreatedAt.IsZero() {
		c.CreatedAt = now.UTC()
	}
	return c.saveLocked()
}

func (c *Config) SetPort(port int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Port == port {
		return nil
	}
	c.Port = port
	return c.saveLocked()
}

func (c *Config) saveLocked() error {
	b, err := json.MarshalIndent(struct {
		Port           int       `json:"port,omitempty"`
		PassphraseHash string    `json:"passphraseHash,omitempty"`
		CreatedAt      time.Time `json:"createdAt,omitempty"`
	}{c.Port, c.PassphraseHash, c.CreatedAt}, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	return writeAtomic(c.path, b)
}

func writeAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	cleanup := true
	defer func() {
		if cleanup {
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
	cleanup = false
	return nil
}
