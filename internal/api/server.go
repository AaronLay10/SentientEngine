package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

// ReadinessState tracks the health of dependencies for the /ready endpoint.
type ReadinessState struct {
	mu                sync.RWMutex
	orchestratorReady bool
	mqttConnected     bool
	mqttOptional      bool
	postgresConnected bool
	postgresOptional  bool
}

var readiness = &ReadinessState{}

// SetOrchestratorReady marks the orchestrator as initialized.
func SetOrchestratorReady(ready bool) {
	readiness.mu.Lock()
	defer readiness.mu.Unlock()
	readiness.orchestratorReady = ready
}

// SetMQTTState sets MQTT connection state and whether it's optional.
func SetMQTTState(connected, optional bool) {
	readiness.mu.Lock()
	defer readiness.mu.Unlock()
	readiness.mqttConnected = connected
	readiness.mqttOptional = optional
}

// SetPostgresState sets Postgres connection state and whether it's optional.
func SetPostgresState(connected, optional bool) {
	readiness.mu.Lock()
	defer readiness.mu.Unlock()
	readiness.postgresConnected = connected
	readiness.postgresOptional = optional
}

// ReadinessResponse is returned by the /ready endpoint.
type ReadinessResponse struct {
	Ready       bool                      `json:"ready"`
	Checks      map[string]ReadinessCheck `json:"checks"`
	NotReadyMsg string                    `json:"message,omitempty"`
}

// ReadinessCheck represents a single dependency check.
type ReadinessCheck struct {
	Status   string `json:"status"` // "ok", "not_ready", "unavailable"
	Optional bool   `json:"optional,omitempty"`
}

// RuntimeController provides node validation, operator control, and game lifecycle.
type RuntimeController interface {
	HasNode(nodeID string) bool
	OverrideNode(nodeID string) error
	ResetNode(nodeID string) error
	ResetToNode(nodeID string) error
	StartGame(sceneID string) error
	StopGame() error
	IsGameActive() bool
}

var runtimeController RuntimeController

