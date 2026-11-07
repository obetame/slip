package handoff

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"
)

func digest(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// drain plays the receiver: it waits for the upload, reads the pipe dry,
// and closes the session. It is the only thing that can turn a transfer
// into a done one.
func drain(s *Session) chan error {
	done := make(chan error, 1)
	go func() {
		att, err := s.AttachPull(context.Background())
		if err != nil {
			done <- err
			return
		}
		for {
			_, more, nerr := att.Next(context.Background())
			if nerr != nil {
				done <- nerr
				return
			}
			if !more {
				break
			}
		}
		done <- att.EndDownload()
	}()
	return done
}

func TestTransferWritesOneRecord(t *testing.T) {
	h := New(nil)
	var landed []Info
	h.OnDone(func(i Info) { landed = append(landed, i) })

	payload := make([]byte, 3*Chunk+17)
	for i := range payload {
		payload[i] = byte(i)
	}
	s, err := h.Create("dev-a", "Mac", "big.bin", "application/octet-stream", int64(len(payload)), "")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("dev-b", "iPhone"); err != nil {
		t.Fatal(err)
	}
	nonce, err := s.Mint()
	if err != nil {
		t.Fatal(err)
	}
	if !s.TakeNonce(nonce) {
		t.Fatal("nonce rejected")
	}

	done := drain(s)
	att, err := s.AttachPush()
	if err != nil {
		t.Fatal(err)
	}
	for off := 0; off < len(payload); off += Chunk {
		end := off + Chunk
		if end > len(payload) {
			end = len(payload)
		}
		if err := att.Write(payload[off:end]); err != nil {
			t.Fatal(err)
		}
	}
	if err := att.EndUpload(int64(len(payload)), digest(payload)); err != nil {
		t.Fatal(err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	if len(landed) != 1 {
		t.Fatalf("records = %d", len(landed))
	}
	rec := landed[0]
	if rec.State != Done || rec.SHA256 != digest(payload) || rec.Size != int64(len(payload)) {
		t.Fatalf("record %+v", rec)
	}
	if rec.From != "Mac" || rec.To != "iPhone" {
		t.Fatalf("names %q %q", rec.From, rec.To)
	}
	// The session stays readable for the grace period, then goes.
	if got := s.Snapshot("dev-a"); got.State != Done || !got.Mine {
		t.Fatalf("after done %+v", got)
	}
}

// A body shorter than the promise must not leave a record, because a
// record that says "done" is a claim the file arrived whole.
func TestShortBodyFails(t *testing.T) {
	h := New(nil)
	var landed int
	h.OnDone(func(Info) { landed++ })

	s, err := h.Create("a", "Mac", "x.bin", "application/octet-stream", 100, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("b", "iPad"); err != nil {
		t.Fatal(err)
	}
	att, err := s.AttachPush()
	if err != nil {
		t.Fatal(err)
	}
	if err := att.Write(make([]byte, 40)); err != nil {
		t.Fatal(err)
	}
	if err := att.EndUpload(40, digest(make([]byte, 40))); err != ErrShort {
		t.Fatalf("err = %v", err)
	}
	if got := s.Snapshot("a").State; got != Failed {
		t.Fatalf("state = %s", got)
	}
	if landed != 0 {
		t.Fatal("a failed transfer left a record")
	}
}

func TestOnlyOneTaker(t *testing.T) {
	h := New(nil)
	s, err := h.Create("a", "Mac", "x.bin", "application/octet-stream", 10, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("b", "iPad"); err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("c", "Android"); err != ErrTaken {
		t.Fatalf("second take = %v", err)
	}
}

func TestOfferTo(t *testing.T) {
	h := New(nil)
	s, err := h.Create("a", "Mac", "x.bin", "application/octet-stream", 10, "dev-b")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("dev-c", "Android"); err != ErrNotFound {
		t.Fatalf("wrong taker = %v", err)
	}
	if err := s.Accept("dev-b", "iPad"); err != nil {
		t.Fatalf("right taker = %v", err)
	}
}

func TestBusyLimit(t *testing.T) {
	h := New(nil)
	if _, err := h.Create("a", "Mac", "1", "x", 1, ""); err != nil {
		t.Fatal(err)
	}
	// One open card per device.
	if _, err := h.Create("a", "Mac", "2", "x", 1, ""); err != ErrBusy {
		t.Fatalf("second from same device = %v", err)
	}
	if _, err := h.Create("b", "iPad", "3", "x", 1, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := h.Create("c", "Android", "4", "x", 1, ""); err != ErrBusy {
		t.Fatalf("third overall = %v", err)
	}
}

func TestSizes(t *testing.T) {
	h := New(nil)
	if _, err := h.Create("a", "Mac", "x", "x", 0, ""); err != ErrSize {
		t.Fatalf("zero = %v", err)
	}
	if _, err := h.Create("a", "Mac", "x", "x", MaxSize+1, ""); err != ErrTooLarge {
		t.Fatalf("huge = %v", err)
	}
}

func TestNonceSpendsAndExpires(t *testing.T) {
	cur := time.Now()
	h := New(func() time.Time { return cur })
	s, err := h.Create("a", "Mac", "x", "x", 8, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Mint(); err != ErrState {
		t.Fatalf("mint before accept = %v", err)
	}
	if err := s.Accept("b", "iPad"); err != nil {
		t.Fatal(err)
	}
	nonce, err := s.Mint()
	if err != nil {
		t.Fatal(err)
	}
	if s.TakeNonce("nope") {
		t.Fatal("wrong ticket accepted")
	}
	for i := 0; i < NonceUses; i++ {
		if !s.TakeNonce(nonce) {
			t.Fatalf("use %d rejected", i)
		}
	}
	if s.TakeNonce(nonce) {
		t.Fatal("ticket outlived its uses")
	}

	cur = cur.Add(NonceTTL + time.Second)
	nonce2, err := s.Mint()
	if err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(NonceTTL + time.Second)
	if s.TakeNonce(nonce2) {
		t.Fatal("expired ticket accepted")
	}
}

func TestSweepExpires(t *testing.T) {
	cur := time.Now()
	h := New(func() time.Time { return cur })
	s, err := h.Create("a", "Mac", "x", "x", 8, "")
	if err != nil {
		t.Fatal(err)
	}
	cur = cur.Add(OfferTTL + time.Second)
	h.Sweep()
	if got := s.Snapshot("a").State; got != Expired {
		t.Fatalf("state = %s", got)
	}
	// After the grace period the session is gone from the map.
	cur = cur.Add(EndGrace + time.Second)
	h.Sweep()
	if _, ok := h.Get(s.ID()); ok {
		t.Fatal("expired session kept")
	}
}

// The pipe is what keeps memory flat: a sender may run at most Slots
// chunks ahead of the receiver, and no further. If this ever stops
// blocking, a two gigabyte file starts living in RAM.
func TestPipeBlocksWhenTheReceiverIsSlow(t *testing.T) {
	h := New(nil)
	s, err := h.Create("a", "Mac", "x.bin", "x", int64(8*Chunk), "")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Accept("b", "iPad"); err != nil {
		t.Fatal(err)
	}
	att, err := s.AttachPush()
	if err != nil {
		t.Fatal(err)
	}
	let := make([]byte, Chunk)
	for i := 0; i < Slots; i++ {
		if err := att.Write(let); err != nil {
			t.Fatal(err)
		}
	}
	// The next write has nowhere to go.
	blocked := make(chan error, 1)
	go func() { blocked <- att.Write(let) }()
	select {
	case <-blocked:
		t.Fatal("pipe buffered past its slots")
	case <-time.After(50 * time.Millisecond):
	}
	// A reader frees a slot and the sender resumes.
	go func() {
		reader, err := s.AttachPull(context.Background())
		if err == nil {
			_, _, _ = reader.Next(context.Background())
		}
	}()
	select {
	case err := <-blocked:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("write never resumed")
	}
}

func TestDevices(t *testing.T) {
	cur := time.Now()
	h := New(func() time.Time { return cur })
	d := h.Devices()
	d.Touch("a", "Mac")
	d.Touch("b", "iPhone")
	if got := len(d.List()); got != 2 {
		t.Fatalf("devices = %d", got)
	}
	cur = cur.Add(DeviceTTL + time.Second)
	if got := len(d.List()); got != 0 {
		t.Fatalf("stale devices = %d", got)
	}
}

func TestListHidesOtherPeoplesFinishedCards(t *testing.T) {
	h := New(nil)
	s, err := h.Create("a", "Mac", "x", "x", 4, "")
	if err != nil {
		t.Fatal(err)
	}
	if got := len(h.List("stranger")); got != 1 {
		t.Fatalf("open card hidden: %d", got)
	}
	if err := s.Decline("a"); err != nil {
		t.Fatal(err)
	}
	if got := len(h.List("stranger")); got != 0 {
		t.Fatalf("finished card shown to stranger: %d", got)
	}
	if got := len(h.List("a")); got != 1 {
		t.Fatalf("finished card hidden from sender: %d", got)
	}
}
