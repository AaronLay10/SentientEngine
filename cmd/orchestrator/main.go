package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

type LogLine struct {
	Timestamp string                 `json:"ts"`
	Level     string                 `json:"level"`
	Event     string                 `json:"event"`
	Message   string                 `json:"msg,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

func logEvent(level, event, msg string, fields map[string]interface{}) {
	line := LogLine{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Level:     level,
		Event:     event,
		Message:   msg,
		Fields:    fields,
	}
	b, _ := json.Marshal(line)
	fmt.Println(string(b))
}

func main() {
	hostname, _ := os.Hostname()
	logEvent("info", "system.startup", "orchestrator starting", map[string]interface{}{
		"service":  "orchestrator",
		"hostname": hostname,
		"pid":      os.Getpid(),
	})
}
