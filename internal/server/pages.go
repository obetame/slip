package server

import (
	"bytes"
	"io/fs"
	"net/http"
	"strings"

	"github.com/obetame/slip/internal/web"
)

func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	if ui := r.URL.Query().Get("ui"); ui == "legacy" || ui == "modern" {
		http.SetCookie(w, &http.Cookie{
			Name:     "slip_ui",
			Value:    ui,
			Path:     "/",
			MaxAge:   365 * 24 * 3600,
			SameSite: http.SameSiteLaxMode,
			HttpOnly: true,
		})
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	name := "index.html"
	if wantsLegacy(r) {
		name = "legacy.html"
	}
	b, err := fs.ReadFile(web.Static, "static/"+name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	b = bytes.ReplaceAll(b, []byte("{{version}}"), []byte(s.version))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(b)
}

func wantsLegacy(r *http.Request) bool {
	if c, err := r.Cookie("slip_ui"); err == nil {
		switch c.Value {
		case "legacy":
			return true
		case "modern":
			return false
		}
	}
	ua := strings.ToLower(r.UserAgent())
	return strings.Contains(ua, "cpu os 12_") || strings.Contains(ua, "cpu iphone os 12_")
}
