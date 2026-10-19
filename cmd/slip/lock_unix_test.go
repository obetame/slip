//go:build unix

package main

import (
	"os"
	"os/exec"
	"testing"
)

func TestSecondProcessLocks(t *testing.T) {
	dir := t.TempDir()
	if err := acquireLock(dir); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestLockChild$")
	cmd.Env = append(os.Environ(), "SLIP_LOCK_DIR="+dir)
	if err := cmd.Run(); err == nil {
		t.Fatal("a second process took the lock")
	}
}

func TestLockChild(t *testing.T) {
	dir := os.Getenv("SLIP_LOCK_DIR")
	if dir == "" {
		return
	}
	if err := acquireLock(dir); err != nil {
		os.Exit(1)
	}
}
