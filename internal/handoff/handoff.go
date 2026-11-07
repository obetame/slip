// Package handoff brokers a one-off file transfer between two browsers.
//
// Nothing is written to disk. The sender streams the file into a small
// in-memory pipe while the receiver's browser downloads out of it at the
// same time. slip only matches the two ends; when the last byte lands it
// leaves a metadata record on the board and nothing else.
//
// The pipe is bounded on purpose. Two 256 KB slots sit between the two
// ends, so a slow receiver pushes back through TCP into the sender's
// upload instead of growing memory. A session therefore costs at most
// half a megabyte no matter how large the file is.
//
// A session is not one pipe. A browser download can be cancelled and
// reissued by the browser, by a proxy, or by a download manager taking
// over, and a pipe is read once and cannot be replayed. So a session
// holds a sequence of attempts: each attempt is one upload paired with
// one download on a fresh pipe. The consent, the name, and the record
// outlive the attempts; only the bytes start over.
package handoff

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// State is where one handoff is in its life. Both pages read this, so
// the strings are part of the wire format.
type State string

const (
	Offered  State = "offered"
	Accepted State = "accepted"
	Sending  State = "sending"
	Done     State = "done"
	Declined State = "declined"
	Failed   State = "failed"
	Expired  State = "expired"
)

const (
	// Chunk is how much moves per pipe write, and also the granularity
	// the receiver flushes at.
	Chunk = 256 << 10
	// Slots is how many chunks may sit between the two ends.
	Slots = 2
	// OfferTTL is how long a card waits for someone to take it.
	OfferTTL = 5 * time.Minute
	// AcceptTTL is how long the two ends have to show up after a take,
	// and also how long a dropped attempt waits for a new one.
	AcceptTTL = 60 * time.Second
	// AttachWait bounds how long a download hangs waiting for its upload.
	// The sender polls once a second, so a healthy transfer attaches
	// almost at once; this ceiling is for the case where that page is
	// gone, and the person should not stare at a stalled download.
	AttachWait = 15 * time.Second
	// SendTTL is the ceiling on one attempt, so a stalled session
	// cannot hold a slot forever.
	SendTTL = 30 * time.Minute
	// EndGrace keeps a finished session readable long enough for both
	// pages to notice before it is dropped.
	EndGrace = 2 * time.Minute
	// NonceUses is how many times one pull ticket may be shown. Browsers
	// and download managers retry, and a retry must not be locked out.
	// One take is a HEAD plus a GET, and a takeover adds another pair,
	// so this is generous on purpose.
	NonceUses = 16
	// NonceTTL is how long a pull ticket lives. It covers a whole
	// attempt plus a restart, because the retry reuses the same URL.
	NonceTTL = 10 * time.Minute
	// PreemptGrace is how long a download must have held the pipe before
	// a newer request may replace it. It keeps a browser that fires two
	// requests in the same instant from killing its own transfer, while
	// still letting a download manager take over.
	PreemptGrace = 400 * time.Millisecond
	// MaxAttempts caps how many times a dropped transfer restarts. The
	// sender re-reads its file from the beginning each time, so this is
	// the point where trying again stops being kind.
	MaxAttempts = 4
	// MaxLive caps concurrent sessions. Two fits a household and bounds
	// the pipe memory at one megabyte.
	MaxLive = 2
	// MaxSize is a sanity cap on what may be offered, not a limit of the
	// mechanism.
	MaxSize = 64 << 30
)

var (
	ErrNotFound = errors.New("not_found")
	ErrTaken    = errors.New("already_taken")
	ErrState    = errors.New("state")
	ErrGone     = errors.New("gone")
	ErrBusy     = errors.New("busy")
	ErrSize     = errors.New("size")
	ErrTooLarge = errors.New("too_large")
	ErrShort    = errors.New("short")
	// ErrPulling is a second download of the same one-pass attempt. It
	// is not "the card was taken"; it is "this pipe has one reader".
	ErrPulling = errors.New("one_shot")
	// ErrRestart says this attempt is over but the handoff is not: a
	// fresh pipe is ready and both ends should go again.
	ErrRestart = errors.New("restart")
	// ErrReaderGone says the download disappeared. It is recoverable,
	// which is the whole point of having attempts.
	ErrReaderGone = errors.New("reader_gone")
)

