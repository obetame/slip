package server

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/obetame/slip/internal/store"
	"github.com/obetame/slip/internal/thumb"
)

func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	limit := 40
	if q := r.URL.Query().Get("limit"); q != "" {
		n, err := strconv.Atoi(q)
		if err != nil || n < 1 || n > 100 {
			writeErr(w, http.StatusBadRequest, "bad_request")
			return
		}
		limit = n
	}
	items, more := s.store.List(limit, r.URL.Query().Get("before"))
	if items == nil {
		items = []store.Public{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "hasMore": more})
}

func (s *Server) createText(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	var body struct {
		Text string `json:"text"`
	}
	if err := readJSON(w, r, &body, int64(store.MaxText)*4+8192); err != nil {
		if tooLarge(err) {
			writeErr(w, http.StatusRequestEntityTooLarge, "text_too_large")
			return
		}
		writeJSONErr(w, err)
		return
	}
	it, err := s.store.AddText(body.Text)
	if err == store.ErrTooLarge {
		writeErr(w, http.StatusRequestEntityTooLarge, "text_too_large")
		return
	}
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": it.Public()})
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	limit := s.store.FileLimit()
	const maxBatch = 8
	r.Body = http.MaxBytesReader(w, r.Body, limit*maxBatch+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		if tooLarge(err) {
			writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
			return
		}
		writeErr(w, http.StatusBadRequest, "bad_request")
		return
	}
	headers := r.MultipartForm.File["file"]
	if len(headers) == 0 {
		writeErr(w, http.StatusBadRequest, "empty")
		return
	}
	if len(headers) > maxBatch {
		writeErr(w, http.StatusBadRequest, "bad_request")
		return
	}
	created := make([]store.Public, 0, len(headers))
	for _, fh := range headers {
		if fh.Size > limit {
			writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
			return
		}
		src, err := fh.Open()
		if err != nil {
			writeErr(w, http.StatusBadRequest, "bad_request")
			return
		}
		tmp, err := os.CreateTemp(s.store.IncomingDir(), "up-*")
		if err != nil {
			src.Close()
			writeErr(w, http.StatusInternalServerError, "bad_request")
			return
		}
		n, copyErr := io.Copy(tmp, io.LimitReader(src, limit+1))
		src.Close()
		closeErr := tmp.Close()
		if copyErr != nil || closeErr != nil {
			_ = os.Remove(tmp.Name())
			writeErr(w, http.StatusBadRequest, "bad_request")
			return
		}
		if n > limit {
			_ = os.Remove(tmp.Name())
			writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
			return
		}
		head := readHead(tmp.Name())
		mimeType := sniff(fh.Filename, head)
		it, err := s.store.AddFile(tmp.Name(), fh.Filename, mimeType, n)
		_ = os.Remove(tmp.Name())
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if it.Kind == store.KindImage {
			if blob, err := s.store.BlobPath(it); err == nil {
				dest := filepath.Join(s.store.Dir(), "thumbs", it.Blob+".jpg")
				ext := strings.ToLower(filepath.Ext(fh.Filename))
				if err := thumb.WriteJPEG(blob, dest, ext); err != nil {
					log.Printf("thumbnail skipped")
				} else {
					s.store.MarkThumb(it.ID, true)
					it.HasThumb = true
				}
			}
		}
		created = append(created, it.Public())
	}
	writeJSON(w, http.StatusCreated, map[string]any{"items": created})
}

func (s *Server) raw(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	it, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	path, err := s.store.BlobPath(it)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	f, err := os.Open(path)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	defer f.Close()
	inline := r.URL.Query().Get("dl") != "1" && store.InlineOK(it)
	disp := "attachment"
	ctype := "application/octet-stream"
	if inline {
		disp = "inline"
		ctype = it.Mime
	}
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Content-Disposition", contentDisposition(disp, it.Name))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, it.Name, it.CreatedAt, f)
}

func (s *Server) thumb(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	it, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	path, err := s.store.ThumbPath(it)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	f, err := os.Open(path)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not_found")
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, "thumb.jpg", it.CreatedAt, f)
}

func (s *Server) deleteItem(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	ids, err := s.store.SoftDelete([]string{r.PathValue("id")})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ids": ids, "undoSeconds": 8})
}

func (s *Server) restore(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := readJSON(w, r, &body, 64<<10); err != nil {
		writeJSONErr(w, err)
		return
	}
	ids, err := s.store.Restore(body.IDs)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ids": ids})
}

func (s *Server) clear(w http.ResponseWriter, r *http.Request) {
	if !requireWrite(w, r) || !s.requireAuth(w, r) {
		return
	}
	ids, err := s.store.SoftDeleteAll()
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	if ids == nil {
		ids = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ids": ids, "undoSeconds": 8})
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case err == store.ErrEmpty:
		writeErr(w, http.StatusBadRequest, "empty")
	case err == store.ErrTooLarge:
		writeErr(w, http.StatusRequestEntityTooLarge, "too_large")
	case err == store.ErrQuota:
		writeErr(w, http.StatusRequestEntityTooLarge, "quota")
	case err == store.ErrNotFound:
		writeErr(w, http.StatusNotFound, "not_found")
	case err == store.ErrGone:
		writeErr(w, http.StatusGone, "gone")
	default:
		writeErr(w, http.StatusInternalServerError, "bad_request")
	}
}

func contentDisposition(kind, name string) string {
	if name == "" {
		name = "file"
	}
	return kind + `; filename="` + asciiFallback(name) + `"; filename*=UTF-8''` + url.PathEscape(name)
}

func asciiFallback(name string) string {
	var b strings.Builder
	for _, r := range name {
		if r < 0x20 || r == '"' || r == '\\' || r > 0x7e {
			b.WriteByte('_')
			continue
		}
		b.WriteRune(r)
	}
	if b.Len() == 0 {
		return "file"
	}
	return b.String()
}

func readHead(path string) []byte {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	return buf[:n]
}
