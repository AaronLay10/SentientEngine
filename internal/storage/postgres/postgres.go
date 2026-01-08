package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// EventRow represents an event stored in Postgres.
type EventRow struct {
	EventID   int64                  `json:"event_id"`
	Timestamp time.Time              `json:"ts"`
	Level     string                 `json:"level"`
	Event     string                 `json:"event"`
	Message   *string                `json:"msg,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	RoomID    string                 `json:"room_id"`
	SessionID *string                `json:"session_id,omitempty"`
}

// Client manages the Postgres connection for event storage.
type Client struct {
	db     *sql.DB
	roomID string

	mu          sync.Mutex
	errorLogged bool
}

// New creates a new Postgres client using environment variables.
// Returns nil if connection fails (caller should handle gracefully).
func New(roomID string) (*Client, error) {
	host := getEnv("PGHOST", "127.0.0.1")
	port := getEnv("PGPORT", "5432")
	user := getEnv("PGUSER", "sentient")
	dbname := getEnv("PGDATABASE", "sentient")
	password := os.Getenv("PGPASSWORD")

	var connStr string
	if password != "" {
		connStr = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			host, port, user, password, dbname)
	} else {
		connStr = fmt.Sprintf("host=%s port=%s user=%s dbname=%s sslmode=disable",
			host, port, user, dbname)
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	client := &Client{
		db:     db,
		roomID: roomID,
	}

	// Create table if not exists
	if err := client.createTable(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create events table: %w", err)
	}

	return client, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func (c *Client) createTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS events (
			event_id   BIGSERIAL PRIMARY KEY,
			ts         TIMESTAMPTZ NOT NULL,
			level      TEXT NOT NULL,
			event      TEXT NOT NULL,
			msg        TEXT,
			fields     JSONB,
			room_id    TEXT NOT NULL,
			session_id TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
		CREATE INDEX IF NOT EXISTS idx_events_room_id ON events(room_id);
	`
	_, err := c.db.Exec(query)
	return err
}

// Append inserts an event into the database.
// Returns error if insert fails.
func (c *Client) Append(ts time.Time, level, event, msg string, fields map[string]interface{}, sessionID string) error {
	var fieldsJSON []byte
	var err error
	if fields != nil {
		fieldsJSON, err = json.Marshal(fields)
		if err != nil {
			return fmt.Errorf("failed to marshal fields: %w", err)
		}
	}

	var msgPtr *string
	if msg != "" {
		msgPtr = &msg
	}

	var sessionPtr *string
	if sessionID != "" {
		sessionPtr = &sessionID
	}

	query := `
		INSERT INTO events (ts, level, event, msg, fields, room_id, session_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = c.db.Exec(query, ts, level, event, msgPtr, fieldsJSON, c.roomID, sessionPtr)
	return err
}

// Query returns the last N events from the database in descending order by timestamp.
func (c *Client) Query(limit int) ([]EventRow, error) {
	if limit <= 0 {
		limit = 200
	}
	if limit > 10000 {
		limit = 10000
	}

	query := `
		SELECT event_id, ts, level, event, msg, fields, room_id, session_id
		FROM events
		WHERE room_id = $1
		ORDER BY ts DESC
		LIMIT $2
	`
	rows, err := c.db.Query(query, c.roomID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []EventRow
	for rows.Next() {
		var e EventRow
		var fieldsJSON []byte
		var msg, sessionID sql.NullString

		if err := rows.Scan(&e.EventID, &e.Timestamp, &e.Level, &e.Event, &msg, &fieldsJSON, &e.RoomID, &sessionID); err != nil {
			return nil, err
		}

		if msg.Valid {
			e.Message = &msg.String
		}
		if sessionID.Valid {
			e.SessionID = &sessionID.String
		}
		if len(fieldsJSON) > 0 {
			if err := json.Unmarshal(fieldsJSON, &e.Fields); err != nil {
				return nil, fmt.Errorf("failed to unmarshal fields: %w", err)
			}
		}

		events = append(events, e)
	}

	return events, rows.Err()
}

// Close closes the database connection.
func (c *Client) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

// MarkErrorLogged marks that an error has been logged (to avoid spam).
func (c *Client) MarkErrorLogged() {
	c.mu.Lock()
	c.errorLogged = true
	c.mu.Unlock()
}

// HasLoggedError returns true if an error has been logged.
func (c *Client) HasLoggedError() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.errorLogged
}
