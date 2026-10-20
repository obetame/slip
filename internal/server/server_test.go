package server

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/obetame/slip/internal/auth"
	"github.com/obetame/slip/internal/config"
	"github.com/obetame/slip/internal/session"
	"github.com/obetame/slip/internal/store"
)

const (
	loopback = "127.0.0.1:9"
	lanAddr  = "192.168.1.20:9"
)

func TestPublicPeerRejected(t *testing.T) {
	s, _ := newTest(t)
	rr := call(t, s, http.MethodGet, "/", "8.8.8.8:9", "", nil, nil)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("status %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "local network") {
		t.Fatalf("body %s", rr.Body.String())
	}
}

func TestSetupRules(t *testing.T) {
	s, _ := newTest(t)
	rr := postJSON(t, s, "/api/setup", lanAddr, "", `{"passphrase":"123456","again":"123456"}`)
	if rr.Code != http.StatusForbidden || errCode(t, rr) != "forbidden" {
		t.Fatalf("lan setup %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/setup", loopback, "", `{"passphrase":"12345","again":"12345"}`)
	if rr.Code != http.StatusBadRequest || errCode(t, rr) != "passphrase_too_short" {
		t.Fatalf("short %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/setup", loopback, "", `{"passphrase":"123456","again":"654321"}`)
	if rr.Code != http.StatusBadRequest || errCode(t, rr) != "passphrase_mismatch" {
		t.Fatalf("mismatch %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/setup", loopback, "", `{"passphrase":"123456","again":"123456"}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("setup %d %s", rr.Code, rr.Body.String())
	}
	c := cookieOf(t, rr, "slip_session")
	if c == nil || c.Value == "" || !c.HttpOnly || c.Secure || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie %#v", c)
	}
	rr = postJSON(t, s, "/api/setup", loopback, "", `{"passphrase":"123456","again":"123456"}`)
	if rr.Code != http.StatusConflict || errCode(t, rr) != "already_setup" {
		t.Fatalf("second setup %d %s", rr.Code, rr.Body.String())
	}
}

func TestLoginLockout(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	if token == "" {
		t.Fatal("token")
	}
	for i := 0; i < 7; i++ {
		rr := postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"nope12"}`)
		if rr.Code != http.StatusUnauthorized || errCode(t, rr) != "wrong_passphrase" {
			t.Fatalf("try %d: %d %s", i, rr.Code, rr.Body.String())
		}
	}
	rr := postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"123456"}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("login after 7 misses: %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"nope12"}`)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("counter should reset, got %d", rr.Code)
	}
	for i := 0; i < 6; i++ {
		rr = postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"nope12"}`)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("extra %d: %d", i, rr.Code)
		}
	}
	rr = postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"nope12"}`)
	if rr.Code != http.StatusTooManyRequests || errCode(t, rr) != "locked" {
		t.Fatalf("lock %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/login", lanAddr, "", `{"passphrase":"123456"}`)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("locked good password %d", rr.Code)
	}
}

