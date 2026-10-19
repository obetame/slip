package server

import (
	"bytes"
	"net/http"
	"path/filepath"
	"strings"
)

func sniff(name string, head []byte) string {
	if isHEIC(head) {
		return "image/heic"
	}
	if len(head) >= 12 && string(head[0:4]) == "RIFF" && string(head[8:12]) == "WEBP" {
		return "image/webp"
	}
	ct := http.DetectContentType(head)
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".pdf":
		if bytes.HasPrefix(head, []byte("%PDF")) {
			return "application/pdf"
		}
	case ".jpg", ".jpeg":
		if ct == "application/octet-stream" {
			return "image/jpeg"
		}
	case ".png":
		if ct == "application/octet-stream" {
			return "image/png"
		}
	case ".gif":
		if ct == "application/octet-stream" {
			return "image/gif"
		}
	case ".heic", ".heif":
		return "image/heic"
	case ".webp":
		if ct == "application/octet-stream" {
			return "image/webp"
		}
	}
	return ct
}

func isHEIC(b []byte) bool {
	if len(b) < 12 || string(b[4:8]) != "ftyp" {
		return false
	}
	switch string(b[8:12]) {
	case "heic", "heix", "hevc", "hevx", "mif1", "msf1", "heif":
		return true
	default:
		return false
	}
}