// Info is the browser view of one session. It carries no paths and no
// bytes, only what a card needs to draw itself.
type Info struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	Mime       string    `json:"mime,omitempty"`
	State      State     `json:"state"`
	From       string    `json:"from"`
	FromID     string    `json:"fromId"`
	To         string    `json:"to,omitempty"`
	ToID       string    `json:"toId,omitempty"`
	Mine       bool      `json:"mine,omitempty"`
	Sent       int64     `json:"sent"`
	SHA256     string    `json:"sha256,omitempty"`
	DurationMS int64     `json:"durationMs,omitempty"`
	ExpiresAt  time.Time `json:"expiresAt"`
	// Gen counts attempts. Both pages watch it: a change means the pipe
	// was replaced and the upload has to start over.
	Gen int `json:"gen"`
}

// pipe is one attempt's plumbing. A session replaces it whenever a
// download drops, so a stale reader or writer can never touch the new
// one.
type pipe struct {
	ctx       context.Context
	cancel    context.CancelFunc
	buf       chan []byte
	pushIn    chan struct{}
	closeBuf  sync.Once
	closePush sync.Once
	pulling   bool
	// attachedAt is when the current reader took the slot. A newer
	// request may only replace a download that has had a moment to
	// prove itself.
	attachedAt time.Time
	sent       int64
	sha        string
	uploaded   bool
}

func newPipe() *pipe {
	ctx, cancel := context.WithCancel(context.Background())
	return &pipe{
		ctx:    ctx,
		cancel: cancel,
		buf:    make(chan []byte, Slots),
		pushIn: make(chan struct{}),
	}
}

// Attempt is one upload paired with one download. Handlers hold one for
// the whole request, so a restart elsewhere cannot redirect their bytes
// into the next pipe.
type Attempt struct {
	s *Session
	p *pipe
}

// Session is one transfer. Every field that a handler reads is guarded
// by mu; the channels carry the handshake between the ends.
type Session struct {
	hub *Hub
	now func() time.Time

	mu       sync.Mutex
	id       string
	name     string
	size     int64
	mime     string
	fromID   string
	fromName string
	toID     string
	toName   string
	state    State
	reason   string
	created  time.Time
	expires  time.Time
	started  time.Time
	ended    time.Time
	nonce    string
	nonceEnd time.Time
	nonceN   int
	gen      int
	tries    int
	cur      *pipe
	sha      string

	ctx    context.Context
	cancel context.CancelFunc
}

func newSession(h *Hub, id, name, mime, fromID, fromName, toID string, size int64) *Session {
	clock := h.now
	start := clock()
	ctx, cancel := context.WithCancel(context.Background())
	return &Session{
		hub:      h,
		now:      clock,
		id:       id,
		name:     name,
		size:     size,
		mime:     mime,
		fromID:   fromID,
		fromName: fromName,
		toID:     toID,
		state:    Offered,
		created:  start,
		expires:  start.Add(OfferTTL),
		cur:      newPipe(),
		ctx:      ctx,
		cancel:   cancel,
	}
}

// ID is the session's public identifier.
func (s *Session) ID() string { return s.id }

// Size is what the sender promised in bytes.
func (s *Session) Size() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.size
}

// Name is the file name the sender picked, already cleaned.
func (s *Session) Name() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.name
}

// FromID is who offered the file.
func (s *Session) FromID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.fromID
}

// Pulling reports whether a download already holds the consumer slot.
func (s *Session) Pulling() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cur.pulling
}

// Snapshot copies the session for a browser. viewer is true when that
// device is one of the two ends.
func (s *Session) Snapshot(viewer string) Info {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.snapshotLocked(viewer)
}

func (s *Session) snapshotLocked(viewer string) Info {
	out := Info{
		ID:        s.id,
		Name:      s.name,
		Size:      s.size,
		Mime:      s.mime,
		State:     s.state,
		From:      s.fromName,
		FromID:    s.fromID,
		To:        s.toName,
		ToID:      s.toID,
		Sent:      s.cur.sent,
		ExpiresAt: s.expires,
		Gen:       s.gen,
	}
	if viewer != "" && (viewer == s.fromID || viewer == s.toID) {
		out.Mine = true
	}
	if s.state == Done {
		out.SHA256 = s.sha
		if !s.started.IsZero() && !s.ended.IsZero() {
			out.DurationMS = s.ended.Sub(s.started).Milliseconds()
		}
	}
	return out
}

// Accept claims an open offer for one device. Only the first caller
// wins; the rest are told the card is taken.
func (s *Session) Accept(deviceID, deviceName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state == Accepted {
		if s.toID == deviceID {
			// The same device taking it again after a dropped attempt.
			// That is a retry, not a conflict.
			s.expires = s.now().Add(AcceptTTL)
			return nil
		}
		// Someone else got there first; say so plainly rather than
		// "wrong state", which the page would have to translate.
		return ErrTaken
	}
	if s.state != Offered {
		return stateErr(s.state)
	}
	if s.toID != "" && s.toID != deviceID {
		return ErrNotFound
	}
	if s.fromID == deviceID {
		return ErrState
	}
	s.state = Accepted
	s.toID = deviceID
	s.toName = deviceName
	s.expires = s.now().Add(AcceptTTL)
	return nil
}

