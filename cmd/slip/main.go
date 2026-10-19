package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/obetame/slip/internal/auth"
	"github.com/obetame/slip/internal/config"
	"github.com/obetame/slip/internal/lan"
	"github.com/obetame/slip/internal/listen"
	"github.com/obetame/slip/internal/qrcode"
	"github.com/obetame/slip/internal/server"
	"github.com/obetame/slip/internal/session"
	"github.com/obetame/slip/internal/store"
	"github.com/obetame/slip/internal/version"
)

func main() {
	log.SetFlags(0)
	portFlag := flag.Int("port", 0, "port to listen on (default 8787)")
	dataFlag := flag.String("data", "", "directory for slips and the passphrase hash")
	hostFlag := flag.String("host", "", "address to bind (default all interfaces)")
	noOpenFlag := flag.Bool("no-open", false, "do not open a browser on first run")
	versionFlag := flag.Bool("version", false, "print the version and exit")
	flag.Usage = usage
	flag.Parse()

	if *versionFlag {
		fmt.Println(version.Current)
		return
	}

	data := *dataFlag
	if data == "" {
		data = os.Getenv("SLIP_DATA")
	}
	if data == "" {
		data = defaultDir()
	}
	noOpen := *noOpenFlag || os.Getenv("SLIP_NO_OPEN") == "1"

	cfg, err := config.Open(data)
	if err != nil {
		die(err)
	}
	st, err := store.Open(data)
	if err != nil {
		die(err)
	}
	book, err := session.Open(data, nil)
	if err != nil {
		die(err)
	}
	if err := acquireLock(data); err != nil {
		die(errors.New("slip is already running"))
	}

	port, explicit := chosenPort(*portFlag, cfg.SavedPort())
	extra := 10
	if explicit {
		extra = 0
	}
	ln, got, err := listen.Listen(*hostFlag, port, extra)
	if err != nil {
		die(err)
	}
	if err := cfg.SetPort(got); err != nil {
		die(err)
	}

	app := server.New(st, cfg, book, auth.DefaultParams(), version.Current)
	app.SetPort(got)
	httpSrv := &http.Server{
		Handler:           app,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       5 * time.Minute,
		WriteTimeout:      5 * time.Minute,
		IdleTimeout:       2 * time.Minute,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go janitor(ctx, st)

	errCh := make(chan error, 1)
	go func() {
		errCh <- httpSrv.Serve(ln)
	}()

	printBanner(*hostFlag, got)
	if !cfg.HasPassphrase() && !noOpen && openable(*hostFlag) {
		openBrowser(fmt.Sprintf("http://127.0.0.1:%d", got))
	}

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			die(err)
		}
	case <-ctx.Done():
		shut, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shut)
		<-errCh
	}
}

func chosenPort(flagPort, saved int) (int, bool) {
	if flagPort != 0 {
		return flagPort, true
	}
	if v := os.Getenv("SLIP_PORT"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 65535 {
			die(errors.New("SLIP_PORT is not a port"))
		}
		return n, true
	}
	if saved > 0 {
		return saved, false
	}
	return 8787, false
}

func printBanner(host string, port int) {
	fmt.Printf("slip %s\n", version.Current)
	fmt.Printf("本机 local   http://127.0.0.1:%d\n", port)
	// A loopback bind is not reachable from the other devices, so the
	// LAN lines and the QR would point at an address this process is
	// not serving.
	if loopbackOnly(host) {
		return
	}
	urls := lan.ShareURLs(port)
	for _, u := range urls {
		if strings.Contains(strings.ToLower(u), ".local:") {
			fmt.Printf("名字 name    %s\n", u)
			continue
		}
		fmt.Printf("家里 lan     %s\n", u)
	}
	if len(urls) == 0 {
		return
	}
	qr, err := qrcode.Terminal(urls[0])
	if err != nil {
		return
	}
	fmt.Println()
	fmt.Print(qr)
}

// loopbackOnly is true when the process is not listening on the LAN.
// An empty host binds every interface, so it still prints share URLs.
func loopbackOnly(host string) bool {
	switch strings.ToLower(strings.TrimSpace(host)) {
	case "127.0.0.1", "localhost", "::1":
		return true
	default:
		return false
	}
}

func defaultDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return "slip-data"
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "slip")
	case "windows":
		base := os.Getenv("AppData")
		if base == "" {
			base = home
		}
		return filepath.Join(base, "slip")
	default:
		base := os.Getenv("XDG_DATA_HOME")
		if base == "" {
			base = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(base, "slip")
	}
}

func openable(host string) bool {
	switch host {
	case "", "127.0.0.1", "localhost", "::1":
		return true
	default:
		return false
	}
}

func openBrowser(url string) {
	if runtime.GOOS != "darwin" {
		return
	}
	_ = exec.Command("open", url).Start()
}

func usage() {
	fmt.Fprintf(os.Stderr, "slip %s\n\n", version.Current)
	fmt.Fprintf(os.Stderr, "usage: slip [--port 8787] [--data DIR] [--host ADDR] [--no-open]\n\n")
	flag.PrintDefaults()
}

func die(err error) {
	fmt.Fprintf(os.Stderr, "slip: %s\n", err.Error())
	os.Exit(1)
}

func janitor(ctx context.Context, st *store.Store) {
	tick := time.NewTicker(5 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			st.Purge()
		}
	}
}
