package events

import "sync"

type RingBuffer struct {
	mu     sync.RWMutex
	size   int
	events []Event
	index  int
	full   bool
}

func NewRingBuffer(size int) *RingBuffer {
	return &RingBuffer{
		size:   size,
		events: make([]Event, size),
	}
}

func (rb *RingBuffer) Add(e Event) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.events[rb.index] = e
	rb.index = (rb.index + 1) % rb.size
	if rb.index == 0 {
		rb.full = true
	}
}

func (rb *RingBuffer) Snapshot() []Event {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if !rb.full {
		return append([]Event{}, rb.events[:rb.index]...)
	}

	out := make([]Event, 0, rb.size)
	out = append(out, rb.events[rb.index:]...)
	out = append(out, rb.events[:rb.index]...)
	return out
}
