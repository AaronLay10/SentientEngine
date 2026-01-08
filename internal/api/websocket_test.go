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

func TestWebSocketReceivesRecentEvents(t *testing.T) {
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
	events.Clear()

	server := httptest.NewServer(http.HandlerFunc(wsEventsHandler))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	initialCount := events.SubscriberCount()

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}

	// Wait for subscription to be registered
	time.Sleep(50 * time.Millisecond)

	afterConnect := events.SubscriberCount()
	if afterConnect != initialCount+1 {
		t.Errorf("expected subscriber count %d after connect, got %d", initialCount+1, afterConnect)
	}

	// Close connection
	conn.Close()

	// Wait for cleanup
	time.Sleep(100 * time.Millisecond)

	// Emit an event to trigger the subscriber goroutine to notice the close
	events.Emit("info", "node.started", "", nil)
	time.Sleep(100 * time.Millisecond)

	afterClose := events.SubscriberCount()
	if afterClose != initialCount {
		t.Errorf("expected subscriber count %d after close, got %d", initialCount, afterClose)
	}
}

func TestWebSocketMultipleClients(t *testing.T) {
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