// Mint creates a pull ticket. The receiver's browser presents it on the
// download, because a download cannot carry the X-Slip header.
func (s *Session) Mint() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state != Accepted && s.state != Sending {
		return "", stateErr(s.state)
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	s.nonce = hex.EncodeToString(b)
	s.nonceEnd = s.now().Add(NonceTTL)
	s.nonceN = NonceUses
	return s.nonce, nil
}

// CheckNonce reports whether a pull ticket would be accepted, without
// spending one of its uses. A HEAD probe must not cost the download that
// follows it.
func (s *Session) CheckNonce(n string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nonce == "" || n == "" || n != s.nonce {
		return false
	}
	return s.now().Before(s.nonceEnd) && s.nonceN > 0
}

// TakeNonce checks and spends a pull ticket.
func (s *Session) TakeNonce(n string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nonce == "" || n == "" || n != s.nonce {
		return false
	}
	if s.now().After(s.nonceEnd) || s.nonceN <= 0 {
		s.nonce = ""
		return false
	}
	s.nonceN--
	return true
}

// Decline withdraws a card nobody took.
func (s *Session) Decline(deviceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state != Offered && s.state != Accepted && s.state != Sending {
		return stateErr(s.state)
	}
	if s.toID != "" && s.toID != deviceID && s.fromID != deviceID {
		return ErrNotFound
	}
	s.state = Declined
	s.ended = s.now()
	s.cancel()
	return nil
}

// Fail aborts a session and wakes both ends.
func (s *Session) Fail(reason string) {
	s.mu.Lock()
	if terminal(s.state) {
		s.mu.Unlock()
		return
	}
	s.state = Failed
	s.reason = reason
	s.ended = s.now()
	s.cur.cancel()
	s.mu.Unlock()
	s.cancel()
}

// Abort is Fail under the name a handler uses.
func (s *Session) Abort(reason string) { s.Fail(reason) }

// AttachPush registers the uploader for one attempt and opens the gate
// the download is waiting behind.
func (s *Session) AttachPush() (*Attempt, error) {
	s.mu.Lock()
	switch s.state {
	case Accepted:
		s.state = Sending
		s.started = s.now()
		s.expires = s.started.Add(SendTTL)
	case Sending:
		s.mu.Unlock()
		return nil, ErrTaken
	default:
		st := s.state
		s.mu.Unlock()
		return nil, stateErr(st)
	}
	p := s.cur
	s.mu.Unlock()
	p.closePush.Do(func() { close(p.pushIn) })
	return &Attempt{s: s, p: p}, nil
}

// AttachPull takes the single consumer slot and waits for the uploader.
// Until it returns, the download must not write a single byte: a browser
// that gets headers and then silence may give up on the file. A second
// caller while one is waiting is refused, because two readers on one
// pipe would split the stream and both would land short.
func (s *Session) AttachPull(ctx context.Context) (*Attempt, error) {
	s.mu.Lock()
	p := s.cur
	if p.pulling {
		s.mu.Unlock()
		return nil, ErrPulling
	}
	if s.state != Accepted && s.state != Sending {
		st := s.state
		s.mu.Unlock()
		return nil, stateErr(st)
	}
	p.pulling = true
	p.attachedAt = s.now()
	s.mu.Unlock()

	a := &Attempt{s: s, p: p}
	timer := time.NewTimer(AttachWait)
	defer timer.Stop()
	select {
	case <-p.pushIn:
		return a, nil
	case <-timer.C:
		a.release()
		return nil, ErrGone
	case <-p.ctx.Done():
		a.release()
		return nil, ErrRestart
	case <-ctx.Done():
		a.release()
		return nil, ErrReaderGone
	}
}

// Preempt cancels the download currently holding the pipe so a newer
// request can take over. A download manager grabs the URL from the
// browser and requests it itself, leaving two consumers for one pipe;
// whichever asked last is the one the person is waiting on.
//
// It refuses inside PreemptGrace, and it counts against MaxAttempts, so
// a client that hammers the URL cannot restart a transfer forever.
func (s *Session) Preempt() bool {
	s.mu.Lock()
	p := s.cur
	if s.state != Sending || !p.pulling {
		s.mu.Unlock()
		return false
	}
	if s.now().Sub(p.attachedAt) < PreemptGrace {
		s.mu.Unlock()
		return false
	}
	if s.tries+1 >= MaxAttempts {
		s.mu.Unlock()
		return false
	}
	s.tries++
	s.gen++
	s.state = Accepted
	s.expires = s.now().Add(AcceptTTL)
	old := s.cur
	s.cur = newPipe()
	s.mu.Unlock()

	// Release the reader and the writer on the old pipe. Both handlers
	// see ErrRestart and step aside; the sender comes back on its own.
	old.cancel()
	return true
}

