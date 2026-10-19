package thumb

import (
	"bytes"
	"image"
	"image/jpeg"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"golang.org/x/image/draw"
	_ "image/gif"
	_ "image/png"
)

const maxEdge = 960
const maxPixels = 20_000_000

// WriteJPEG makes a JPEG preview at most 960px on the long edge.
// On macOS it tries sips first, which also understands HEIC.
func WriteJPEG(src, dst, ext string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}
	if runtime.GOOS == "darwin" {
		if err := sips(src, dst, ext); err == nil {
			if st, statErr := os.Stat(dst); statErr == nil && st.Size() > 0 {
				return nil
			}
		}
		_ = os.Remove(dst)
	}
	return golangJPEG(src, dst)
}

func sips(src, dst, ext string) error {
	if ext == "" {
		ext = ".img"
	}
	in, err := os.CreateTemp("", "slip-*"+ext)
	if err != nil {
		return err
	}
	inName := in.Name()
	defer os.Remove(inName)
	srcFile, err := os.Open(src)
	if err != nil {
		in.Close()
		return err
	}
	_, copyErr := io.Copy(in, srcFile)
	srcFile.Close()
	closeErr := in.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	cmd := exec.Command("sips", "-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", "960", inName, "--out", dst)
	cmd.Stdout = io.Discard
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	return cmd.Run()
}

func golangJPEG(src, dst string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > maxPixels {
		return errTooBig
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return err
	}
	img, _, err := image.Decode(f)
	if err != nil {
		return err
	}
	nw, nh := fit(cfg.Width, cfg.Height, maxEdge)
	out := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.ApproxBiLinear.Scale(out, out.Bounds(), img, img.Bounds(), draw.Over, nil)
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".thumb-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	ok := false
	defer func() {
		if !ok {
			_ = os.Remove(tmpName)
		}
	}()
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if err := jpeg.Encode(tmp, out, &jpeg.Options{Quality: 70}); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, dst); err != nil {
		return err
	}
	ok = true
	return nil
}

func fit(w, h, max int) (int, int) {
	if w <= max && h <= max {
		return w, h
	}
	if w >= h {
		nh := max * h / w
		if nh < 1 {
			nh = 1
		}
		return max, nh
	}
	nw := max * w / h
	if nw < 1 {
		nw = 1
	}
	return nw, max
}

type tooBig struct{}

func (tooBig) Error() string { return "image too large to preview" }

var errTooBig = tooBig{}
