package server

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
)

func faviconPNG() []byte {
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	paper := color.NRGBA{0xf3, 0xef, 0xe6, 0xff}
	seal := color.NRGBA{0x8f, 0x2d, 0x2a, 0xff}
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			img.SetNRGBA(x, y, paper)
		}
	}
	for y := 0; y < 32; y++ {
		for x := 0; x < 4; x++ {
			img.SetNRGBA(x, y, seal)
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
