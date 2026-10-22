package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckUpdateNeedsAuth(t *testing.T) {
	s, _ := newTest(t)
	rr := call(t, s, http.MethodGet, "/api/update", lanAddr, "", nil, nil)
	if rr.Code != http.StatusUnauthorized || errCode(t, rr) != "unauthorized" {
		t.Fatalf("anonymous check: %d %s", rr.Code, rr.Body.String())
	}
}

func TestCheckUpdateReportsNewer(t *testing.T) {
	var accept string
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accept = r.Header.Get("Accept")
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"tag_name":"v9.9.9","html_url":"https://example.test/releases/tag/v9.9.9"}`)
	}))
	defer fake.Close()
	restore := releaseAPI
	releaseAPI = fake.URL
	defer func() { releaseAPI = restore }()

	s, _ := newTest(t)
	token := setupPass(t, s)
	rr := call(t, s, http.MethodGet, "/api/update", lanAddr, token, nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d %s", rr.Code, rr.Body.String())
	}
	var body updateBody
	decode(t, rr, &body)
	if body.Error != "" {
		t.Fatalf("error %q", body.Error)
	}
	if body.Current != "0.1.0" || body.Latest != "9.9.9" {
		t.Fatalf("versions %+v", body)
	}
	if !body.Newer || body.URL != "https://example.test/releases/tag/v9.9.9" {
		t.Fatalf("reply %+v", body)
	}
	if accept != "application/vnd.github+json" {
		t.Errorf("accept header %q", accept)
	}
}

// The same tag comes back as the current version: up to date, not newer.
func TestCheckUpdateSameVersion(t *testing.T) {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"tag_name":"v0.1.0","html_url":"https://example.test/r"}`)
	}))
	defer fake.Close()
	restore := releaseAPI
	releaseAPI = fake.URL
	defer func() { releaseAPI = restore }()

	s, _ := newTest(t)
	token := setupPass(t, s)
	rr := call(t, s, http.MethodGet, "/api/update", lanAddr, token, nil, nil)
	var body updateBody
	decode(t, rr, &body)
	if body.Newer || body.Latest != "0.1.0" {
		t.Fatalf("reply %+v", body)
	}
}

// A household without internet is the normal case, not an error page: the
// reply says so and the settings page prints one line.
func TestCheckUpdateOffline(t *testing.T) {
	restore := releaseAPI
	releaseAPI = "http://127.0.0.1:1/releases/latest"
	defer func() { releaseAPI = restore }()

	s, _ := newTest(t)
	token := setupPass(t, s)
	rr := call(t, s, http.MethodGet, "/api/update", lanAddr, token, nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	var body updateBody
	decode(t, rr, &body)
	if body.Error != "unreachable" || body.Latest != "" || body.Newer {
		t.Fatalf("reply %+v", body)
	}
}

// An answer that is not a release (rate limit, HTML error page) must not be
// read as a newer version.
func TestCheckUpdateBadAnswer(t *testing.T) {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		io.WriteString(w, `{"message":"API rate limit exceeded"}`)
	}))
	defer fake.Close()
	restore := releaseAPI
	releaseAPI = fake.URL
	defer func() { releaseAPI = restore }()

	s, _ := newTest(t)
	token := setupPass(t, s)
	rr := call(t, s, http.MethodGet, "/api/update", lanAddr, token, nil, nil)
	var body updateBody
	decode(t, rr, &body)
	if body.Error != "unreachable" || body.Newer {
		t.Fatalf("reply %+v", body)
	}
}

func TestNewerVersion(t *testing.T) {
	cases := []struct {
		latest  string
		current string
		want    bool
	}{
		{"0.3.1", "0.3.0", true},
		{"0.4.0", "0.3.9", true},
		{"1.0.0", "0.9.9", true},
		{"0.10.0", "0.9.9", true},
		{"v0.4.0", "0.3.0", true},
		{"0.4", "0.3.9", true},
		{"0.3.0", "0.3.0", false},
		{"0.2.9", "0.3.0", false},
		{"", "0.3.0", false},
		{"0.4.0-rc1", "0.3.0", false},
		{"0.3.0", "", false},
	}
	for _, c := range cases {
		if got := newerVersion(c.latest, c.current); got != c.want {
			t.Errorf("newerVersion(%q, %q) = %v, want %v", c.latest, c.current, got, c.want)
		}
	}
}