func TestBoardFlow(t *testing.T) {
	s, st := newTest(t)
	token := setupPass(t, s)

	rr := call(t, s, http.MethodPost, "/api/text", loopback, token, strings.NewReader(`{"text":"one"}`), http.Header{
		"Content-Type": []string{"application/json"},
	})
	if rr.Code != http.StatusForbidden || errCode(t, rr) != "forbidden" {
		t.Fatalf("missing header %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/text", loopback, "", `{"text":"one"}`)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("anon %d", rr.Code)
	}

	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })
	rr = postJSON(t, s, "/api/text", loopback, token, `{"text":"one"}`)
	if rr.Code != http.StatusCreated {
		t.Fatalf("text %d %s", rr.Code, rr.Body.String())
	}
	cur = cur.Add(time.Second)
	rr = postJSON(t, s, "/api/text", loopback, token, `{"text":"two"}`)
	if rr.Code != http.StatusCreated {
		t.Fatal(rr.Body.String())
	}
	var created struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
	}
	decode(t, rr, &created)

	rr = call(t, s, http.MethodGet, "/api/items", loopback, token, nil, nil)
	var page struct {
		Items []struct {
			ID   string `json:"id"`
			Text string `json:"text"`
		} `json:"items"`
	}
	decode(t, rr, &page)
	if len(page.Items) != 2 || page.Items[0].Text != "two" || page.Items[1].Text != "one" {
		t.Fatalf("order %+v", page.Items)
	}

	badOrigin := http.Header{"X-Slip": []string{"1"}, "Origin": []string{"http://evil.example"}}
	rr = call(t, s, http.MethodDelete, "/api/items/"+created.Item.ID, loopback, token, nil, badOrigin)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("csrf %d %s", rr.Code, rr.Body.String())
	}

	rr = call(t, s, http.MethodDelete, "/api/items/"+created.Item.ID, loopback, token, nil, http.Header{"X-Slip": []string{"1"}})
	if rr.Code != http.StatusOK {
		t.Fatalf("delete %d %s", rr.Code, rr.Body.String())
	}
	rr = call(t, s, http.MethodGet, "/api/items", loopback, token, nil, nil)
	decode(t, rr, &page)
	if len(page.Items) != 1 {
		t.Fatalf("after delete %+v", page.Items)
	}
	rr = postJSON(t, s, "/api/restore", loopback, token, `{"ids":["`+created.Item.ID+`"]}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("restore %d %s", rr.Code, rr.Body.String())
	}
	rr = call(t, s, http.MethodGet, "/api/items", loopback, token, nil, nil)
	decode(t, rr, &page)
	if len(page.Items) != 2 {
		t.Fatalf("after restore %+v", page.Items)
	}

	st.SetLimits(0, 4, 0)
	rr = postJSON(t, s, "/api/text", loopback, token, `{"text":"hello"}`)
	if rr.Code != http.StatusRequestEntityTooLarge || errCode(t, rr) != "text_too_large" {
		t.Fatalf("text cap %d %s", rr.Code, rr.Body.String())
	}
	rr = postJSON(t, s, "/api/text", loopback, token, `{"text":"   "}`)
	if rr.Code != http.StatusBadRequest || errCode(t, rr) != "empty" {
		t.Fatalf("blank %d %s", rr.Code, rr.Body.String())
	}
}

func TestUploadImageAndHTML(t *testing.T) {
	s, st := newTest(t)
	token := setupPass(t, s)

	body, ct := fileForm(t, "note.jpg", jpegBytes(t))
	rr := call(t, s, http.MethodPost, "/api/files", loopback, token, body, http.Header{
		"Content-Type": []string{ct},
		"X-Slip":       []string{"1"},
	})
	if rr.Code != http.StatusCreated {
		t.Fatalf("upload %d %s", rr.Code, rr.Body.String())
	}
	var up struct {
		Items []struct {
			ID       string `json:"id"`
			Kind     string `json:"kind"`
			HasThumb bool   `json:"hasThumb"`
			Mime     string `json:"mime"`
		} `json:"items"`
	}
	decode(t, rr, &up)
	if len(up.Items) != 1 || up.Items[0].Kind != "image" || !up.Items[0].HasThumb || up.Items[0].Mime != "image/jpeg" {
		t.Fatalf("image item %+v", up.Items)
	}
	id := up.Items[0].ID

	rr = call(t, s, http.MethodGet, "/api/items/"+id+"/thumb", loopback, token, nil, nil)
	if rr.Code != http.StatusOK || rr.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("thumb %d %s", rr.Code, rr.Header().Get("Content-Type"))
	}
	rr = call(t, s, http.MethodGet, "/api/items/"+id+"/raw", loopback, token, nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("raw %d", rr.Code)
	}
	if rr.Header().Get("Content-Type") != "image/jpeg" || !strings.Contains(rr.Header().Get("Content-Disposition"), "inline") {
		t.Fatalf("inline headers %v", rr.Header())
	}
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing nosniff")
	}

	html := []byte("<!doctype html><html><script>alert(1)</script></html>")
	body, ct = fileForm(t, "page.html", html)
	rr = call(t, s, http.MethodPost, "/api/files", loopback, token, body, http.Header{
		"Content-Type": []string{ct},
		"X-Slip":       []string{"1"},
	})
	if rr.Code != http.StatusCreated {
		t.Fatalf("html upload %d %s", rr.Code, rr.Body.String())
	}
	decode(t, rr, &up)
	if up.Items[0].Kind != "file" {
		t.Fatalf("kind %s", up.Items[0].Kind)
	}
	rr = call(t, s, http.MethodGet, "/api/items/"+up.Items[0].ID+"/raw", loopback, token, nil, nil)
	if rr.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("type %s", rr.Header().Get("Content-Type"))
	}
	if !strings.Contains(rr.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("disp %s", rr.Header().Get("Content-Disposition"))
	}

	st.SetLimits(100, 100, 8)
	body, ct = fileForm(t, "big.txt", []byte("0123456789abcdef"))
	rr = call(t, s, http.MethodPost, "/api/files", loopback, token, body, http.Header{
		"Content-Type": []string{ct},
		"X-Slip":       []string{"1"},
	})
	if rr.Code != http.StatusRequestEntityTooLarge || errCode(t, rr) != "quota" {
		t.Fatalf("quota %d %s", rr.Code, rr.Body.String())
	}
}

func TestPagesAndQR(t *testing.T) {
	s, _ := newTest(t)
	rr := call(t, s, http.MethodGet, "/", loopback, "", nil, nil)
	if rr.Code != http.StatusOK || bytes.Contains(rr.Body.Bytes(), []byte("{{version}}")) {
		t.Fatalf("home %d", rr.Code)
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte("app.js?v=0.1.0")) {
		t.Fatal("version was not written into the page")
	}

	ios := http.Header{"User-Agent": []string{"Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X)"}}
	rr = call(t, s, http.MethodGet, "/", loopback, "", nil, ios)
	if !bytes.Contains(rr.Body.Bytes(), []byte("legacy.js")) || bytes.Contains(rr.Body.Bytes(), []byte("app.js")) {
		t.Fatal("iOS 12 should get the legacy page")
	}
	ios.Add("Cookie", "slip_ui=modern")
	rr = call(t, s, http.MethodGet, "/", loopback, "", nil, ios)
	if !bytes.Contains(rr.Body.Bytes(), []byte("app.js")) || bytes.Contains(rr.Body.Bytes(), []byte("legacy.js")) {
		t.Fatal("modern cookie should win over the old user agent")
	}

	rr = call(t, s, http.MethodGet, "/?ui=legacy", loopback, "", nil, nil)
	if rr.Code != http.StatusSeeOther || rr.Header().Get("Location") != "/" {
		t.Fatalf("switch %d %s", rr.Code, rr.Header().Get("Location"))
	}
	c := cookieOf(t, rr, "slip_ui")
	if c == nil || c.Value != "legacy" || !c.HttpOnly {
		t.Fatalf("ui cookie %#v", c)
	}

	rr = call(t, s, http.MethodGet, "/api/qr.svg", loopback, "", nil, nil)
	if rr.Code != http.StatusOK || !strings.Contains(rr.Header().Get("Content-Type"), "image/svg+xml") {
		t.Fatalf("qr %d %s", rr.Code, rr.Header().Get("Content-Type"))
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte("<svg")) {
		t.Fatal("qr body")
	}
	rr = call(t, s, http.MethodGet, "/api/qr.svg", lanAddr, "", nil, nil)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("lan qr %d", rr.Code)
	}

	rr = call(t, s, http.MethodGet, "/api/bootstrap", lanAddr, "", nil, nil)
	var boot map[string]any
	decode(t, rr, &boot)
	if _, ok := boot["urls"]; ok {
		t.Fatal("urls leaked to an anonymous lan peer")
	}
	if boot["ready"] != false || strings.Contains(rr.Body.String(), "argon2") {
		t.Fatalf("bootstrap %s", rr.Body.String())
	}

	rr = call(t, s, http.MethodGet, "/favicon.png", loopback, "", nil, nil)
	if rr.Code != http.StatusOK || rr.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("icon %d %s", rr.Code, rr.Header().Get("Content-Type"))
	}
	rr = call(t, s, http.MethodGet, "/robots.txt", loopback, "", nil, nil)
	if !strings.Contains(rr.Body.String(), "Disallow") {
		t.Fatal("robots")
	}
}

func newTest(t *testing.T) (*Server, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	cfg, err := config.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	st, err := store.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	book, err := session.Open(dir, nil)
	if err != nil {
		t.Fatal(err)
	}
	s := New(st, cfg, book, auth.Params{Time: 1, Memory: 64, Threads: 1}, "0.1.0")
	s.SetPort(8787)
	return s, st
}

func setupPass(t *testing.T, s *Server) string {
	t.Helper()
	rr := postJSON(t, s, "/api/setup", loopback, "", `{"passphrase":"123456","again":"123456"}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("setup %d %s", rr.Code, rr.Body.String())
	}
	c := cookieOf(t, rr, "slip_session")
	if c == nil || c.Value == "" {
		t.Fatal("missing session cookie")
	}
	return c.Value
}

