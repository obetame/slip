package server

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/obetame/slip/internal/handoff"
	"github.com/obetame/slip/internal/store"
)

// openOffer walks an offer up to the point where a download ticket
// exists, and returns the id and the pull URL.
func openOffer(t *testing.T, s *Server, token string, size int) (string, string) {
	t.Helper()
	offer := `{"name":"a.bin","size":` + strconv.Itoa(size) + `,"mime":"application/octet-stream"}`
	rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender, []byte(offer), jsonWriteHdr())
	if rr.Code != http.StatusCreated {
		t.Fatalf("offer %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Handoff struct {
			ID string `json:"id"`
		} `json:"handoff"`
	}
	decode(t, rr, &created)
	id := created.Handoff.ID

	rr = handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/accept", token, devReceiver, []byte(`{}`), jsonWriteHdr())
	if rr.Code != http.StatusOK {
		t.Fatalf("accept %d %s", rr.Code, rr.Body.String())
	}
	var acc struct {
		PullURL string `json:"pullUrl"`
	}
	decode(t, rr, &acc)
	if acc.PullURL == "" {
		t.Fatal("no pull url")
	}
	return id, acc.PullURL
}

func pushAsync(t *testing.T, s *Server, token, id string, payload []byte) *sync.WaitGroup {
	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/push", token, devSender, payload, http.Header{
			"Content-Type": []string{"application/octet-stream"},
			"X-Slip":       []string{"1"},
		})
	}()
	return wg
}

// A browser, or a proxy in front of one, asks for the size with HEAD
// before it starts a download. That probe must not consume the stream:
// it did, and the download that followed got an empty body.
func TestHeadProbeDoesNotEatTheStream(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	payload := bytes.Repeat([]byte("x"), 300000)
	id, pull := openOffer(t, s, token, len(payload))

	wg := pushAsync(t, s, token, id, payload)

	head := handoffCall(t, s, http.MethodHead, pull, token, devReceiver, nil, nil)
	if head.Code != http.StatusOK {
		t.Fatalf("head %d", head.Code)
	}
	if got := head.Header().Get("Content-Length"); got != strconv.Itoa(len(payload)) {
		t.Fatalf("head content-length %q", got)
	}
	if head.Body.Len() != 0 {
		t.Fatalf("head carried %d bytes", head.Body.Len())
	}

	got := handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil)
	wg.Wait()
	if got.Code != http.StatusOK || got.Body.Len() != len(payload) {
		t.Fatalf("download after head: %d with %d bytes", got.Code, got.Body.Len())
	}
}

// One pipe has one consumer. Two downloads used to split the stream, so
// both stopped short of the declared length and both failed.
func TestOnlyOneDownloadGetsTheStream(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	payload := bytes.Repeat([]byte("y"), 600*1024)
	id, pull := openOffer(t, s, token, len(payload))
	push := pushAsync(t, s, token, id, payload)

	var wg sync.WaitGroup
	var a, b *httptest.ResponseRecorder
	wg.Add(2)
	go func() { defer wg.Done(); a = handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil) }()
	go func() { defer wg.Done(); b = handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil) }()
	wg.Wait()
	push.Wait()

	// Whatever the interleaving, nobody may answer 200 with a body that
	// is shorter than the Content-Length it declared.
	for i, rr := range []*httptest.ResponseRecorder{a, b} {
		if rr.Code == http.StatusOK && rr.Body.Len() != len(payload) {
			t.Fatalf("download %d was truncated: %d of %d bytes", i, rr.Body.Len(), len(payload))
		}
	}
}

