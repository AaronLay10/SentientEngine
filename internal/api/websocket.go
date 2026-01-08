package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/gorilla/websocket"
)

const (
	// Number of recent events to send on connection
	recentEventsCount = 50

	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = 54 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for now (no auth requirement)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// wsEventsHandler handles WebSocket connections for live event streaming.
func wsEventsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade failed: %v", err)
		return
	}

	// Subscribe to events
	sub := events.Subscribe()

	// Send recent events immediately
	recent := events.RecentEvents(recentEventsCount)
	for _, e := range recent {
		data, err := json.Marshal(e)
		if err != nil {
			continue
		}
		conn.SetWriteDeadline(time.Now().Add(writeWait))
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("ws write recent event failed: %v", err)
			events.Unsubscribe(sub)
			conn.Close()
			return
		}
	}

	// Start goroutines for reading and writing
	done := make(chan struct{})

	// Reader goroutine - handles pongs and close messages
	go func() {
		defer close(done)
		conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Writer goroutine - sends events and pings
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			// Reader detected close
			events.Unsubscribe(sub)
			conn.Close()
			return

		case e, ok := <-sub:
			if !ok {
				// Subscriber channel closed
				conn.Close()
				return
			}
			data, err := json.Marshal(e)
			if err != nil {
				continue
			}
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("ws write event failed: %v", err)
				events.Unsubscribe(sub)
				conn.Close()
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				events.Unsubscribe(sub)
				conn.Close()
				return
			}
		}
	}
}
