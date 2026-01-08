package api

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// Alert severity levels
const (
	SeverityCritical = "critical"
	SeverityWarning  = "warning"
	SeverityInfo     = "info"
)

// Alert event types
const (
	AlertMQTTDisconnected    = "mqtt_disconnected"
	AlertPostgresUnavailable = "postgres_unavailable"
	AlertContainerRestart    = "container_restart"
)

// AlertPayload is the JSON structure sent to the webhook.
type AlertPayload struct {
	RoomName  string                 `json:"room_name"`
	Event     string                 `json:"event"`
	Timestamp string                 `json:"timestamp"`
	Severity  string                 `json:"severity"`
	Message   string                 `json:"message,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// AlertConfig holds alert configuration.
type AlertConfig struct {
	WebhookURL              string
	MQTTDisconnectDelay     time.Duration // How long MQTT must be disconnected before alerting
	PostgresDisconnectDelay time.Duration // How long Postgres must be disconnected before alerting
}

var (
	alertConfig = &AlertConfig{
		MQTTDisconnectDelay:     30 * time.Second,
		PostgresDisconnectDelay: 5 * time.Second,
	}
	alertMu sync.Mutex

	// Track connection state for alerting
	mqttDisconnectedSince   time.Time
	mqttAlertSent           bool
	postgresDisconnectedAt  time.Time
	postgresAlertSent       bool
	lastKnownMQTTState      bool
	lastKnownPostgresState  bool
	alertMonitorInitialized bool
)

// InitAlerts initializes the alert system from environment variables.
func InitAlerts() {
	alertMu.Lock()
	defer alertMu.Unlock()

	alertConfig.WebhookURL = os.Getenv("SENTIENT_ALERT_WEBHOOK_URL")

	// Optional: custom MQTT disconnect delay
	if delayStr := os.Getenv("SENTIENT_MQTT_ALERT_DELAY"); delayStr != "" {
		if d, err := time.ParseDuration(delayStr); err == nil {
			alertConfig.MQTTDisconnectDelay = d
		}
	}

	// Optional: custom Postgres disconnect delay
	if delayStr := os.Getenv("SENTIENT_POSTGRES_ALERT_DELAY"); delayStr != "" {
		if d, err := time.ParseDuration(delayStr); err == nil {
			alertConfig.PostgresDisconnectDelay = d
		}
	}

	if alertConfig.WebhookURL != "" {
		log.Printf("Alerts enabled: webhook URL configured (mqtt_delay=%s, pg_delay=%s)",
			alertConfig.MQTTDisconnectDelay, alertConfig.PostgresDisconnectDelay)
	}

	// Initialize state tracking
	lastKnownMQTTState = true      // Assume connected at start
	lastKnownPostgresState = true  // Assume connected at start
	alertMonitorInitialized = true
}

// GetAlertWebhookURL returns the configured webhook URL (for testing).
func GetAlertWebhookURL() string {
	alertMu.Lock()
	defer alertMu.Unlock()
	return alertConfig.WebhookURL
}

// SendAlert sends an alert to the configured webhook (best-effort, non-blocking).
func SendAlert(event, severity, message string, details map[string]interface{}) {
	alertMu.Lock()
	webhookURL := alertConfig.WebhookURL
	alertMu.Unlock()

	if webhookURL == "" {
		// No webhook configured, log instead
		log.Printf("[ALERT] %s severity=%s msg=%q details=%v", event, severity, message, details)
		return
	}

	roomName := GetRoomName()
	if roomName == "" {
		roomName = "unknown"
	}

	payload := AlertPayload{
		RoomName:  roomName,
		Event:     event,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Severity:  severity,
		Message:   message,
		Details:   details,
	}

	// Send asynchronously to avoid blocking
	go sendWebhook(webhookURL, payload)
}

// sendWebhook performs the actual HTTP POST (runs in goroutine).
func sendWebhook(url string, payload AlertPayload) {
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("alert: failed to marshal payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("alert: webhook POST failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("alert: webhook returned status %d", resp.StatusCode)
	}
}

// CheckAndAlertMQTT checks MQTT state and sends alert if disconnected too long.
// Should be called periodically or on state change.
func CheckAndAlertMQTT(connected bool) {
	alertMu.Lock()
	defer alertMu.Unlock()

	if !alertMonitorInitialized {
		return
	}

	now := time.Now()

	if connected {
		// Reset disconnect tracking
		if !lastKnownMQTTState && mqttAlertSent {
			// Was disconnected and alerted, now recovered - send recovery alert
			go SendAlert(AlertMQTTDisconnected, SeverityInfo, "MQTT connection restored", map[string]interface{}{
				"recovered_at": now.UTC().Format(time.RFC3339),
			})
		}
		mqttDisconnectedSince = time.Time{}
		mqttAlertSent = false
		lastKnownMQTTState = true
		return
	}

	// Not connected
	if lastKnownMQTTState {
		// Just became disconnected
		mqttDisconnectedSince = now
	}
	lastKnownMQTTState = false

	// Check if disconnected long enough to alert
	if !mqttAlertSent && !mqttDisconnectedSince.IsZero() {
		disconnectedDuration := now.Sub(mqttDisconnectedSince)
		if disconnectedDuration >= alertConfig.MQTTDisconnectDelay {
			mqttAlertSent = true
			go SendAlert(AlertMQTTDisconnected, SeverityWarning,
				"MQTT broker disconnected",
				map[string]interface{}{
					"disconnected_since":   mqttDisconnectedSince.UTC().Format(time.RFC3339),
					"disconnected_seconds": int(disconnectedDuration.Seconds()),
				})
		}
	}
}

// CheckAndAlertPostgres checks Postgres state and sends alert if unavailable.
func CheckAndAlertPostgres(connected bool) {
	alertMu.Lock()
	defer alertMu.Unlock()

	if !alertMonitorInitialized {
		return
	}

	now := time.Now()

	if connected {
		// Reset tracking
		if !lastKnownPostgresState && postgresAlertSent {
			// Was disconnected and alerted, now recovered
			go SendAlert(AlertPostgresUnavailable, SeverityInfo, "PostgreSQL connection restored", map[string]interface{}{
				"recovered_at": now.UTC().Format(time.RFC3339),
			})
		}
		postgresDisconnectedAt = time.Time{}
		postgresAlertSent = false
		lastKnownPostgresState = true
		return
	}

	// Not connected
	if lastKnownPostgresState {
		// Just became disconnected
		postgresDisconnectedAt = now
	}
	lastKnownPostgresState = false

	// Check if disconnected long enough to alert
	if !postgresAlertSent && !postgresDisconnectedAt.IsZero() {
		disconnectedDuration := now.Sub(postgresDisconnectedAt)
		if disconnectedDuration >= alertConfig.PostgresDisconnectDelay {
			postgresAlertSent = true
			go SendAlert(AlertPostgresUnavailable, SeverityCritical,
				"PostgreSQL unavailable",
				map[string]interface{}{
					"disconnected_since":   postgresDisconnectedAt.UTC().Format(time.RFC3339),
					"disconnected_seconds": int(disconnectedDuration.Seconds()),
				})
		}
	}
}

// StartAlertMonitor starts a background goroutine that periodically checks connection states.
func StartAlertMonitor(checkInterval time.Duration) {
	go func() {
		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for range ticker.C {
			// Read current state
			readiness.mu.RLock()
			mqttConnected := readiness.mqttConnected
			postgresConnected := readiness.postgresConnected
			readiness.mu.RUnlock()

			// Check and alert
			CheckAndAlertMQTT(mqttConnected)
			CheckAndAlertPostgres(postgresConnected)
		}
	}()
}