func postJSON(t *testing.T, s *Server, path, remote, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	return call(t, s, http.MethodPost, path, remote, token, strings.NewReader(body), http.Header{
		"Content-Type": []string{"application/json"},
		"X-Slip":       []string{"1"},
	})
}

func call(t *testing.T, s *Server, method, target, remote, token string, body io.Reader, hdr http.Header) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, body)
	req.RemoteAddr = remote
	req.Host = "127.0.0.1:8787"
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
	}
	for k, vs := range hdr {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	rr := httptest.NewRecorder()
	s.ServeHTTP(rr, req)
	return rr
}

func cookieOf(t *testing.T, rr *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, c := range rr.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func errCode(t *testing.T, rr *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body.Error
}

func decode(t *testing.T, rr *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.Unmarshal(rr.Body.Bytes(), dst); err != nil {
		t.Fatalf("json: %v body %s", err, rr.Body.String())
	}
}

func jpegBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 16, 16))
	img.Set(0, 0, color.RGBA{R: 0x8f, G: 0x2d, B: 0x2a, A: 0xff})
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func fileForm(t *testing.T, name string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
	ct := w.FormDataContentType()
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf, ct
}

func TestEditItem(t *testing.T) {
	s, st := newTest(t)
	token := setupPass(t, s)

	cur := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return cur })

	rr := postJSON(t, s, "/api/text", loopback, token, `{"text":"before"}`)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Item struct {
			ID string `json:"id"`
		} `json:"item"`
	}
	decode(t, rr, &created)
	id := created.Item.ID

	patch := func(body string, hdr http.Header) *httptest.ResponseRecorder {
		return call(t, s, http.MethodPatch, "/api/items/"+id, loopback, token, strings.NewReader(body), hdr)
	}
	jsonHdr := http.Header{
		"Content-Type": []string{"application/json"},
		"X-Slip":       []string{"1"},
	}

	// The CSRF header is required for PATCH too.
	if rr := patch(`{"text":"after"}`, nil); rr.Code != http.StatusForbidden || errCode(t, rr) != "forbidden" {
		t.Fatalf("missing header %d %s", rr.Code, rr.Body.String())
	}

	cur = cur.Add(time.Minute)
	rr = patch(`{"text":"after"}`, jsonHdr)
	if rr.Code != http.StatusOK {
		t.Fatalf("edit %d %s", rr.Code, rr.Body.String())
	}
	var edited struct {
		Item struct {
			Text      string `json:"text"`
			CreatedAt string `json:"createdAt"`
			EditedAt  string `json:"editedAt"`
		} `json:"item"`
	}
	decode(t, rr, &edited)
	if edited.Item.Text != "after" {
		t.Fatalf("text = %q", edited.Item.Text)
	}
	if edited.Item.EditedAt == "" {
		t.Fatal("editedAt missing from the response")
	}

	// List shows the new body and keeps the original time.
	rr = call(t, s, http.MethodGet, "/api/items", loopback, token, nil, nil)
	var page struct {
		Items []struct {
			ID       string `json:"id"`
			Text     string `json:"text"`
			EditedAt string `json:"editedAt"`
		} `json:"items"`
	}
	decode(t, rr, &page)
	if len(page.Items) != 1 || page.Items[0].Text != "after" {
		t.Fatalf("list after edit: %+v", page.Items)
	}
	if page.Items[0].EditedAt == "" {
		t.Fatal("list omitted editedAt")
	}

	// Empty body and unknown id are rejected.
	if rr := patch(`{"text":"   "}`, jsonHdr); rr.Code != http.StatusBadRequest || errCode(t, rr) != "empty" {
		t.Fatalf("blank %d %s", rr.Code, rr.Body.String())
	}
	if rr := call(t, s, http.MethodPatch, "/api/items/0123456789abcdef", loopback, token,
		strings.NewReader(`{"text":"x"}`), jsonHdr); rr.Code != http.StatusNotFound {
		t.Fatalf("unknown id %d", rr.Code)
	}
}
