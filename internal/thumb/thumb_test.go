package thumb

import (
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteJPEGScales(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "wide.png")
	dst := filepath.Join(dir, "wide.jpg")
	img := image.NewRGBA(image.Rect(0, 0, 1200, 10))
	f, err := os.Create(src)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(f, img); err != nil {
		f.Close()
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	if err := WriteJPEG(src, dst, ".png"); err != nil {
		t.Fatal(err)
	}
	out, err := os.Open(dst)
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	cfg, _, err := image.DecodeConfig(out)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width > maxEdge || cfg.Height > maxEdge || cfg.Width < 100 {
		t.Fatalf("size %dx%d", cfg.Width, cfg.Height)
	}
}
