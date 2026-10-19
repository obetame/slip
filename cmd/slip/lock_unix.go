//go:build unix

package main

import (
	"os"
	"path/filepath"
	"syscall"
)

// lockFile stays open for the life of the process. Closing it would drop the lock.
var lockFile *os.File

func acquireLock(dir string) error {
	f, err := os.OpenFile(filepath.Join(dir, "slip.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		return err
	}
	lockFile = f
	return nil
}
