package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/gorilla/websocket"
)

// clearTLSEnv prevents TLS initialization from trying to load nonexistent certs.
func clearTLSEnv(t *testing.T) {
	t.Setenv("SENTIENT_TLS_CERT", "")
	t.Setenv("SENTIENT_TLS_KEY", "")
	t.Setenv("SENTIENT_TLS_CERT_FILE", "")
	t.Setenv("SENTIENT_TLS_KEY_FILE", "")
	// Also reset package-level TLS config in case a previous test set it
	SetTLSConfigForTest(nil)
}

// waitFor polls a condition until it returns true or timeout expires.
func waitFor(t *testing.T, timeout time.Duration, condition func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Errorf("timeout waiting for: %s", msg)
}

func TestWebSocketReceivesRecentEvents(t *testing.T) {
	clearTLSEnv(t)
	events.Clear()

	// Emit some events before connecting
	for i := 0; i < 5; i++ {
		events.Emit("info", "node.started", "", map[string]interface{}{"i": i})
	}

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(wsEventsHandler))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Should receive the recent events
	received := 0
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	for received < 5 {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message: %v", err)
		}
		var e events.Event
		if err := json.Unmarshal(msg, &e); err != nil {
			t.Fatalf("failed to unmarshal event: %v", err)
		}
		if e.Name != "node.started" {
			t.Errorf("expected 'node.started', got '%s'", e.Name)
		}
		received++
	}

	if received != 5 {
		t.Errorf("expected 5 recent events, got %d", received)
	}
}

func TestWebSocketReceivesNewEvents(t *testing.T) {
	clearTLSEnv(t)
	events.Clear()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(wsEventsHandler))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Emit a new event after connection
	go func() {
		time.Sleep(50 * time.Millisecond)
		events.Emit("info", "puzzle.solved", "", map[string]interface{}{"puzzle_id": "scarab"})
	}()

	// Should receive the new event
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read new event: %v", err)
	}

	var e events.Event
	if err := json.Unmarshal(msg, &e); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}

	if e.Name != "puzzle.solved" {
		t.Errorf("expected 'puzzle.solved', got '%s'", e.Name)
	}
	if e.Fields["puzzle_id"] != "scarab" {
		t.Errorf("expected puzzle_id 'scarab', got '%v'", e.Fields["puzzle_id"])
	}
}

func TestWebSocketDisconnectCleansUp(t *testing.T) {
	clearTLSEnv(t)
	events.Clear()

	// Ensure clean starting state
	events.CloseAllSubscribers()

	server := httptest.NewServer(http.HandlerFunc(wsEventsHandler))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}

	// Verify connection works by emitting an event and receiving it
	go func() {
		time.Sleep(20 * time.Millisecond)
		events.Emit("info", "node.started", "", map[string]interface{}{"test": "cleanup"})
	}()

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read test event: %v", err)
	}
	var e events.Event
	if err := json.Unmarshal(msg, &e); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}
	if e.Name != "node.started" {
		t.Errorf("expected 'node.started', got '%s'", e.Name)
	}

	// Now we know connection is working - subscriber exists
	// Close connection
	conn.Close()

	// Emit events to trigger the subscriber goroutine to notice the close
	for i := 0; i < 5; i++ {
		events.Emit("info", "node.started", "", nil)
		time.Sleep(50 * time.Millisecond)
	}

	// Wait for cleanup - subscriber count should return to 0
	waitFor(t, 5*time.Second, func() bool {
		return events.SubscriberCount() == 0
	}, "subscriber count to return to 0 after close")
}

func TestWebSocketMultipleClients(t *testing.T) {
	clearTLSEnv(t)
	events.Clear()

	server := httptest.NewServer(http.HandlerFunc(wsEventsHandler))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect two clients
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("client1 failed to connect: %v", err)
	}
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("client2 failed to connect: %v", err)
	}
	defer conn2.Close()

	// Emit an event
	go func() {
		time.Sleep(50 * time.Millisecond)
		events.Emit("info", "scene.completed", "", map[string]interface{}{"scene_id": "intro"})
	}()

	// Both should receive
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg1, err := conn1.ReadMessage()
	if err != nil {
		t.Fatalf("client1 failed to read: %v", err)
	}

	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg2, err := conn2.ReadMessage()
	if err != nil {
		t.Fatalf("client2 failed to read: %v", err)
	}

	var e1, e2 events.Event
	json.Unmarshal(msg1, &e1)
	json.Unmarshal(msg2, &e2)

	if e1.Name != "scene.completed" {
		t.Errorf("client1: expected 'scene.completed', got '%s'", e1.Name)
	}
	if e2.Name != "scene.completed" {
		t.Errorf("client2: expected 'scene.completed', got '%s'", e2.Name)
	}
}