// TestHandoffOverRealHTTP runs the whole thing over a real socket
// instead of an in-memory recorder, because that is where the timing
// between the two ends actually shows up.
func TestHandoffOverRealHTTP(t *testing.T) {
	for i := 0; i < 30; i++ {
		s, st := newTest(t)
		srv := httptest.NewServer(s)
		token := setupPass(t, s)

		payload := bytes.Repeat([]byte("slip"), 300000)
		offer := `{"name":"a.bin","size":` + strconv.Itoa(len(payload)) + `}`
		rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender, []byte(offer), jsonWriteHdr())
		var created struct {
			Handoff struct {
				ID string `json:"id"`
			} `json:"handoff"`
		}
		decode(t, rr, &created)
		id := created.Handoff.ID
		rr = handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/accept", token, devReceiver, []byte(`{}`), jsonWriteHdr())
		var acc struct {
			PullURL string `json:"pullUrl"`
		}
		decode(t, rr, &acc)

		var wg sync.WaitGroup
		var pulled, pullStatus int
		wg.Add(1)
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest("GET", srv.URL+acc.PullURL, nil)
			req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
			req.AddCookie(&http.Cookie{Name: "slip_device", Value: devReceiver})
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				pullStatus = -1
				return
			}
			defer res.Body.Close()
			pullStatus = res.StatusCode
			n, _ := io.Copy(io.Discard, res.Body)
			pulled = int(n)
		}()

		req, _ := http.NewRequest("POST", srv.URL+"/api/handoff/"+id+"/push", bytes.NewReader(payload))
		req.Header.Set("X-Slip", "1")
		req.Header.Set("Content-Type", "application/octet-stream")
		req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
		req.AddCookie(&http.Cookie{Name: "slip_device", Value: devSender})
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("run %d push: %v", i, err)
		}
		res.Body.Close()
		wg.Wait()

		sum := sha256.Sum256(payload)
		items, _ := st.List(10, "")
		ok := res.StatusCode == http.StatusOK &&
			pulled == len(payload) && pullStatus == http.StatusOK &&
			len(items) == 1 && items[0].Kind == store.KindHandoff &&
			items[0].Transfer != nil && items[0].Transfer.SHA256 == hex.EncodeToString(sum[:])
		if !ok {
			t.Fatalf("run %d: push=%d pulled=%d/%d pull=%d items=%d",
				i, res.StatusCode, pulled, len(payload), pullStatus, len(items))
		}
		srv.Close()
	}
}

// A download manager (IDM and friends) opens several connections and asks
// for byte ranges. This stream can satisfy neither: it is one pass, with
// no copy to seek into. The answer must be a plain refusal, and the
// headers must say up front that ranges are not on offer, so a manager
// that reads them stays on one connection.
func TestDownloadManagerIsToldThereAreNoRanges(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	payload := bytes.Repeat([]byte("z"), 400*1024)
	id, pull := openOffer(t, s, token, len(payload))

	wg := pushAsync(t, s, token, id, payload)
	first := handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil)
	wg.Wait()

	if first.Code != http.StatusOK || first.Body.Len() != len(payload) {
		t.Fatalf("first download %d with %d bytes", first.Code, first.Body.Len())
	}
	if got := first.Header().Get("Accept-Ranges"); got != "none" {
		t.Fatalf("accept-ranges = %q, want none", got)
	}

	// The probe a manager makes before segmenting.
	head := handoffCall(t, s, http.MethodHead, pull, token, devReceiver, nil, nil)
	if head.Header().Get("Accept-Ranges") != "none" {
		t.Fatalf("head accept-ranges = %q", head.Header().Get("Accept-Ranges"))
	}

	// A range request on a finished stream is a 404, not a hang and not
	// a second body.
	ranged := handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, http.Header{
		"Range": []string{"bytes=0-1023"},
	})
	if ranged.Code == http.StatusOK {
		t.Fatalf("range request answered with a body")
	}
}

