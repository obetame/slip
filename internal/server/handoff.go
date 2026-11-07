package server

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/obetame/slip/internal/handoff"
	"github.com/obetame/slip/internal/store"
)

// deviceCookie names the browser. It is not a login: the passphrase is
// still the only lock. This is how a card knows which page offered a
// file and which page took it, so "mine" and "theirs" can be told apart
// without an account.
const deviceCookie = "slip_device"

// device reads, and if needed mints, the browser's identity, and marks
// it present. It sets a Set-Cookie header, so it must run before the
// handler writes a status.
func (s *Server) device(w http.ResponseWriter, r *http.Request) handoff.Device {
	id := ""
	if c, err := r.Cookie(deviceCookie); err == nil {
		id = c.Value
	}
	if !validDeviceID(id) {
		id = newDeviceID()
		http.SetCookie(w, &http.Cookie{
			Name:     deviceCookie,
			Value:    id,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   365 * 24 * 3600,
		})
	}
	name := deviceName(r.UserAgent())
	if s.authed(r) {
		s.hub.Devices().Touch(id, name)
	}
	return handoff.Device{ID: id, Name: name}
}

func newDeviceID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "0000000000000000"
	}
	return hex.EncodeToString(b)
}

func validDeviceID(id string) bool {
	if len(id) != 16 {
		return false
	}
	for _, r := range id {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		default:
			return false
		}
	}
	return true
}

// deviceName is the short label a card shows for the other end. It is a
// guess from the user agent, not something the browser declares, because
// there is nowhere to declare it.
func deviceName(ua string) string {
	low := strings.ToLower(ua)
	kind := "Web"
	switch {
	case strings.Contains(low, "iphone"):
		kind = "iPhone"
	case strings.Contains(low, "ipad"):
		kind = "iPad"
	case strings.Contains(low, "android"):
		kind = "Android"
	case strings.Contains(low, "macintosh"), strings.Contains(low, "mac os x"):
		kind = "Mac"
	case strings.Contains(low, "windows"):
		kind = "Windows"
	case strings.Contains(low, "linux"):
		kind = "Linux"
	}
	browser := ""
	switch {
	case strings.Contains(low, "edg/"):
		browser = "Edge"
	case strings.Contains(low, "opr/"):
		browser = "Opera"
	case strings.Contains(low, "chrome"), strings.Contains(low, "crios"):
		browser = "Chrome"
	case strings.Contains(low, "firefox"), strings.Contains(low, "fxios"):
		browser = "Firefox"
	case strings.Contains(low, "safari"):
		browser = "Safari"
	}
	if browser == "" || browser == kind {
		return kind
	}
	return kind + " · " + browser
}

// createHandoff opens a card. No bytes move here: the sender has only
// said what it wants to hand over.
func (s *Server) createHandoff(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	var body struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
		Mime string `json:"mime"`
		To   string `json:"to"`
	}
	if err := readJSON(w, r, &body, 8<<10); err != nil {
		writeJSONErr(w, err)
		return
	}
	dev := s.device(w, r)
	mimeType := strings.TrimSpace(body.Mime)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	sess, err := s.hub.Create(dev.ID, dev.Name, store.CleanName(body.Name), mimeType, body.Size, body.To)
	if err != nil {
		writeHandoffErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"handoff": sess.Snapshot(dev.ID)})
}

func (s *Server) getHandoff(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	dev := s.device(w, r)
	sess, ok := s.hub.Get(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"handoff": sess.Snapshot(dev.ID)})
}

// acceptHandoff claims the card and hands the taker a pull ticket. The
// ticket exists because the download is a plain browser navigation and
// cannot carry the X-Slip header the other writes use.
func (s *Server) acceptHandoff(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	dev := s.device(w, r)
	sess, ok := s.hub.Get(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	if err := sess.Accept(dev.ID, dev.Name); err != nil {
		writeHandoffErr(w, err)
		return
	}
	nonce, err := sess.Mint()
	if err != nil {
		writeHandoffErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"nonce":     nonce,
		"pullUrl":   "/api/handoff/" + sess.ID() + "/pull?n=" + nonce,
		"expiresIn": int(handoff.NonceTTL.Seconds()),
		"handoff":   sess.Snapshot(dev.ID),
	})
}

