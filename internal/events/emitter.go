package events

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/storage/postgres"
)

var buffer = NewRingBuffer(256)

var (
	pgClient      *postgres.Client
	pgMu          sync.RWMutex
	pgErrorLogged bool
)

// SetPostgresClient sets the Postgres client for event persistence.
func SetPostgresClient(client *postgres.Client) {
	pgMu.Lock()
	pgClient = client
	pgMu.Unlock()
}

// GetPostgresClient returns the current Postgres client (for API queries).
func GetPostgresClient() *postgres.Client {
	pgMu.RLock()
	defer pgMu.RUnlock()
	return pgClient
}

type Event struct {
	Timestamp string                 `json:"ts"`
	Level     string                 `json:"level"`
	Name      string                 `json:"event"`
	Message   string                 `json:"msg,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

func Emit(level, name, msg string, fields map[string]interface{}) ([]byte, error) {
	if err := Validate(name); err != nil {
		return nil, err
	}

	ts := time.Now().UTC()
	e := Event{
		Timestamp: ts.Format(time.RFC3339Nano),
		Level:     level,
		Name:      name,
		Message:   msg,
		Fields:    fields,
	}

	buffer.Add(e)

	// Persist to Postgres (non-blocking, error-resistant)
	pgMu.RLock()
	client := pgClient
	errorLogged := pgErrorLogged
	pgMu.RUnlock()

	if client != nil {
		if err := client.Append(ts, level, name, msg, fields, ""); err != nil {
			// Log error once to avoid spam.
			// IMPORTANT: We add directly to buffer.Add() here, NOT Emit(),
			// to avoid infinite recursion if Postgres keeps failing.
			if !errorLogged {
				pgMu.Lock()
				if !pgErrorLogged {
					pgErrorLogged = true
					pgMu.Unlock()
					// Add system.error directly to ring buffer (bypasses DB append)
					errEvent := Event{
						Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
						Level:     "error",
						Name:      "system.error",
						Message:   "postgres append failed",
						Fields: map[string]interface{}{
							"error": err.Error(),
						},
					}
					buffer.Add(errEvent) // Direct add, no recursion
				} else {
					pgMu.Unlock()
				}
			}
		}
	}

	b, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event: %w", err)
	}

	return b, nil
}

func Snapshot() []Event {
	return buffer.Snapshot()
}

// Clear resets the event buffer. Used for testing.
func Clear() {
	buffer.Clear()
}
