package seal

import (
	"errors"
	"strings"
	"testing"
)

// cheap keeps the suite fast: the point of these tests is the envelope, not
// the strength of Argon2id, which internal/auth already exercises.
var cheap = Cost{Time: 1, Memory: 64, Threads: 1}

func TestWrapOpen(t *testing.T) {
	body := []byte("ghp_0fK3nQ7xT2vB9mR4sL8dY1cW6pA5zJ0h")
	w, err := Wrap(cheap, "K7QM-3XPD", body)
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}
	if len(w.Salt) != SaltLen || len(w.Nonce) != NonceLen {
		t.Fatalf("sizes: salt=%d nonce=%d", len(w.Salt), len(w.Nonce))
	}
	got, err := Open(cheap, "K7QM-3XPD", w)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if string(got) != string(body) {
		t.Fatalf("Open = %q, want %q", got, body)
	}
	// The ciphertext must not carry the body, obviously, but also must not
	// equal it by accident on a short body.
	if strings.Contains(string(w.CT), "ghp_") {
		t.Fatal("ciphertext contains the plaintext")
	}
}

func TestOpenWrongCode(t *testing.T) {
	w, err := Wrap(cheap, "K7QM-3XPD", []byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Open(cheap, "K7QM-3XPX", w); !errors.Is(err, ErrWrongCode) {
		t.Fatalf("Open with a wrong code = %v, want ErrWrongCode", err)
	}
	if _, err := Open(cheap, "", w); !errors.Is(err, ErrWrongCode) {
		t.Fatalf("Open with no code = %v, want ErrWrongCode", err)
	}
}

func TestOpenTampered(t *testing.T) {
	w, err := Wrap(cheap, "K7QM-3XPD", []byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	w.CT[0] ^= 0x01
	if _, err := Open(cheap, "K7QM-3XPD", w); !errors.Is(err, ErrWrongCode) {
		t.Fatalf("tampered ciphertext = %v, want ErrWrongCode", err)
	}
}

func TestOpenRejectsShortEnvelope(t *testing.T) {
	cases := []*Wrapped{
		nil,
		{},
		{Salt: make([]byte, SaltLen), Nonce: []byte{1, 2}, CT: make([]byte, 32)},
		{Salt: make([]byte, SaltLen), Nonce: make([]byte, NonceLen), CT: make([]byte, 4)},
	}
	for i, w := range cases {
		if _, err := Open(cheap, "K7QM-3XPD", w); !errors.Is(err, ErrWrongCode) {
			t.Errorf("case %d = %v, want ErrWrongCode", i, err)
		}
	}
}

func TestCheckCode(t *testing.T) {
	cases := []struct {
		code string
		want error
	}{
		{"", ErrCodeTooShort},
		{"12345", ErrCodeTooShort},
		{"123456", nil},
		{"  123456  ", nil},
		{strings.Repeat("a", MaxCode), nil},
		{strings.Repeat("a", MaxCode+1), ErrCodeTooLong},
	}
	for _, tc := range cases {
		if got := CheckCode(tc.code); !errors.Is(got, tc.want) {
			t.Errorf("CheckCode(%q) = %v, want %v", tc.code, got, tc.want)
		}
	}
}

func TestWrapRejectsShortCode(t *testing.T) {
	if _, err := Wrap(cheap, "12345", []byte("x")); !errors.Is(err, ErrCodeTooShort) {
		t.Fatalf("Wrap = %v, want ErrCodeTooShort", err)
	}
}

// TestCodeSpacesIgnored pins the one normalisation that exists: a code read
// off a screen and typed on a phone often arrives with a stray space.
func TestCodeSpacesIgnored(t *testing.T) {
	w, err := Wrap(cheap, " K7QM-3XPD ", []byte("body"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Open(cheap, "K7QM-3XPD", w); err != nil {
		t.Fatalf("Open without the spaces: %v", err)
	}
}

func TestNewCode(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 500; i++ {
		c, err := NewCode()
		if err != nil {
			t.Fatal(err)
		}
		if len(c) != 9 || c[4] != '-' {
			t.Fatalf("NewCode = %q, want 4-4 with a hyphen", c)
		}
		for _, r := range strings.Replace(c, "-", "", 1) {
			if !strings.ContainsRune(codeAlphabet, r) {
				t.Fatalf("NewCode = %q, %q is outside the alphabet", c, r)
			}
		}
		if seen[c] {
			t.Fatalf("NewCode repeated %q in 500 draws", c)
		}
		seen[c] = true
	}
}
