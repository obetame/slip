package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const (
	MinPassphrase = 6
	MaxPassphrase = 200
	keyLen        = 32
)

// Params controls Argon2id. Production uses DefaultParams.
// Tests can pass a much smaller Memory value.
type Params struct {
	Time    uint32
	Memory  uint32
	Threads uint8
}

// DefaultParams is the household login cost: about a tenth of a second
// and 64 MiB on a recent Mac, enough to make guessing slow.
func DefaultParams() Params {
	return Params{Time: 2, Memory: 64 * 1024, Threads: 2}
}

func (p Params) normalize() Params {
	if p.Time == 0 {
		p.Time = 1
	}
	if p.Threads == 0 {
		p.Threads = 1
	}
	minMem := uint32(8 * p.Threads)
	if p.Memory < minMem {
		p.Memory = minMem
	}
	return p
}

// CheckPassphrase reports whether a new passphrase may be stored.
func CheckPassphrase(pw string) error {
	n := utf8.RuneCountInString(pw)
	switch {
	case n < MinPassphrase:
		return ErrTooShort
	case n > MaxPassphrase:
		return ErrTooLong
	default:
		return nil
	}
}

var (
	ErrTooShort = fmt.Errorf("passphrase_too_short")
	ErrTooLong  = fmt.Errorf("passphrase_too_long")
)

// Hash returns a PHC-style argon2id string. The passphrase is not trimmed.
func Hash(pw string, p Params) (string, error) {
	if err := CheckPassphrase(pw); err != nil {
		return "", err
	}
	p = p.normalize()
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	sum := argon2.IDKey([]byte(pw), salt, p.Time, p.Memory, p.Threads, keyLen)
	return fmt.Sprintf(
		"argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		p.Memory, p.Time, p.Threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(sum),
	), nil
}

// Verify checks a passphrase against a stored hash.
func Verify(pw, encoded string) bool {
	p, salt, want, ok := parse(encoded)
	if !ok {
		return false
	}
	got := argon2.IDKey([]byte(pw), salt, p.Time, p.Memory, p.Threads, keyLen)
	if len(got) != len(want) {
		return false
	}
	return subtle.ConstantTimeCompare(got, want) == 1
}

func parse(encoded string) (Params, []byte, []byte, bool) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[0] != "argon2id" || parts[1] != "v=19" {
		return Params{}, nil, nil, false
	}
	var p Params
	for _, field := range strings.Split(parts[2], ",") {
		kv := strings.SplitN(field, "=", 2)
		if len(kv) != 2 {
			return Params{}, nil, nil, false
		}
		n, err := strconv.ParseUint(kv[1], 10, 32)
		if err != nil {
			return Params{}, nil, nil, false
		}
		switch kv[0] {
		case "m":
			p.Memory = uint32(n)
		case "t":
			p.Time = uint32(n)
		case "p":
			if n == 0 || n > 255 {
				return Params{}, nil, nil, false
			}
			p.Threads = uint8(n)
		default:
			return Params{}, nil, nil, false
		}
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil || len(salt) == 0 {
		return Params{}, nil, nil, false
	}
	sum, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(sum) == 0 {
		return Params{}, nil, nil, false
	}
	return p, salt, sum, true
}