func (s *Server) declineHandoff(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	dev := s.device(w, r)
	sess, ok := s.hub.Get(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	if err := sess.Decline(dev.ID); err != nil {
		writeHandoffErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// pushHandoff is the sender's side. The body is the file itself, read in
// chunks, hashed on the way through, and parked in the pipe until the
// receiver's download drains it.
func (s *Server) pushHandoff(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	dev := s.device(w, r)
	sess, ok := s.hub.Get(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	if sess.FromID() != dev.ID {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	att, err := sess.AttachPush()
	if err != nil {
		writeHandoffErr(w, err)
		return
	}

	// The five minute read and write deadlines on the http.Server are
	// right for a page and wrong for a two gigabyte file. Clear them for
	// this one connection and let the session's own clock do the work.
	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Time{})
	_ = rc.SetWriteDeadline(time.Time{})

	size := sess.Size()
	body := io.LimitReader(r.Body, size+1)
	hash := sha256.New()
	started := time.Now()
	var n int64

	// A network read returns whatever one segment happened to carry, so
	// a naive loop hands 1.5 KB at a time to the pipe, and the receiver
	// then does a write and a flush per 1.5 KB. Fill a whole chunk
	// first: it cuts the syscalls per megabyte by two orders of
	// magnitude and keeps the receiving socket busy.
	buf := make([]byte, handoff.Chunk)
	fill := 0

	send := func() error {
		if fill == 0 {
			return nil
		}
		chunk := make([]byte, fill)
		copy(chunk, buf[:fill])
		n += int64(fill)
		fill = 0
		_, _ = hash.Write(chunk)
		return att.Write(chunk)
	}

	for {
		k, readErr := body.Read(buf[fill:])
		if k > 0 {
			fill += k
			if n+int64(fill) > size {
				sess.Abort("long")
				writeErr(w, http.StatusBadRequest, "bad_request")
				return
			}
			if fill == len(buf) {
				if e := send(); e != nil {
					if errors.Is(e, handoff.ErrRestart) {
						// The reader was replaced. This attempt is over
						// but the handoff is not: the page sends again.
						writeErr(w, http.StatusConflict, "restart")
						return
					}
					writeErr(w, http.StatusGone, "gone")
					return
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			sess.Abort("broken")
			writeErr(w, http.StatusBadRequest, "bad_request")
			return
		}
	}
	if e := send(); e != nil {
		if errors.Is(e, handoff.ErrRestart) {
			writeErr(w, http.StatusConflict, "restart")
			return
		}
		writeErr(w, http.StatusGone, "gone")
		return
	}
	noteRate("push", sess, n, started)
	sum := hex.EncodeToString(hash.Sum(nil))
	if err := att.EndUpload(n, sum); err != nil {
		writeHandoffErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sha256": sum, "bytes": n})
}

// noteRate puts the throughput of one side in the log. When a transfer
// feels slow, these two numbers say which half is slow instead of
// leaving it to guesswork.
func noteRate(side string, sess *handoff.Session, n int64, started time.Time) {
	d := time.Since(started)
	if d <= 0 || n <= 0 {
		return
	}
	mbps := float64(n) / (1 << 20) / d.Seconds()
	log.Printf("handoff %s %s: %s in %s, %.1f MB/s",
		side, sess.ID(), formatBytes(n), d.Round(time.Millisecond), mbps)
}

func formatBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return strconv.FormatInt(n, 10) + " B"
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return strconv.FormatFloat(float64(n)/float64(div), 'f', 1, 64) + " " + string("KMGTPE"[exp]) + "iB"
}

// pullNote records what asked for the stream and what it was given.
// Download managers do things that are hard to guess from the outside,
// and a "it failed" report is impossible to work with unless the server
// says which requests actually arrived.
func pullNote(sess *handoff.Session, r *http.Request, outcome string) {
	cookie := "no"
	if c, err := r.Cookie("slip_session"); err == nil && c.Value != "" {
		cookie = "yes"
	}
	log.Printf("handoff pull %s: %s method=%s cookie=%s range=%q ua=%q",
		sess.ID(), outcome, r.Method, cookie, r.Header.Get("Range"), r.UserAgent())
}

// pullHandoff is the receiver's side. Nothing is written until the
// upload has arrived, because a browser that gets headers and then a
// long silence may give up on the file.
//
// The ticket in the query string IS the credential here, not the
// session cookie. A download manager is a separate process with its own
// cookie jar, so requiring a login would turn every takeover into a
// 401. The ticket is 128 random bits, bound to one session, expires in
// ten minutes, and is revoked when the handoff is cancelled.
func (s *Server) pullHandoff(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.hub.Get(r.PathValue("id"))
	if !ok {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	ticket := r.URL.Query().Get("n")
	if !sess.CheckNonce(ticket) {
		pullNote(sess, r, "refused-bad-ticket")
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// A browser, or a proxy in front of one, may ask for the size with a
	// HEAD before it starts the real download. Answer that from the
	// session alone, and do not spend a use of the ticket on it.
	if r.Method == http.MethodHead {
		pullNote(sess, r, "head")
		setStreamHeaders(w, sess)
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		pullNote(sess, r, "method-not-allowed")
		w.Header().Set("Allow", "GET, HEAD")
		writeErr(w, http.StatusMethodNotAllowed, "bad_request")
		return
	}

	// Accept-Ranges: none is the honest answer and the useful one. A
	// download manager that reads it stops planning parallel segments; a
	// manager that ignores it asks for a range, and this stream cannot
	// give one back, because there is no copy to seek into.
	ranged := r.Header.Get("Range") != ""

	// One pipe has one reader, but a real download manager creates a
	// second request while the browser's is still open. The newest
	// request wins: it is the one the person just asked for. Only if the
	// current download is too fresh to judge, or the restart budget is
	// spent, is the newcomer refused.
	if sess.Pulling() {
		if !sess.Preempt() {
			pullNote(sess, r, "refused-one-shot")
			writeErr(w, http.StatusConflict, "one_shot")
			return
		}
		pullNote(sess, r, "preempted")
	}
	if !sess.TakeNonce(r.URL.Query().Get("n")) {
		pullNote(sess, r, "refused-bad-ticket")
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})
	att, err := sess.AttachPull(r.Context())
	if err != nil {
		pullNote(sess, r, "refused-"+err.Error())
		writeHandoffErr(w, err)
		return
	}

	serving := "serving"
	if ranged {
		serving = "serving-ignoring-range"
	}
	pullNote(sess, r, serving)
	setStreamHeaders(w, sess)
	w.WriteHeader(http.StatusOK)
	_ = rc.Flush()

	started := time.Now()
	var written int64
	for {
		chunk, more, err := att.Next(r.Context())
		if err != nil {
			if errors.Is(err, handoff.ErrReaderGone) {
				// The client hung up. Keep the handoff alive: whoever
				// asked next gets a fresh pipe and the sender starts
				// over.
				pullNote(sess, r, "reader-gone after "+strconv.FormatInt(written, 10)+" bytes")
				att.LoseReader()
				return
			}
			pullNote(sess, r, "ended-"+err.Error()+" after "+strconv.FormatInt(written, 10)+" bytes")
			return
		}
		if !more {
			break
		}
		if _, werr := w.Write(chunk); werr != nil {
			pullNote(sess, r, "write-failed after "+strconv.FormatInt(written, 10)+" bytes")
			att.LoseReader()
			return
		}
		written += int64(len(chunk))
		_ = rc.Flush()
	}
	noteRate("pull", sess, written, started)
	// A body that stopped short of Content-Length is a broken attempt,
	// not a finished transfer. EndDownload makes that call.
	if err := att.EndDownload(); err != nil {
		pullNote(sess, r, "ended-"+err.Error()+" after "+strconv.FormatInt(written, 10)+" bytes")
		return
	}
	pullNote(sess, r, "done after "+strconv.FormatInt(written, 10)+" bytes")
}

// liveHandoff is the block the board poll folds in, so presence and open
// cards cost no extra request.
func (s *Server) liveHandoff(dev handoff.Device) map[string]any {
	devices := make([]handoff.Device, 0, 4)
	for _, d := range s.hub.Devices().List() {
		if d.ID == dev.ID {
			continue
		}
		devices = append(devices, d)
	}
	list := s.hub.List(dev.ID)
	if list == nil {
		list = []handoff.Info{}
	}
	return map[string]any{
		"device":   dev,
		"devices":  devices,
		"handoffs": list,
	}
}

// setStreamHeaders describes a body that is a live stream, not a file on
// a disk. Accept-Ranges: none is the part a download manager reads: this
// content cannot be sliced, resumed, or fetched twice.
func setStreamHeaders(w http.ResponseWriter, sess *handoff.Session) {
	h := w.Header()
	h.Set("Content-Type", "application/octet-stream")
	h.Set("Content-Length", strconv.FormatInt(sess.Size(), 10))
	h.Set("Content-Disposition", contentDisposition("attachment", sess.Name()))
	h.Set("Cache-Control", "no-store")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Accept-Ranges", "none")
}

func writeHandoffErr(w http.ResponseWriter, err error) {
	switch err {
	case handoff.ErrNotFound:
		writeErr(w, http.StatusNotFound, "not_found")
	case handoff.ErrTaken:
		writeErr(w, http.StatusConflict, "already_taken")
	case handoff.ErrPulling:
		writeErr(w, http.StatusConflict, "one_shot")
	case handoff.ErrRestart, handoff.ErrReaderGone:
		writeErr(w, http.StatusConflict, "restart")
	case handoff.ErrState:
		writeErr(w, http.StatusConflict, "state")
	case handoff.ErrGone:
		writeErr(w, http.StatusGone, "gone")
	case handoff.ErrBusy:
		writeErr(w, http.StatusTooManyRequests, "busy")
	case handoff.ErrSize, handoff.ErrTooLarge:
		writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
	case handoff.ErrShort:
		writeErr(w, http.StatusBadRequest, "short")
	default:
		writeErr(w, http.StatusInternalServerError, "bad_request")
	}
}
