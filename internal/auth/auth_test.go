package auth

import "testing"

func TestHashAndVerify(t *testing.T) {
	p := Params{Time: 1, Memory: 64, Threads: 1}
	enc, err := Hash("123456", p)
	if err != nil {
		t.Fatal(err)
	}
	if !Verify("123456", enc) {
		t.Fatal("expected match")
	}
	if Verify("1234567", enc) {
		t.Fatal("expected mismatch")
	}
	if Verify("123456", enc+"x") {
		t.Fatal("tampered hash should fail")
	}
}

func TestPassphraseLength(t *testing.T) {
	p := Params{Time: 1, Memory: 64, Threads: 1}
	if _, err := Hash("12345", p); err != ErrTooShort {
		t.Fatalf("got %v", err)
	}
	if _, err := Hash("家里口令", p); err != ErrTooShort {
		t.Fatalf("got %v", err)
	}
	if _, err := Hash("家里的口令啊", p); err != nil {
		t.Fatal(err)
	}
	long := make([]rune, MaxPassphrase+1)
	for i := range long {
		long[i] = 'a'
	}
	if _, err := Hash(string(long), p); err != ErrTooLong {
		t.Fatalf("got %v", err)
	}
}