// While one download holds the pipe, a second must be refused at once,
// and with a code that says why, instead of waiting and then failing.
func TestSecondDownloadIsRefusedWhileOneRuns(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	payload := bytes.Repeat([]byte("q"), 200*1024)
	id, pull := openOffer(t, s, token, len(payload))

	// The first download starts and parks on the pipe, waiting for the
	// upload. It holds the consumer slot from that moment.
	first := make(chan *httptest.ResponseRecorder, 1)
	go func() { first <- handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil) }()

	sess, ok := s.hub.Get(id)
	if !ok {
		t.Fatal("session gone")
	}
	for i := 0; i < 2000 && !sess.Pulling(); i++ {
		time.Sleep(time.Millisecond)
	}
	if !sess.Pulling() {
		t.Fatal("the first download never took the slot")
	}

	second := handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil)
	if second.Code != http.StatusConflict {
		t.Fatalf("second download %d %s", second.Code, second.Body.String())
	}
	if code := errCode(t, second); code != "one_shot" {
		t.Fatalf("second download code %q", code)
	}

	wg := pushAsync(t, s, token, id, payload)
	wg.Wait()
	got := <-first
	if got.Code != http.StatusOK || got.Body.Len() != len(payload) {
		t.Fatalf("first download %d with %d bytes", got.Code, got.Body.Len())
	}
}

// A browser download can be cancelled and reissued by the browser, or by
// a download manager taking over. The first pipe is dead at that point,
// so the session must fall back to Accepted with a fresh pipe and let
// both ends go again, instead of failing the whole handoff.
func TestTakeoverRestartsTheAttempt(t *testing.T) {
	s, st := newTest(t)
	srv := httptest.NewServer(s)
	defer srv.Close()
	token := setupPass(t, s)

	payload := bytes.Repeat([]byte("k"), 3*1024*1024)
	id, pull := openOffer(t, s, token, len(payload))

	sess, ok := s.hub.Get(id)
	if !ok {
		t.Fatal("session gone")
	}

	// First attempt: the sender pushes, the browser starts reading, then
	// the connection is torn down the way a takeover does it.
	push1 := make(chan int, 1)
	go func() {
		req, _ := http.NewRequest("POST", srv.URL+"/api/handoff/"+id+"/push", bytes.NewReader(payload))
		req.Header.Set("X-Slip", "1")
		req.Header.Set("Content-Type", "application/octet-stream")
		req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
		req.AddCookie(&http.Cookie{Name: "slip_device", Value: devSender})
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			push1 <- -1
			return
		}
		res.Body.Close()
		push1 <- res.StatusCode
	}()

	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, "GET", srv.URL+pull, nil)
	req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
	req.AddCookie(&http.Cookie{Name: "slip_device", Value: devReceiver})
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 128<<10)
	if _, err := io.ReadFull(res.Body, buf); err != nil {
		t.Fatalf("first read: %v", err)
	}
	cancel()
	res.Body.Close()

	if got := <-push1; got != http.StatusConflict {
		t.Fatalf("first attempt ended with %d, want 409 restart", got)
	}

	info := sess.Snapshot(devSender)
	if info.State != handoff.Accepted || info.Gen != 1 {
		t.Fatalf("after takeover: state=%s gen=%d", info.State, info.Gen)
	}

	// Second attempt: same ticket, same session, fresh pipe.
	push2 := pushAsync(t, s, token, id, payload)
	second := handoffCall(t, s, http.MethodGet, pull, token, devReceiver, nil, nil)
	push2.Wait()

	if second.Code != http.StatusOK || second.Body.Len() != len(payload) {
		t.Fatalf("second attempt: %d with %d bytes", second.Code, second.Body.Len())
	}
	if !bytes.Equal(second.Body.Bytes(), payload) {
		t.Fatal("second attempt delivered different bytes")
	}
	items, _ := st.List(10, "")
	if len(items) != 1 || items[0].Kind != store.KindHandoff {
		t.Fatalf("no record after the restart: %d items", len(items))
	}
}