func (a *Attempt) release() {
	a.s.mu.Lock()
	a.p.pulling = false
	a.s.mu.Unlock()
}

// Write hands one chunk to the pipe, blocking while both slots are full.
// That block is the backpressure that keeps memory flat.
func (a *Attempt) Write(b []byte) error {
	select {
	case a.p.buf <- b:
		a.s.mu.Lock()
		a.p.sent += int64(len(b))
		a.s.mu.Unlock()
		return nil
	case <-a.p.ctx.Done():
		return ErrRestart
	case <-a.s.ctx.Done():
		return ErrGone
	}
}

// Next returns the next chunk. more is false once the uploader closed
// the pipe, which is the normal end. A non-nil error means this attempt
// is over for another reason: the reader went away, a restart replaced
// the pipe, or the session died.
func (a *Attempt) Next(ctx context.Context) (chunk []byte, more bool, err error) {
	select {
	case b, ok := <-a.p.buf:
		if !ok {
			return nil, false, nil
		}
		return b, true, nil
	case <-a.p.ctx.Done():
		return nil, false, ErrRestart
	case <-ctx.Done():
		return nil, false, ErrReaderGone
	case <-a.s.ctx.Done():
		return nil, false, ErrGone
	}
}

// EndUpload records what actually went through and only then closes the
// pipe. The order matters: closing wakes the receiver, and a receiver
// that wakes before the digest is recorded would see an incomplete
// attempt and call a finished transfer short.
func (a *Attempt) EndUpload(n int64, sha string) error {
	s := a.s
	s.mu.Lock()
	a.p.sent = n
	a.p.sha = sha
	short := n != s.size
	if !short {
		a.p.uploaded = true
	}
	st := s.state
	if short && st == Sending && s.cur == a.p {
		s.state = Failed
		s.reason = "short"
		s.ended = s.now()
	}
	s.mu.Unlock()

	a.p.closeBuf.Do(func() { close(a.p.buf) })

	if st == Done {
		// The receiver already finished and wrote the record. That is a
		// success, whatever this side's view of the state is.
		return nil
	}
	if short {
		s.cancel()
		return ErrShort
	}
	if st != Sending {
		return ErrGone
	}
	return nil
}

// EndDownload is the last step of an attempt: it decides whether the
// record gets written. Only a reader that drained the whole declared
// length, after an uploader that finished, can close the session.
func (a *Attempt) EndDownload() error {
	s := a.s
	s.mu.Lock()
	a.p.pulling = false
	if s.cur != a.p {
		// A newer attempt replaced this one; nothing to decide here.
		s.mu.Unlock()
		return ErrGone
	}
	if s.state != Sending {
		st := s.state
		s.mu.Unlock()
		return stateErr(st)
	}
	if s.size <= 0 || !a.p.uploaded || a.p.sent != s.size {
		s.mu.Unlock()
		a.LoseReader()
		return ErrShort
	}
	s.state = Done
	s.ended = s.now()
	s.sha = a.p.sha
	info := s.snapshotLocked("")
	s.mu.Unlock()

	if s.hub != nil {
		s.hub.finished(info)
	}
	return nil
}

// LoseReader puts the session back to Accepted with a fresh pipe, so a
// browser that reissues the download, or a download manager that took
// the first one over, gets a second chance. The bytes start over; the
// consent does not.
func (a *Attempt) LoseReader() {
	s := a.s
	s.mu.Lock()
	if s.cur != a.p || s.state != Sending {
		a.p.pulling = false
		s.mu.Unlock()
		return
	}
	a.p.pulling = false
	s.tries++
	if s.tries >= MaxAttempts {
		s.state = Failed
		s.reason = "interrupted"
		s.ended = s.now()
		old := s.cur
		s.mu.Unlock()
		old.cancel()
		s.cancel()
		return
	}
	s.gen++
	s.state = Accepted
	s.expires = s.now().Add(AcceptTTL)
	old := s.cur
	s.cur = newPipe()
	s.mu.Unlock()
	// Release the uploader still holding the old pipe, so its handler
	// returns ErrRestart and the page can send again.
	old.cancel()
}

