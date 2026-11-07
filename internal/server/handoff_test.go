package server

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"

	"github.com/obetame/slip/internal/handoff"
	"github.com/obetame/slip/internal/store"
)

const (
	devSender   = "aaaaaaaaaaaaaaaa"
	devReceiver = "bbbbbbbbbbbbbbbb"
)

// handoffCall is call() with a device cookie, because a handoff needs to
// know which browser is which without an account.
func handoffCall(t *testing.T, s *Server, method, target, token, device string, body []byte, hdr http.Header) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req := httptest.NewRequest(method, target, r)
	req.RemoteAddr = lanAddr
	req.Host = "127.0.0.1:8787"
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "slip_session", Value: token})
	}
	if device != "" {
		req.AddCookie(&http.Cookie{Name: "slip_device", Value: device})
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

func jsonWriteHdr() http.Header {
	return http.Header{
		"Content-Type": []string{"application/json"},
		"X-Slip":       []string{"1"},
	}
}

// TestHandoffEndToEnd drives the whole path: an offer that carries no
// bytes, a take, a stream that never touches the disk, and the single
// record left behind.
func TestHandoffEndToEnd(t *testing.T) {
	s, st := newTest(t)
	token := setupPass(t, s)

	payload := make([]byte, 3*handoff.Chunk-17)
	for i := range payload {
		payload[i] = byte(i * 7)
	}
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	offer := `{"name":"movie.mp4","size":` + strconv.Itoa(len(payload)) + `,"mime":"video/mp4"}`
	rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender, []byte(offer), jsonWriteHdr())
	if rr.Code != http.StatusCreated {
		t.Fatalf("offer %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Handoff handoff.Info `json:"handoff"`
	}
	decode(t, rr, &created)
	id := created.Handoff.ID
	if len(id) != 16 || created.Handoff.State != handoff.Offered {
		t.Fatalf("offer %+v", created.Handoff)
	}
	// Offering must not have written anything at all.
	if used, _ := st.Usage(); used != 0 {
		t.Fatalf("offer used %d bytes", used)
	}

	rr = handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/accept", token, devReceiver, []byte(`{}`), jsonWriteHdr())
	if rr.Code != http.StatusOK {
		t.Fatalf("accept %d %s", rr.Code, rr.Body.String())
	}
	var accepted struct {
		PullURL string `json:"pullUrl"`
	}
	decode(t, rr, &accepted)
	if accepted.PullURL == "" {
		t.Fatal("no pull url")
	}

	// The download and the upload have to be in flight together: that is
	// the whole mechanism.
	var wg sync.WaitGroup
	var pulled *httptest.ResponseRecorder
	wg.Add(1)
	go func() {
		defer wg.Done()
		pulled = handoffCall(t, s, http.MethodGet, accepted.PullURL, token, devReceiver, nil, nil)
	}()

	pushHdr := http.Header{
		"Content-Type": []string{"application/octet-stream"},
		"X-Slip":       []string{"1"},
	}
	rr = handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/push", token, devSender, payload, pushHdr)
	if rr.Code != http.StatusOK {
		t.Fatalf("push %d %s", rr.Code, rr.Body.String())
	}
	var pushed struct {
		SHA256 string `json:"sha256"`
		Bytes  int64  `json:"bytes"`
	}
	decode(t, rr, &pushed)
	if pushed.SHA256 != want || pushed.Bytes != int64(len(payload)) {
		t.Fatalf("push reply %+v", pushed)
	}
	wg.Wait()

	if pulled.Code != http.StatusOK {
		t.Fatalf("pull %d %s", pulled.Code, pulled.Body.String())
	}
	if got := pulled.Header().Get("Content-Length"); got != strconv.Itoa(len(payload)) {
		t.Fatalf("content-length = %q", got)
	}
	if !bytes.Equal(pulled.Body.Bytes(), payload) {
		t.Fatalf("body %d bytes, want %d", pulled.Body.Len(), len(payload))
	}

	// One record, no blob, no quota.
	items, _ := st.List(10, "")
	if len(items) != 1 {
		t.Fatalf("items = %d", len(items))
	}
	rec := items[0]
	if rec.Kind != store.KindHandoff || rec.Name != "movie.mp4" || rec.Size != int64(len(payload)) {
		t.Fatalf("record %+v", rec)
	}
	if rec.Transfer == nil || rec.Transfer.SHA256 != want {
		t.Fatalf("transfer %+v", rec.Transfer)
	}
	if used, _ := st.Usage(); used != 0 {
		t.Fatalf("handoff used %d bytes of quota", used)
	}
	blobs, err := os.ReadDir(filepath.Join(st.Dir(), "blobs"))
	if err != nil {
		t.Fatal(err)
	}
	if len(blobs) != 0 {
		t.Fatalf("blobs written: %d", len(blobs))
	}

	// The record cannot be downloaded, and says why.
	rr = handoffCall(t, s, http.MethodGet, "/api/items/"+rec.ID+"/raw", token, devSender, nil, nil)
	if rr.Code != http.StatusConflict || errCode(t, rr) != "not_stored" {
		t.Fatalf("raw %d %s", rr.Code, rr.Body.String())
	}
}

func TestHandoffGuards(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)

	rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender,
		[]byte(`{"name":"a.bin","size":10}`), jsonWriteHdr())
	var created struct {
		Handoff handoff.Info `json:"handoff"`
	}
	decode(t, rr, &created)
	id := created.Handoff.ID

	// A write without the CSRF header is refused.
	if rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender,
		[]byte(`{"name":"b.bin","size":10}`), nil); rr.Code != http.StatusForbidden {
		t.Fatalf("no header %d", rr.Code)
	}
	// Only the sender may push.
	pushHdr := http.Header{"Content-Type": []string{"application/octet-stream"}, "X-Slip": []string{"1"}}
	if rr := handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/push", token, devReceiver,
		make([]byte, 10), pushHdr); rr.Code != http.StatusForbidden {
		t.Fatalf("foreign push %d %s", rr.Code, rr.Body.String())
	}
	// Push before a take is refused.
	if rr := handoffCall(t, s, http.MethodPost, "/api/handoff/"+id+"/push", token, devSender,
		make([]byte, 10), pushHdr); rr.Code != http.StatusConflict {
		t.Fatalf("early push %d %s", rr.Code, rr.Body.String())
	}
	// A pull without a ticket is refused. 401 rather than 404: the
	// ticket is the credential, and saying "no credential" is honest.
	if rr := handoffCall(t, s, http.MethodGet, "/api/handoff/"+id+"/pull", token, devReceiver, nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("ticketless pull %d", rr.Code)
	}
	// An empty size is rejected at the door.
	if rr := handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender,
		[]byte(`{"name":"a.bin","size":0}`), jsonWriteHdr()); rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("zero size %d %s", rr.Code, rr.Body.String())
	}
}

