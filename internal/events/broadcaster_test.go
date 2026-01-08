package events

import (
	"testing"
	"time"
)

func TestSubscribeUnsubscribe(t *testing.T) {
	// Start with no subscribers
	initial := SubscriberCount()

	sub1 := Subscribe()
	if SubscriberCount() != initial+1 {
		t.Errorf("expected %d subscribers after first subscribe, got %d", initial+1, SubscriberCount())
	}

	sub2 := Subscribe()
	if SubscriberCount() != initial+2 {
		t.Errorf("expected %d subscribers after second subscribe, got %d", initial+2, SubscriberCount())
	}

	Unsubscribe(sub1)
	if SubscriberCount() != initial+1 {
		t.Errorf("expected %d subscribers after unsubscribe, got %d", initial+1, SubscriberCount())
	}

	Unsubscribe(sub2)
	if SubscriberCount() != initial {
		t.Errorf("expected %d subscribers after all unsubscribed, got %d", initial, SubscriberCount())
	}
}

func TestBroadcastToSubscribers(t *testing.T) {
	sub := Subscribe()
	defer Unsubscribe(sub)

	// Emit an event
	Emit("info", "node.started", "test", map[string]interface{}{"node_id": "test_node"})

	// Should receive the event
	select {
	case e := <-sub:
		if e.Name != "node.started" {
			t.Errorf("expected event name 'node.started', got '%s'", e.Name)
		}
		if e.Fields["node_id"] != "test_node" {
			t.Errorf("expected node_id 'test_node', got '%v'", e.Fields["node_id"])
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for broadcast event")
	}
}

func TestRecentEvents(t *testing.T) {
	Clear()

	// Emit some events
	for i := 0; i < 10; i++ {
		Emit("info", "node.started", "", map[string]interface{}{"i": i})
	}

	// Get recent 5
	recent := RecentEvents(5)
	if len(recent) != 5 {
		t.Errorf("expected 5 recent events, got %d", len(recent))
	}

	// First recent event should be i=5 (the 6th event, since we're getting last 5)
	if recent[0].Fields["i"] != 5 {
		t.Errorf("expected first recent event i=5, got %v", recent[0].Fields["i"])
	}

	// Get more than available
	all := RecentEvents(100)
	if len(all) != 10 {
		t.Errorf("expected 10 events when requesting 100, got %d", len(all))
	}

	// Get 0 should return all
	zero := RecentEvents(0)
	if len(zero) != 10 {
		t.Errorf("expected 10 events when requesting 0, got %d", len(zero))
	}
}

func TestMultipleSubscribersReceiveEvents(t *testing.T) {
	sub1 := Subscribe()
	sub2 := Subscribe()
	defer Unsubscribe(sub1)
	defer Unsubscribe(sub2)

	Emit("info", "scene.started", "", map[string]interface{}{"scene_id": "intro"})

	// Both should receive
	select {
	case e := <-sub1:
		if e.Name != "scene.started" {
			t.Errorf("sub1: expected 'scene.started', got '%s'", e.Name)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("sub1: timeout waiting for event")
	}

	select {
	case e := <-sub2:
		if e.Name != "scene.started" {
			t.Errorf("sub2: expected 'scene.started', got '%s'", e.Name)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("sub2: timeout waiting for event")
	}
}

func TestUnsubscribeClosesChannel(t *testing.T) {
	sub := Subscribe()
	Unsubscribe(sub)

	// Channel should be closed
	_, ok := <-sub
	if ok {
		t.Error("expected channel to be closed after unsubscribe")
	}
}

func TestCloseAllSubscribers(t *testing.T) {
	// Clear any existing subscribers
	CloseAllSubscribers()

	// Create multiple subscribers
	sub1 := Subscribe()
	sub2 := Subscribe()
	sub3 := Subscribe()

	if SubscriberCount() != 3 {
		t.Errorf("expected 3 subscribers, got %d", SubscriberCount())
	}

	// Close all subscribers
	CloseAllSubscribers()

	// All channels should be closed
	_, ok1 := <-sub1
	_, ok2 := <-sub2
	_, ok3 := <-sub3

	if ok1 || ok2 || ok3 {
		t.Error("expected all channels to be closed")
	}

	// Subscriber count should be 0
	if SubscriberCount() != 0 {
		t.Errorf("expected 0 subscribers after CloseAllSubscribers, got %d", SubscriberCount())
	}
}
