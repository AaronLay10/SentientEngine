package mqtt

import (
	"sync"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

// ControllerState tracks a registered controller's health.
type ControllerState struct {
	ControllerID string
	LastSeen     time.Time
	HeartbeatSec int
	Devices      []string // logical IDs
	Connected    bool
}

// Monitor tracks controller registration and health.
type Monitor struct {
	mu          sync.RWMutex
	controllers map[string]*ControllerState
	specs       map[string]DeviceSpec
	tolerance   float64 // multiplier for heartbeat interval (e.g., 2.0 = 2x heartbeat)
	stopCh      chan struct{}
	wg          sync.WaitGroup
}

// NewMonitor creates a new controller monitor.
// tolerance is the multiplier for heartbeat interval before considering disconnected.
func NewMonitor(specs map[string]DeviceSpec, tolerance float64) *Monitor {
	if tolerance <= 1.0 {
		tolerance = 2.0 // default: miss 1 heartbeat
	}
	return &Monitor{
		controllers: make(map[string]*ControllerState),
		specs:       specs,
		tolerance:   tolerance,
		stopCh:      make(chan struct{}),
	}
}

// HandleRegistration processes a registration payload.
// Returns validation result and emits appropriate events.
func (m *Monitor) HandleRegistration(payload *RegistrationPayload) *ValidationResult {
	result := ValidateRegistration(payload, m.specs)

	m.mu.Lock()
	defer m.mu.Unlock()

	ctrlID := payload.Controller.ID
	now := time.Now()

	// Collect device logical IDs
	var deviceIDs []string
	for _, dev := range payload.Devices {
		deviceIDs = append(deviceIDs, dev.LogicalID)
	}

	existing, wasConnected := m.controllers[ctrlID]
	isReconnect := wasConnected && existing != nil && !existing.Connected

	if result.Valid {
		m.controllers[ctrlID] = &ControllerState{
			ControllerID: ctrlID,
			LastSeen:     now,
			HeartbeatSec: payload.Controller.HeartbeatSec,
			Devices:      deviceIDs,
			Connected:    true,
		}

		// Emit device.connected for each device
		for _, dev := range payload.Devices {
			events.Emit("info", "device.connected", "", map[string]interface{}{
				"controller_id": ctrlID,
				"logical_id":    dev.LogicalID,
				"type":          dev.Type,
				"reconnect":     isReconnect,
			})
		}
	} else {
		// Emit device.error for validation failure
		events.Emit("error", "device.error", "registration validation failed", map[string]interface{}{
			"controller_id": ctrlID,
			"errors":        result.Errors,
		})
	}

	return result
}

// Start begins the background health check loop.
func (m *Monitor) Start(checkInterval time.Duration) {
	m.wg.Add(1)
	go m.healthCheckLoop(checkInterval)
}

// Stop stops the background health check loop.
func (m *Monitor) Stop() {
	close(m.stopCh)
	m.wg.Wait()
}

func (m *Monitor) healthCheckLoop(interval time.Duration) {
	defer m.wg.Done()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopCh:
			return
		case <-ticker.C:
			m.checkHealth()
		}
	}
}

func (m *Monitor) checkHealth() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()

	for ctrlID, state := range m.controllers {
		if !state.Connected {
			continue
		}

		// Calculate timeout: heartbeat * tolerance
		timeout := time.Duration(float64(state.HeartbeatSec)*m.tolerance) * time.Second
		if now.Sub(state.LastSeen) > timeout {
			state.Connected = false

			// Emit device.disconnected for each device
			for _, logicalID := range state.Devices {
				events.Emit("warning", "device.disconnected", "heartbeat timeout", map[string]interface{}{
					"controller_id":  ctrlID,
					"logical_id":     logicalID,
					"last_seen":      state.LastSeen.Format(time.RFC3339),
					"timeout_sec":    timeout.Seconds(),
				})
			}
		}
	}
}

// GetControllerState returns the state of a controller (for testing/inspection).
func (m *Monitor) GetControllerState(controllerID string) *ControllerState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if state, ok := m.controllers[controllerID]; ok {
		// Return a copy
		cpy := *state
		cpy.Devices = append([]string{}, state.Devices...)
		return &cpy
	}
	return nil
}

// ConnectedControllers returns a list of currently connected controller IDs.
func (m *Monitor) ConnectedControllers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var ids []string
	for id, state := range m.controllers {
		if state.Connected {
			ids = append(ids, id)
		}
	}
	return ids
}
