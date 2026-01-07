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

// ListenAndServe starts the API server on the given port.
// It blocks until the server exits.
func ListenAndServe(port int) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/events", eventsHandler)

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
