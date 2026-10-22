package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// releaseAPI is where the newest published tag is read from. It is a
// variable rather than a constant so a test can point it at its own server.
//
// This is the only request slip makes to the internet, and it is made only
// when someone presses Check for updates in Settings. The board itself never
// phones home, and nothing about the household leaves this machine.
var releaseAPI = "https://api.github.com/repos/obetame/slip/releases/latest"

// updateClient has a deadline because a check that hangs is worse than a
// check that fails: the person is standing there waiting for an answer.
var updateClient = &http.Client{Timeout: 6 * time.Second}

// updateBody is what the settings page gets back. Error is set instead of
// Latest when GitHub could not be reached, so the client can say so without
// inventing a version number.
type updateBody struct {
	Current string `json:"current"`
	Latest  string `json:"latest,omitempty"`
	URL     string `json:"url,omitempty"`
	Newer   bool   `json:"newer"`
	Error   string `json:"error,omitempty"`
}

// checkUpdate answers whether a newer release exists. It never fails the
// request: a household that is offline gets an error field, not a 500.
func (s *Server) checkUpdate(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	body := updateBody{Current: s.version}
	latest, page, err := latestRelease(r.Context())
	if err != nil {
		body.Error = "unreachable"
		writeJSON(w, http.StatusOK, body)
		return
	}
	body.Latest = latest
	body.URL = page
	body.Newer = newerVersion(latest, s.version)
	writeJSON(w, http.StatusOK, body)
}

// latestRelease reads the tag and the page of the newest published release.
func latestRelease(ctx context.Context) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releaseAPI, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "slip")
	res, err := updateClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("release api answered %d", res.StatusCode)
	}
	// The body is a single object with a known shape, but read it through a
	// cap: it is somebody else's server on the other end.
	var body struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&body); err != nil {
		return "", "", err
	}
	tag := strings.TrimPrefix(strings.TrimSpace(body.TagName), "v")
	if tag == "" {
		return "", "", fmt.Errorf("release api returned no tag")
	}
	return tag, body.HTMLURL, nil
}

// newerVersion reports whether latest is ahead of current. Both are written
// as x.y.z; a pre-release suffix makes the answer false rather than a guess.
func newerVersion(latest, current string) bool {
	a, ok := parseVersion(latest)
	if !ok {
		return false
	}
	b, ok := parseVersion(current)
	if !ok {
		return false
	}
	for i := 0; i < 3; i++ {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}

// parseVersion turns "1.2.3" into three numbers. "0.4" counts as 0.4.0
// because a tag is allowed to leave the patch out.
func parseVersion(s string) ([3]int, bool) {
	var out [3]int
	parts := strings.Split(strings.TrimPrefix(strings.TrimSpace(s), "v"), ".")
	if len(parts) == 0 || len(parts) > 3 {
		return out, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}
