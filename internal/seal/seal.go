// Package seal keeps the body of a secret slip as ciphertext under a code
// the person chooses.
//
// It answers exactly one threat: a copy of the data directory, whether from a
// backup, a Time Machine snapshot, or a disk that left the house. It does not
// encrypt the wire. The page is HTTP, so the code and the body cross the
// network in the clear when a slip is put down and again when it is read.
//
// The key is Argon2id over the code, so a stolen items.json is not a pile of
// readable tokens: it is a pile of material that costs 64 MiB and a few
// milliseconds per guess. An eight character code is about 40 bits, which is
// out of reach offline and still cheap enough to read off a screen and type on
// a phone.
package seal

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const (
	SaltLen  = 16
	NonceLen = 12
	KeyLen   = 32

	// MinCode matches the household passphrase. A shorter code would not
	// survive the offline guessing that a stolen file makes cheap.
	MinCode = 6
	MaxCode = 200
)

// Cost controls Argon2id. Tests pass a small Memory so the suite stays fast,
// the same way internal/auth does.
type Cost struct {
	Time    uint32
	Memory  uint32
	Threads uint8
}

// DefaultCost is the production cost: about the household passphrase, applied
// once when a slip is sealed and once when it is opened.
func DefaultCost() Cost {
	return Cost{Time: 2, Memory: 64 * 1024, Threads: 2}
}

func (c Cost) normalize() Cost {
	if c.Time == 0 {
		c.Time = 1
	}
	if c.Threads == 0 {
		c.Threads = 1
	}
	minMem := uint32(8 * c.Threads)
	if c.Memory < minMem {
		c.Memory = minMem
	}
	return c
}

// Wrapped is what the store keeps. Everything needed to try a code is here,
// and nothing about the body is.
type Wrapped struct {
	Salt  []byte `json:"salt"`
	Nonce []byte `json:"nonce"`
	CT    []byte `json:"ct"`
}

var (
	ErrCodeTooShort = errors.New("code_too_short")
	ErrCodeTooLong  = errors.New("code_too_long")
	ErrWrongCode    = errors.New("wrong_code")
)

// CheckCode reports whether a code may be used. Spaces around the code are
// ignored: it is read off a screen and typed on a phone, so a stray space is a
// typo rather than a different code. Case is not folded, because a person may
// type their own phrase.
func CheckCode(code string) error {
	switch n := utf8.RuneCountInString(strings.TrimSpace(code)); {
	case n < MinCode:
		return ErrCodeTooShort
	case n > MaxCode:
		return ErrCodeTooLong
	}
	return nil
}

func clean(code string) string {
	return strings.TrimSpace(code)
}

// Wrap seals plain under code. The caller keeps the code; this package never
// stores it anywhere.
func Wrap(c Cost, code string, plain []byte) (*Wrapped, error) {
	if err := CheckCode(code); err != nil {
		return nil, err
	}
	c = c.normalize()
	salt := make([]byte, SaltLen)
	nonce := make([]byte, NonceLen)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	gcm, err := gcmFor(c, code, salt)
	if err != nil {
		return nil, err
	}
	return &Wrapped{Salt: salt, Nonce: nonce, CT: gcm.Seal(nil, nonce, plain, nil)}, nil
}

// Open returns the body, or ErrWrongCode. A tampered ciphertext fails the GCM
// tag and reports the same error on purpose: the person cannot act on the
// difference, and saying which one happened would tell an attacker whether a
// guess produced a valid key.
func Open(c Cost, code string, w *Wrapped) ([]byte, error) {
	if w == nil || len(w.Salt) < 8 || len(w.Nonce) != NonceLen || len(w.CT) < 16 {
		return nil, ErrWrongCode
	}
	if err := CheckCode(code); err != nil {
		return nil, ErrWrongCode
	}
	gcm, err := gcmFor(c.normalize(), code, w.Salt)
	if err != nil {
		return nil, ErrWrongCode
	}
	plain, err := gcm.Open(nil, w.Nonce, w.CT, nil)
	if err != nil {
		return nil, ErrWrongCode
	}
	return plain, nil
}

func gcmFor(c Cost, code string, salt []byte) (cipher.AEAD, error) {
	key := argon2.IDKey([]byte(clean(code)), salt, c.Time, c.Memory, c.Threads, KeyLen)
	defer wipe(key)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// wipe is best effort. Go may have copied the key, so this is not a guarantee
// the bytes are gone from the heap; the docs say so rather than implying more.
func wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// codeAlphabet leaves out 0/O and 1/I/L, because the code is read off a screen
// and typed on a phone.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

// NewCode returns a fresh code, for a caller that does not want to invent one.
// Eight characters over this alphabet is about 40 bits. The rejection loop
// keeps the draw unbiased: 248 is the largest multiple of 31 below 256.
func NewCode() (string, error) {
	var sb strings.Builder
	for n := 0; n < 8; {
		var one [1]byte
		if _, err := rand.Read(one[:]); err != nil {
			return "", err
		}
		if int(one[0]) >= 248 {
			continue
		}
		if n == 4 {
			sb.WriteByte('-')
		}
		sb.WriteByte(codeAlphabet[int(one[0])%len(codeAlphabet)])
		n++
	}
	return sb.String(), nil
}
