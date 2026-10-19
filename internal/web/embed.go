package web

import "embed"

// Static is the browser client. It is compiled into the slip binary.
//
//go:embed static/*
var Static embed.FS
