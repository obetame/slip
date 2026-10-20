package server

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/obetame/slip/internal/auth"
	"github.com/obetame/slip/internal/config"
	"github.com/obetame/slip/internal/lan"
	"github.com/obetame/slip/internal/qrcode"
	"github.com/obetame/slip/internal/session"
	"github.com/obetame/slip/internal/store"
	"github.com/obetame/slip/internal/web"
)

const (
	failWindow = 10 * time.Minute
	failLimit  = 8
	lockFor    = 15 * time.Minute
)

// Server is the household HTTP app.
type Server struct {
	store    *store.Store
	cfg      *config.Config
	sessions *session.Book
	argon    auth.Params
	version  string
	now      func() time.Time

	mu    sync.Mutex
	port  int
	fails map[string]*failRec
	mux   *http.ServeMux
	icon  []byte
}

type failRec struct {
	at    []time.Time
	until time.Time
}

func New(st *store.Store, cfg *config.Config, book *session.Book, argon auth.Params, ver string) *Server {
	s := &Server{
		store:    st,
		cfg:      cfg,
		sessions: book,
		argon:    argon,
		version:  ver,
		now:      time.Now,
		fails:    map[string]*failRec{},
		icon:     faviconPNG(),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.home)
	mux.HandleFunc("GET /tokens.css", s.asset("tokens.css", "text/css; charset=utf-8"))
	mux.HandleFunc("GET /app.css", s.asset("app.css", "text/css; charset=utf-8"))
	mux.HandleFunc("GET /app.js", s.asset("app.js", "text/javascript; charset=utf-8"))
	mux.HandleFunc("GET /core.js", s.asset("core.js", "text/javascript; charset=utf-8"))
	mux.HandleFunc("GET /boot.js", s.asset("boot.js", "text/javascript; charset=utf-8"))
	mux.HandleFunc("GET /legacy.css", s.asset("legacy.css", "text/css; charset=utf-8"))
	mux.HandleFunc("GET /legacy.js", s.asset("legacy.js", "text/javascript; charset=utf-8"))
	mux.HandleFunc("GET /favicon.png", s.favicon)
	mux.HandleFunc("GET /robots.txt", s.robots)
	mux.HandleFunc("GET /api/bootstrap", s.bootstrap)
	mux.HandleFunc("GET /api/qr.svg", s.qr)
	mux.HandleFunc("POST /api/setup", s.setup)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.HandleFunc("POST /api/logout-all", s.logoutAll)
	mux.HandleFunc("POST /api/passphrase", s.changePass)
	mux.HandleFunc("GET /api/items", s.listItems)
	mux.HandleFunc("POST /api/text", s.createText)
	mux.HandleFunc("POST /api/files", s.upload)
	mux.HandleFunc("GET /api/items/{id}/raw", s.raw)
	mux.HandleFunc("GET /api/items/{id}/thumb", s.thumb)
	mux.HandleFunc("DELETE /api/items/{id}", s.deleteItem)
	mux.HandleFunc("POST /api/restore", s.restore)
	mux.HandleFunc("POST /api/clear", s.clear)
	s.mux = mux
	return s
}

func (s *Server) SetPort(port int) {
	s.mu.Lock()
	s.port = port
	s.mu.Unlock()
}

func (s *Server) SetClock(now func() time.Time) {
	if now != nil {
		s.now = now
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	secure(w)
	ip := lan.FromAddr(r.RemoteAddr)
	if !lan.Allowed(ip) {
		http.Error(w, "slip only accepts connections from the local network\n", http.StatusForbidden)
		return
	}
	sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
	s.mux.ServeHTTP(sw, r)
	if sw.status >= 400 {
		log.Printf("%s %s %d", r.Method, r.URL.Path, sw.status)
	}
}

func (s *Server) listenPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.port == 0 {
		return 8787
	}
	return s.port
}

func (s *Server) bootstrap(w http.ResponseWriter, r *http.Request) {
	loop := s.loopback(r)
	authed := s.authed(r)
	body := map[string]any{
		"ready":    s.cfg.HasPassphrase(),
		"authed":   authed,
		"loopback": loop,
		"version":  s.version,
		"port":     s.listenPort(),
	}
	if loop || authed {
		body["urls"] = lan.ShareURLs(s.listenPort())
	}
	if authed {
		used, limit := s.store.Usage()
		body["used"] = used
		body["limit"] = limit
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) setup(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) {
		return
	}
	if !s.loopback(r) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if s.cfg.HasPassphrase() {
		writeErr(w, http.StatusConflict, "already_setup")
		return
	}
	var body struct {
		Passphrase string `json:"passphrase"`
		Again      string `json:"again"`
	}
	if err := readJSON(w, r, &body, 8<<10); err != nil {
		writeJSONErr(w, err)
		return
	}
	if body.Passphrase != body.Again {
		writeErr(w, http.StatusBadRequest, "passphrase_mismatch")
		return
	}
	hash, err := auth.Hash(body.Passphrase, s.argon)
	if err != nil {
		writePassErr(w, err)
		return
	}
	if err := s.cfg.SetPassphrase(hash, s.now()); err != nil {
		writeErr(w, http.StatusInternalServerError, "bad_request")
		return
	}
	s.startSession(w)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) {
		return
	}
	if !s.cfg.HasPassphrase() {
		writeErr(w, http.StatusConflict, "setup_required")
		return
	}
	ip := r.RemoteAddr
	if s.lockedOut(ip) {
		writeErr(w, http.StatusTooManyRequests, "locked")
		return
	}
	var body struct {
		Passphrase string `json:"passphrase"`
	}
	if err := readJSON(w, r, &body, 8<<10); err != nil {
		writeJSONErr(w, err)
		return
	}
	if !auth.Verify(body.Passphrase, s.cfg.Hash()) {
		s.noteFail(ip)
		if s.lockedOut(ip) {
			writeErr(w, http.StatusTooManyRequests, "locked")
			return
		}
		writeErr(w, http.StatusUnauthorized, "wrong_passphrase")
		return
	}
	s.noteOK(ip)
	s.startSession(w)
}

