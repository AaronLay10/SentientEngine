package api

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/version"
)

// Metrics state
var (
	metricsState = &MetricsState{}
)

// MetricsState holds runtime metrics for the /metrics endpoint.
type MetricsState struct {
	mu                       sync.RWMutex
	startTime                time.Time
	roomName                 string
	backupLastSuccessTimeSec int64 // Unix timestamp, -1 if unknown
}

// InitMetrics initializes the metrics system. Must be called at startup.
func InitMetrics() {
	metricsState.mu.Lock()
	defer metricsState.mu.Unlock()
	metricsState.startTime = time.Now()
	metricsState.backupLastSuccessTimeSec = -1
}

// SetRoomName sets the room name for metrics labels.
func SetRoomName(name string) {
	metricsState.mu.Lock()
	defer metricsState.mu.Unlock()
	metricsState.roomName = name
}

// GetRoomName returns the current room name.
func GetRoomName() string {
	metricsState.mu.RLock()
	defer metricsState.mu.RUnlock()
	return metricsState.roomName
}

// SetBackupLastSuccess sets the timestamp of the last successful backup.
func SetBackupLastSuccess(ts time.Time) {
	metricsState.mu.Lock()
	defer metricsState.mu.Unlock()
	metricsState.backupLastSuccessTimeSec = ts.Unix()
}

// metricsHandler returns Prometheus-compatible metrics in text format.
func metricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Gather metrics
	metricsState.mu.RLock()
	startTime := metricsState.startTime
	roomName := metricsState.roomName
	backupLastSuccess := metricsState.backupLastSuccessTimeSec
	metricsState.mu.RUnlock()

	uptime := time.Since(startTime).Seconds()
	eventsTotal := events.TotalCount()

	readiness.mu.RLock()
	orchestratorReady := readiness.orchestratorReady
	mqttConnected := readiness.mqttConnected
	postgresConnected := readiness.postgresConnected
	readiness.mu.RUnlock()

	wsClients := events.SubscriberCount()

	// Determine room active (1 if orchestrator ready, 0 otherwise)
	roomActive := 0
	if orchestratorReady {
		roomActive = 1
	}

	mqttConnectedVal := 0
	if mqttConnected {
		mqttConnectedVal = 1
	}

	postgresConnectedVal := 0
	if postgresConnected {
		postgresConnectedVal = 1
	}

	// Get hostname for instance label
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}

	// Build Prometheus text format response
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	// Helper to write metric with optional labels
	writeMetric := func(name, mtype, help string, value interface{}, labels string) {
		fmt.Fprintf(w, "# HELP %s %s\n", name, help)
		fmt.Fprintf(w, "# TYPE %s %s\n", name, mtype)
		if labels != "" {
			fmt.Fprintf(w, "%s{%s} %v\n", name, labels, value)
		} else {
			fmt.Fprintf(w, "%s %v\n", name, value)
		}
	}

	// Common labels
	labels := fmt.Sprintf(`room="%s",instance="%s",version="%s"`, roomName, hostname, version.Version)

	// Uptime
	writeMetric("sentient_uptime_seconds", "gauge",
		"Number of seconds since the room container started", uptime, labels)

	// Room active
	writeMetric("sentient_rooms_active", "gauge",
		"Whether the room is active (1) or not (0)", roomActive, labels)

	// Events total
	writeMetric("sentient_events_total", "counter",
		"Total number of events emitted since startup", eventsTotal, labels)

	// MQTT connected
	writeMetric("sentient_mqtt_connected", "gauge",
		"Whether MQTT broker is connected (1) or not (0)", mqttConnectedVal, labels)

	// Postgres connected
	writeMetric("sentient_postgres_connected", "gauge",
		"Whether PostgreSQL is connected (1) or not (0)", postgresConnectedVal, labels)

	// WebSocket clients
	writeMetric("sentient_ws_clients", "gauge",
		"Number of active WebSocket client connections", wsClients, labels)

	// Backup last success timestamp
	writeMetric("sentient_backup_last_success_timestamp", "gauge",
		"Unix timestamp of last successful backup (-1 if unknown)", backupLastSuccess, labels)
}
