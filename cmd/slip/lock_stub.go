//go:build !unix

package main

func acquireLock(string) error { return nil }