// TestLiveBlock covers the poll the board already runs: one request must
// carry presence and open cards.
func TestLiveBlock(t *testing.T) {
	s, _ := newTest(t)
	token := setupPass(t, s)

	// The sender's own bootstrap marks it present.
	rr := handoffCall(t, s, http.MethodGet, "/api/bootstrap", token, devSender, nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("bootstrap %d", rr.Code)
	}
	rr = handoffCall(t, s, http.MethodPost, "/api/handoff", token, devSender,
		[]byte(`{"name":"a.bin","size":1024}`), jsonWriteHdr())
	if rr.Code != http.StatusCreated {
		t.Fatalf("offer %d %s", rr.Code, rr.Body.String())
	}

	// The receiver sees the card and the other device, not itself.
	rr = handoffCall(t, s, http.MethodGet, "/api/items?limit=5&live=1", token, devReceiver, nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("live %d %s", rr.Code, rr.Body.String())
	}
	var live struct {
		Devices  []handoff.Device `json:"devices"`
		Device   handoff.Device   `json:"device"`
		Handoffs []handoff.Info   `json:"handoffs"`
	}
	decode(t, rr, &live)
	if live.Device.ID != devReceiver {
		t.Fatalf("self %+v", live.Device)
	}
	if len(live.Devices) != 1 || live.Devices[0].ID != devSender {
		t.Fatalf("devices %+v", live.Devices)
	}
	if len(live.Handoffs) != 1 || live.Handoffs[0].State != handoff.Offered || live.Handoffs[0].Mine {
		t.Fatalf("handoffs %+v", live.Handoffs)
	}

	// Without live the reply keeps its old shape.
	rr = handoffCall(t, s, http.MethodGet, "/api/items?limit=5", token, devReceiver, nil, nil)
	var plain map[string]any
	decode(t, rr, &plain)
	if _, ok := plain["handoffs"]; ok {
		t.Fatal("live block leaked into the plain list")
	}
}
