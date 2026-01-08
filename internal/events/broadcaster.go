package events

import (
	"sync"
)

// Subscriber represents a channel that receives events.
type Subscriber chan Event

// Broadcaster manages WebSocket event subscribers.
type Broadcaster struct {
	mu          sync.RWMutex
	subscribers map[Subscriber]struct{}
}

var broadcaster = &Broadcaster{
	subscribers: make(map[Subscriber]struct{}),
}

// Subscribe adds a new subscriber and returns its channel.
// The channel has a buffer to prevent blocking on slow clients.
func Subscribe() Subscriber {
	ch := make(Subscriber, 64) // Buffer to avoid blocking Emit
	broadcaster.mu.Lock()
	broadcaster.subscribers[ch] = struct{}{}
	broadcaster.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber and closes its channel.
func Unsubscribe(sub Subscriber) {
	broadcaster.mu.Lock()
	delete(broadcaster.subscribers, sub)
	broadcaster.mu.Unlock()
	close(sub)
}

// broadcast sends an event to all subscribers.
// Non-blocking: if a subscriber's buffer is full, the event is dropped for that subscriber.
func broadcast(e Event) {
	broadcaster.mu.RLock()
	defer broadcaster.mu.RUnlock()

	for sub := range broadcaster.subscribers {
		select {
		case sub <- e:
		default:
			// Buffer full, drop event for this slow subscriber
		}
	}
}

// SubscriberCount returns the current number of subscribers.
func SubscriberCount() int {
	broadcaster.mu.RLock()
	defer broadcaster.mu.RUnlock()
	return len(broadcaster.subscribers)
}

// RecentEvents returns the last n events from the ring buffer.
// If n is greater than available events, returns all available.
func RecentEvents(n int) []Event {
	all := buffer.Snapshot()
	if n <= 0 || n >= len(all) {
		return all
	}
	return all[len(all)-n:]
}
