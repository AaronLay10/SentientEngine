package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// clearTLSEnvServer prevents TLS initialization from trying to load nonexistent certs.
func clearTLSEnvServer(t *testing.T) {
	t.Setenv("SENTIENT_TLS_CERT", "")
	t.Setenv("SENTIENT_TLS_KEY", "")
	t.Setenv("SENTIENT_TLS_CERT_FILE", "")
	t.Setenv("SENTIENT_TLS_KEY_FILE", "")
}

func TestHealthEndpoint(t *testing.T) {
	clearTLSEnvServer(t)
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	healthHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Status != "ok" {
		t.Errorf("expected status 'ok', got '%s'", resp.Status)
	}
}

func TestReadyEndpoint_AllReady(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state
	readiness.mu.Lock()
	readiness.orchestratorReady = true
	readiness.mqttConnected = true
	readiness.mqttOptional = false
	readiness.postgresConnected = true
	readiness.postgresOptional = false
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Ready {
		t.Error("expected ready=true")
	}
	if resp.Checks["orchestrator"].Status != "ok" {
		t.Errorf("expected orchestrator status 'ok', got '%s'", resp.Checks["orchestrator"].Status)
	}
	if resp.Checks["mqtt"].Status != "ok" {
		t.Errorf("expected mqtt status 'ok', got '%s'", resp.Checks["mqtt"].Status)
	}
	if resp.Checks["postgres"].Status != "ok" {
		t.Errorf("expected postgres status 'ok', got '%s'", resp.Checks["postgres"].Status)
	}
}

func TestReadyEndpoint_OrchestratorNotReady(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state
	readiness.mu.Lock()
	readiness.orchestratorReady = false
	readiness.mqttConnected = true
	readiness.mqttOptional = false
	readiness.postgresConnected = true
	readiness.postgresOptional = false
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Ready {
		t.Error("expected ready=false")
	}
	if resp.Checks["orchestrator"].Status != "not_ready" {
		t.Errorf("expected orchestrator status 'not_ready', got '%s'", resp.Checks["orchestrator"].Status)
	}
	if resp.NotReadyMsg == "" {
		t.Error("expected non-empty message")
	}
}

func TestReadyEndpoint_OptionalMQTTUnavailable(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state - MQTT unavailable but marked as optional
	readiness.mu.Lock()
	readiness.orchestratorReady = true
	readiness.mqttConnected = false
	readiness.mqttOptional = true
	readiness.postgresConnected = true
	readiness.postgresOptional = false
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 (optional dependency), got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Ready {
		t.Error("expected ready=true with optional MQTT unavailable")
	}
	if resp.Checks["mqtt"].Status != "unavailable" {
		t.Errorf("expected mqtt status 'unavailable', got '%s'", resp.Checks["mqtt"].Status)
	}
	if !resp.Checks["mqtt"].Optional {
		t.Error("expected mqtt optional=true")
	}
}

func TestReadyEndpoint_RequiredMQTTNotConnected(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state - MQTT not connected and NOT optional
	readiness.mu.Lock()
	readiness.orchestratorReady = true
	readiness.mqttConnected = false
	readiness.mqttOptional = false
	readiness.postgresConnected = true
	readiness.postgresOptional = false
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Ready {
		t.Error("expected ready=false")
	}
	if resp.Checks["mqtt"].Status != "not_ready" {
		t.Errorf("expected mqtt status 'not_ready', got '%s'", resp.Checks["mqtt"].Status)
	}
}

func TestReadyEndpoint_OptionalPostgresUnavailable(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state - Postgres unavailable but marked as optional
	readiness.mu.Lock()
	readiness.orchestratorReady = true
	readiness.mqttConnected = true
	readiness.mqttOptional = false
	readiness.postgresConnected = false
	readiness.postgresOptional = true
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 (optional dependency), got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Ready {
		t.Error("expected ready=true with optional Postgres unavailable")
	}
	if resp.Checks["postgres"].Status != "unavailable" {
		t.Errorf("expected postgres status 'unavailable', got '%s'", resp.Checks["postgres"].Status)
	}
	if !resp.Checks["postgres"].Optional {
		t.Error("expected postgres optional=true")
	}
}

func TestReadyEndpoint_MultipleDependenciesNotReady(t *testing.T) {
	clearTLSEnvServer(t)
	// Reset state - multiple issues
	readiness.mu.Lock()
	readiness.orchestratorReady = false
	readiness.mqttConnected = false
	readiness.mqttOptional = false
	readiness.postgresConnected = true
	readiness.postgresOptional = false
	readiness.mu.Unlock()

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()

	readyHandler(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", w.Code)
	}

	var resp ReadinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Ready {
		t.Error("expected ready=false")
	}
	// Should contain both reasons
	if resp.NotReadyMsg == "" {
		t.Error("expected non-empty message with multiple reasons")
	}
}

func TestSetReadinessState(t *testing.T) {
	clearTLSEnvServer(t)
	// Test SetOrchestratorReady
	SetOrchestratorReady(true)
	readiness.mu.RLock()
	if !readiness.orchestratorReady {
		t.Error("SetOrchestratorReady(true) didn't set state")
	}
	readiness.mu.RUnlock()

	SetOrchestratorReady(false)
	readiness.mu.RLock()
	if readiness.orchestratorReady {
		t.Error("SetOrchestratorReady(false) didn't clear state")
	}
	readiness.mu.RUnlock()

	// Test SetMQTTState
	SetMQTTState(true, false)
	readiness.mu.RLock()
	if !readiness.mqttConnected || readiness.mqttOptional {
		t.Error("SetMQTTState(true, false) didn't set state correctly")
	}
	readiness.mu.RUnlock()

	SetMQTTState(false, true)
	readiness.mu.RLock()
	if readiness.mqttConnected || !readiness.mqttOptional {
		t.Error("SetMQTTState(false, true) didn't set state correctly")
	}
	readiness.mu.RUnlock()

	// Test SetPostgresState
	SetPostgresState(true, false)
	readiness.mu.RLock()
	if !readiness.postgresConnected || readiness.postgresOptional {
		t.Error("SetPostgresState(true, false) didn't set state correctly")
	}
	readiness.mu.RUnlock()

	SetPostgresState(false, true)
	readiness.mu.RLock()
	if readiness.postgresConnected || !readiness.postgresOptional {
		t.Error("SetPostgresState(false, true) didn't set state correctly")
	}
	readiness.mu.RUnlock()
}