// A download manager is a separate process with its own cookie jar. It
// arrives with the ticket in the URL and no session cookie at all, and
// it must still get the file: requiring a login here turned every
// takeover into a 401.
func TestPullWorksWithoutASessionCookie(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)
	payload := bytes.Repeat([]byte("c"), 300*1024)
	id, pull := openOffer(t, s, token, len(payload))

	wg := pushAsync(t, s, token, id, payload)

	req := httptest.NewRequest(http.MethodGet, pull, nil)
	req.RemoteAddr = lanAddr
	req.Host = "127.0.0.1:8787"
	rr := httptest.NewRecorder()
	s.ServeHTTP(rr, req)
	wg.Wait()

	if rr.Code != http.StatusOK || rr.Body.Len() != len(payload) {
		t.Fatalf("cookieless pull: %d with %d bytes", rr.Code, rr.Body.Len())
	}

	// A wrong ticket is still refused.
	bad := httptest.NewRequest(http.MethodGet, "/api/handoff/"+id+"/pull?n=deadbeef", nil)
	bad.RemoteAddr = lanAddr
	br := httptest.NewRecorder()
	s.ServeHTTP(br, bad)
	if br.Code != http.StatusUnauthorized {
		t.Fatalf("bad ticket %d", br.Code)
	}
}

// A download manager takes a URL away from the browser and asks for it
// itself while the browser's request is still open. Two readers, one
// pipe. The newest request has to win, otherwise the manager is refused
// forever and the person sees "this site will not serve the same file
// twice".
func TestNewerDownloadTakesOverAMovingOne(t *testing.T) {
	s, st := newTest(t)
	srv := httptest.NewServer(s)
	defer srv.Close()
	token := setupPass(t, s)

	payload := bytes.Repeat([]byte("m"), 4*1024*1024)
	id, pull := openOffer(t, s, token, len(payload))

	push1 := make(chan int, 1)
	go func() {
		req, _ := http.NewRequest("POST", srv.URL+"/api/handoff/"+id+"/push", bytes.NewReader(payload))
		req.Header.Set("X-Slip", "1")
		req.Header.Set("Content-Type", "application/octet-stream")
		req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
		req.AddCookie(&http.Cookie{Name: "slip_device", Value: devSender})
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			push1 <- -1
			return
		}
		res.Body.Close()
		push1 <- res.StatusCode
	}()

	// The browser's download: open, moving, and still going.
	req1, _ := http.NewRequest("GET", srv.URL+pull, nil)
	req1.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
	res1, err := http.DefaultClient.Do(req1)
	if err != nil {
		t.Fatal(err)
	}
	defer res1.Body.Close()
	if _, err := io.ReadFull(res1.Body, make([]byte, 64<<10)); err != nil {
		t.Fatalf("first download: %v", err)
	}

	// Give it long enough to be a real transfer, then the manager asks.
	time.Sleep(handoff.PreemptGrace + 200*time.Millisecond)

	type got struct {
		status int
		body   []byte
	}
	second := make(chan got, 1)
	go func() {
		req2, _ := http.NewRequest("GET", srv.URL+pull, nil)
		res2, err := http.DefaultClient.Do(req2)
		if err != nil {
			second <- got{status: -1}
			return
		}
		defer res2.Body.Close()
		body, _ := io.ReadAll(res2.Body)
		second <- got{status: res2.StatusCode, body: body}
	}()

	// The first upload is released by the takeover and the page sends
	// the file again.
	if code := <-push1; code != http.StatusConflict {
		t.Fatalf("first upload ended with %d, want 409 restart", code)
	}
	push2 := pushAsync(t, s, token, id, payload)

	result := <-second
	push2.Wait()

	if result.status != http.StatusOK || len(result.body) != len(payload) {
		t.Fatalf("takeover download: %d with %d bytes", result.status, len(result.body))
	}
	if !bytes.Equal(result.body, payload) {
		t.Fatal("takeover download delivered different bytes")
	}
	items, _ := st.List(10, "")
	if len(items) != 1 || items[0].Kind != store.KindHandoff {
		t.Fatalf("no record after takeover: %d items", len(items))
	}
}
