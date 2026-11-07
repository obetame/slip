package handoff

import (
	"sort"
	"sync"
	"time"
)

// DeviceTTL is how long a device stays on the list after its last
// request. The board polls every twenty seconds, so three missed beats
// is a gone device.
const DeviceTTL = 45 * time.Second

// Device is one browser that has talked to slip recently. There are no
// accounts: this is only "something is open right now".
type Device struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type deviceRec struct {
	name string
	last time.Time
}

// Devices is the presence table. It is deliberately in memory only. A
// restart means nobody is here yet, which is the truth.
type Devices struct {
	mu  sync.Mutex
	m   map[string]*deviceRec
	now func() time.Time
}

func newDevices(now func() time.Time) *Devices {
	return &Devices{m: map[string]*deviceRec{}, now: now}
}

func (d *Devices) SetClock(now func() time.Time) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.now = now
}

// Touch records that a device is here, and refreshes its name in case
// the page sent a better one than the user agent gives.
func (d *Devices) Touch(id, name string) {
	if id == "" {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	rec := d.m[id]
	if rec == nil {
		rec = &deviceRec{}
		d.m[id] = rec
	}
	if name != "" {
		rec.name = name
	}
	rec.last = d.now()
}

// Name is how a device should be introduced on someone else's card.
func (d *Devices) Name(id string) string {
	d.mu.Lock()
	defer d.mu.Unlock()
	if rec := d.m[id]; rec != nil {
		return rec.name
	}
	return ""
}

// List returns the devices seen inside DeviceTTL, sorted so the same
// household always reads the same way. The caller filters itself out.
func (d *Devices) List() []Device {
	d.mu.Lock()
	defer d.mu.Unlock()
	cut := d.now().Add(-DeviceTTL)
	out := make([]Device, 0, len(d.m))
	for id, rec := range d.m {
		if rec.last.Before(cut) {
			delete(d.m, id)
			continue
		}
		out = append(out, Device{ID: id, Name: rec.name})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].ID < out[j].ID
	})
	return out
}
