package events

import (
	"encoding/json"
	"fmt"
	"time"
)

var buffer = NewRingBuffer(256)

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

	e := Event{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Level:     level,
		Name:      name,
		Message:   msg,
		Fields:    fields,
	}

	buffer.Add(e)

	b, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event: %w", err)
	}

	return b, nil
}

func Snapshot() []Event {
	return buffer.Snapshot()
}