// SetRuntimeController sets the runtime used by operator endpoints.
func SetRuntimeController(rc RuntimeController) {
	runtimeController = rc
}

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Hostname  string `json:"hostname"`
	Timestamp string `json:"ts"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	host, _ := os.Hostname()
	resp := HealthResponse{
		Status:    "ok",
		Service:   "api",
		Hostname:  host,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	readiness.mu.RLock()
	orchestratorReady := readiness.orchestratorReady
	mqttConnected := readiness.mqttConnected
	mqttOptional := readiness.mqttOptional
	postgresConnected := readiness.postgresConnected
	postgresOptional := readiness.postgresOptional
	readiness.mu.RUnlock()

	checks := make(map[string]ReadinessCheck)
	var notReadyReasons []string

	// Orchestrator check
	if orchestratorReady {
		checks["orchestrator"] = ReadinessCheck{Status: "ok"}
	} else {
		checks["orchestrator"] = ReadinessCheck{Status: "not_ready"}
		notReadyReasons = append(notReadyReasons, "orchestrator not initialized")
	}

	// MQTT check
	if mqttConnected {
		checks["mqtt"] = ReadinessCheck{Status: "ok"}
	} else if mqttOptional {
		checks["mqtt"] = ReadinessCheck{Status: "unavailable", Optional: true}
	} else {
		checks["mqtt"] = ReadinessCheck{Status: "not_ready"}
		notReadyReasons = append(notReadyReasons, "mqtt not connected")
	}

	// Postgres check
	if postgresConnected {
		checks["postgres"] = ReadinessCheck{Status: "ok"}
	} else if postgresOptional {
		checks["postgres"] = ReadinessCheck{Status: "unavailable", Optional: true}
	} else {
		checks["postgres"] = ReadinessCheck{Status: "not_ready"}
		notReadyReasons = append(notReadyReasons, "postgres not connected")
	}

	// Overall readiness: orchestrator must be ready, plus any non-optional dependencies
	isReady := orchestratorReady &&
		(mqttConnected || mqttOptional) &&
		(postgresConnected || postgresOptional)

	resp := ReadinessResponse{
		Ready:  isReady,
		Checks: checks,
	}

	if !isReady && len(notReadyReasons) > 0 {
		resp.NotReadyMsg = notReadyReasons[0]
		if len(notReadyReasons) > 1 {
			for i := 1; i < len(notReadyReasons); i++ {
				resp.NotReadyMsg += "; " + notReadyReasons[i]
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if !isReady {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func eventsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events.Snapshot())
}

const maxEventsDBLimit = 1000

func eventsDBHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	client := events.GetPostgresClient()
	if client == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "postgres not available"})
		return
	}

	limit := 200
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err != nil || l <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid limit parameter"})
			return
		}
		limit = l
	}
	// Clamp to max
	if limit > maxEventsDBLimit {
		limit = maxEventsDBLimit
	}

	rows, err := client.Query(limit)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(rows)
}

type OperatorRequest struct {
	NodeID string `json:"node_id"`
}

type OperatorResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func operatorOverrideHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "method not allowed"})
		return
	}

	var req OperatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "invalid JSON"})
		return
	}

	if req.NodeID == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node_id required"})
		return
	}

	if runtimeController == nil || !runtimeController.HasNode(req.NodeID) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node not found"})
		return
	}

	// Emit operator event
	events.Emit("info", "operator.override", "", map[string]interface{}{
		"node_id": req.NodeID,
	})

	// Apply override to runtime
	if err := runtimeController.OverrideNode(req.NodeID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(OperatorResponse{OK: true})
}

func operatorResetHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "method not allowed"})
		return
	}

	var req OperatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "invalid JSON"})
		return
	}

	if req.NodeID == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node_id required"})
		return
	}

	if runtimeController == nil || !runtimeController.HasNode(req.NodeID) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node not found"})
		return
	}

	// Emit operator event
	events.Emit("info", "operator.reset", "", map[string]interface{}{
		"node_id": req.NodeID,
	})

	// Apply reset to runtime
	if err := runtimeController.ResetNode(req.NodeID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(OperatorResponse{OK: true})
}

func operatorResetNodeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "method not allowed"})
		return
	}

	var req OperatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "invalid JSON"})
		return
	}

	if req.NodeID == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node_id required"})
		return
	}

	if runtimeController == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "runtime not available"})
		return
	}

	if !runtimeController.IsGameActive() {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "no active session"})
		return
	}

	if !runtimeController.HasNode(req.NodeID) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node not found"})
		return
	}

	// Emit operator.reset event (registry-approved)
	events.Emit("info", "operator.reset", "", map[string]interface{}{
		"node_id": req.NodeID,
		"action":  "reset_to_node",
	})

	// Apply reset-to-node to runtime
	if err := runtimeController.ResetToNode(req.NodeID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(OperatorResponse{OK: true})
}

type GameStartRequest struct {
	SceneID string `json:"scene_id"`
}

type GameResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func gameStartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: "method not allowed"})
		return
	}

	if runtimeController == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: "runtime not available"})
		return
	}

	var req GameStartRequest
	// Allow empty body (optional scene_id)
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := runtimeController.StartGame(req.SceneID); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(GameResponse{OK: true})
}

func gameStopHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: "method not allowed"})
		return
	}

	if runtimeController == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: "runtime not available"})
		return
	}

	if err := runtimeController.StopGame(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(GameResponse{OK: false, Error: err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(GameResponse{OK: true})
}

// NewServer creates a configured HTTP server without starting it.
// Returns the server for graceful shutdown control.
func NewServer(port int) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ready", readyHandler)
	mux.HandleFunc("/events", eventsHandler)
	mux.HandleFunc("/events/db", eventsDBHandler)
	mux.HandleFunc("/operator/override", operatorOverrideHandler)
	mux.HandleFunc("/operator/reset", operatorResetHandler)
	mux.HandleFunc("/operator/reset-node", operatorResetNodeHandler)
	mux.HandleFunc("/game/start", gameStartHandler)
	mux.HandleFunc("/game/stop", gameStopHandler)
	mux.HandleFunc("/ws/events", wsEventsHandler)
	mux.HandleFunc("/ui", uiHandler)

	return &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}
}

// ListenAndServe starts the API server on the given port.
// It blocks until the server exits.
func ListenAndServe(port int) error {
	srv := NewServer(port)
	log.Printf("API listening on %s\n", srv.Addr)
	return srv.ListenAndServe()
}

// StartServer starts the API server in a goroutine and returns the server
// for graceful shutdown. Use Shutdown(ctx) to stop the server gracefully.
func StartServer(port int) *http.Server {
	srv := NewServer(port)
	go func() {
		log.Printf("API listening on %s\n", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("api server error: %v", err)
		}
	}()
	return srv
}

// Start starts the API server in a goroutine (legacy, no graceful shutdown).
// Errors are logged but do not stop the caller.
func Start(port int) {
	go func() {
		if err := ListenAndServe(port); err != nil && err != http.ErrServerClosed {
			log.Printf("api server error: %v", err)
		}
	}()
}

// Shutdown gracefully shuts down the server and closes all WebSocket connections.
func Shutdown(srv *http.Server, timeout time.Duration) error {
	// Close all WebSocket connections first
	events.CloseAllSubscribers()

	// Then shutdown HTTP server
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return srv.Shutdown(ctx)
}