func stateErr(st State) error {
	switch st {
	case Done, Failed, Expired, Declined:
		return ErrGone
	case Sending:
		return ErrTaken
	default:
		return ErrState
	}
}

func terminal(st State) bool {
	return st == Done || st == Failed || st == Expired || st == Declined
}

// Hub owns the live sessions. It is the only writer of session state.
type Hub struct {
	mu     sync.Mutex
	live   map[string]*Session
	devs   *Devices
	now    func() time.Time
	onDone func(Info)
}

// New makes a hub. now may be nil, which means the wall clock.
func New(now func() time.Time) *Hub {
	if now == nil {
		now = time.Now
	}
	return &Hub{
		live: map[string]*Session{},
		devs: newDevices(now),
		now:  now,
	}
}

// SetClock is for tests. Sessions capture the clock when they are
// created, so set it before opening any.
func (h *Hub) SetClock(now func() time.Time) {
	if now == nil {
		return
	}
	h.mu.Lock()
	h.now = now
	h.mu.Unlock()
	h.devs.SetClock(now)
}

// Devices is the presence table the sender reads to know whether anyone
// else is around to take a card.
func (h *Hub) Devices() *Devices { return h.devs }

// OnDone installs the one callback that runs when a transfer lands. It
// is how the board record gets written without this package knowing
// anything about storage.
func (h *Hub) OnDone(fn func(Info)) {
	h.mu.Lock()
	h.onDone = fn
	h.mu.Unlock()
}

func (h *Hub) finished(info Info) {
	h.mu.Lock()
	fn := h.onDone
	h.mu.Unlock()
	if fn != nil {
		fn(info)
	}
}

// Create opens a new offer. Size and the per-device and global counts
// are checked here so a misbehaving page cannot exhaust the pipe memory.
func (h *Hub) Create(fromID, fromName, name, mime string, size int64, toID string) (*Session, error) {
	if size <= 0 {
		return nil, ErrSize
	}
	if size > MaxSize {
		return nil, ErrTooLarge
	}
	h.mu.Lock()
	active, mine := 0, 0
	for _, s := range h.live {
		if s.open() {
			active++
			if s.FromID() == fromID {
				mine++
			}
		}
	}
	if active >= MaxLive || mine >= 1 {
		h.mu.Unlock()
		return nil, ErrBusy
	}
	id, err := newID()
	if err != nil {
		h.mu.Unlock()
		return nil, err
	}
	s := newSession(h, id, name, mime, fromID, fromName, toID, size)
	h.live[id] = s
	h.mu.Unlock()
	return s, nil
}

// Get looks up a session by its id.
func (h *Hub) Get(id string) (*Session, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.live[id]
	return s, ok
}

// List returns the sessions one device may see: every open card, plus
// anything it is part of so a finished transfer can still be reported.
func (h *Hub) List(deviceID string) []Info {
	h.mu.Lock()
	all := make([]*Session, 0, len(h.live))
	for _, s := range h.live {
		all = append(all, s)
	}
	h.mu.Unlock()

	out := make([]Info, 0, len(all))
	for _, s := range all {
		info := s.Snapshot(deviceID)
		if terminal(info.State) && !info.Mine {
			// A finished session is only worth showing to the two ends.
			continue
		}
		out = append(out, info)
	}
	sortInfo(out)
	return out
}

// Sweep expires what timed out and drops what has been finished for a
// while. The janitor calls it on a ticker.
func (h *Hub) Sweep() {
	now := h.now()
	h.mu.Lock()
	defer h.mu.Unlock()
	for id, s := range h.live {
		drop := false
		s.mu.Lock()
		switch s.state {
		case Offered:
			if now.After(s.expires) {
				s.state = Expired
				s.ended = now
				s.cur.cancel()
			}
		case Accepted:
			if now.After(s.expires) {
				s.state = Expired
				s.ended = now
				s.cur.cancel()
			}
		case Sending:
			if now.After(s.expires) {
				s.state = Failed
				s.reason = "timeout"
				s.ended = now
				s.cur.cancel()
				s.cancel()
			}
		case Done, Failed, Declined, Expired:
			drop = now.Sub(s.ended) > EndGrace
		}
		s.mu.Unlock()
		if drop {
			delete(h.live, id)
		}
	}
}

func (s *Session) open() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !terminal(s.state)
}

// newID makes a sixteen hex character id, the same shape as a slip id.
func newID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sortInfo(list []Info) {
	for i := 1; i < len(list); i++ {
		for j := i; j > 0 && list[j].ExpiresAt.Before(list[j-1].ExpiresAt); j-- {
			list[j], list[j-1] = list[j-1], list[j]
		}
	}
}