func (s *Server) changePass(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	ip := r.RemoteAddr
	if s.lockedOut(ip) {
		writeErr(w, http.StatusTooManyRequests, "locked")
		return
	}
	var body struct {
		Current string `json:"current"`
		Next    string `json:"next"`
		Again   string `json:"again"`
	}
	if err := readJSON(w, r, &body, 8<<10); err != nil {
		writeJSONErr(w, err)
		return
	}
	if !auth.Verify(body.Current, s.cfg.Hash()) {
		s.noteFail(ip)
		writeErr(w, http.StatusUnauthorized, "wrong_passphrase")
		return
	}
	if body.Next != body.Again {
		writeErr(w, http.StatusBadRequest, "passphrase_mismatch")
		return
	}
	hash, err := auth.Hash(body.Next, s.argon)
	if err != nil {
		writePassErr(w, err)
		return
	}
	if err := s.cfg.SetPassphrase(hash, s.now()); err != nil {
		writeErr(w, http.StatusInternalServerError, "bad_request")
		return
	}
	if c, err := r.Cookie("slip_session"); err == nil {
		_ = s.sessions.DeleteExcept(c.Value)
	}
	s.noteOK(ip)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	if c, err := r.Cookie("slip_session"); err == nil {
		_ = s.sessions.Delete(c.Value)
	}
	clearSession(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) logoutAll(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	_ = s.sessions.DeleteAll()
	clearSession(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) qr(w http.ResponseWriter, r *http.Request) {
	if !s.loopback(r) && !s.authed(r) {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	target := "http://127.0.0.1:" + strconv.Itoa(s.listenPort())
	if urls := lan.ShareURLs(s.listenPort()); len(urls) > 0 {
		target = urls[0]
	}
	svg, err := qrcode.SVG(target, 4)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "bad_request")
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = io.WriteString(w, svg)
}

func (s *Server) startSession(w http.ResponseWriter) {
	token, err := s.sessions.Put()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "bad_request")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "slip_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(session.Lifetime.Seconds()),
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func clearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "slip_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (s *Server) authed(r *http.Request) bool {
	c, err := r.Cookie("slip_session")
	if err != nil || c.Value == "" {
		return false
	}
	return s.sessions.Valid(c.Value)
}

func (s *Server) requireAuth(w http.ResponseWriter, r *http.Request) bool {
	if s.authed(r) {
		return true
	}
	writeErr(w, http.StatusUnauthorized, "unauthorized")
	return false
}

func (s *Server) loopback(r *http.Request) bool {
	return lan.Loopback(lan.FromAddr(r.RemoteAddr))
}

func requireWrite(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-Slip") != "1" {
		writeErr(w, http.StatusForbidden, "forbidden")
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || !strings.EqualFold(u.Host, r.Host) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return false
	}
	return true
}

func (s *Server) lockedOut(ip string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	f := s.fails[ip]
	return f != nil && s.now().Before(f.until)
}

func (s *Server) noteFail(ip string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f := s.fails[ip]
	if f == nil {
		f = &failRec{}
		s.fails[ip] = f
	}
	now := s.now()
	cut := now.Add(-failWindow)
	kept := make([]time.Time, 0, len(f.at)+1)
	for _, t := range f.at {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	f.at = append(kept, now)
	if len(f.at) >= failLimit {
		f.until = now.Add(lockFor)
	}
}

func (s *Server) noteOK(ip string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.fails, ip)
}

func (s *Server) asset(name, ctype string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := fs.ReadFile(web.Static, "static/"+name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", ctype)
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(b)
	}
}

func (s *Server) favicon(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(s.icon)
}

func (s *Server) robots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, "User-agent: *\nDisallow: /\n")
}

func secure(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
	h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	h.Set("Cross-Origin-Resource-Policy", "same-origin")
}

func writeErr(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any, max int64) error {
	r.Body = http.MaxBytesReader(w, r.Body, max)
	dec := json.NewDecoder(r.Body)
	return dec.Decode(dst)
}

func writeJSONErr(w http.ResponseWriter, err error) {
	if tooLarge(err) {
		writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
		return
	}
	writeErr(w, http.StatusBadRequest, "bad_request")
}

func writePassErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrTooShort):
		writeErr(w, http.StatusBadRequest, "passphrase_too_short")
	case errors.Is(err, auth.ErrTooLong):
		writeErr(w, http.StatusBadRequest, "passphrase_too_long")
	default:
		writeErr(w, http.StatusBadRequest, "bad_request")
	}
}

func tooLarge(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr) || (err != nil && strings.Contains(err.Error(), "request body too large"))
}

type statusWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (s *statusWriter) WriteHeader(code int) {
	if s.wrote {
		return
	}
	s.wrote = true
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusWriter) Write(b []byte) (int, error) {
	if !s.wrote {
		s.WriteHeader(http.StatusOK)
	}
	return s.ResponseWriter.Write(b)
}
