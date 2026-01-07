package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

// NodeValidator checks if a node exists in the active scene.
type NodeValidator interface {
	HasNode(nodeID string) bool
}

var nodeValidator NodeValidator

// SetNodeValidator sets the validator used by operator endpoints.
func SetNodeValidator(v NodeValidator) {
	nodeValidator = v
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

func eventsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events.Snapshot())
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

	if nodeValidator == nil || !nodeValidator.HasNode(req.NodeID) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node not found"})
		return
	}

	events.Emit("info", "operator.override", "", map[string]interface{}{
		"node_id": req.NodeID,
	})

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

	if nodeValidator == nil || !nodeValidator.HasNode(req.NodeID) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(OperatorResponse{OK: false, Error: "node not found"})
		return
	}

	events.Emit("info", "operator.reset", "", map[string]interface{}{
		"node_id": req.NodeID,
	})

	_ = json.NewEncoder(w).Encode(OperatorResponse{OK: true})
}

// ListenAndServe starts the API server on the given port.
// It blocks until the server exits.
func ListenAndServe(port int) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/events", eventsHandler)
	mux.HandleFunc("/operator/override", operatorOverrideHandler)
	mux.HandleFunc("/operator/reset", operatorResetHandler)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("API listening on %s\n", addr)
	return http.ListenAndServe(addr, mux)
}

// Start starts the API server in a goroutine.
// Errors are logged but do not stop the caller.
func Start(port int) {
	go func() {
		if err := ListenAndServe(port); err != nil {
			log.Printf("api server error: %v", err)
		}
	}()
}
