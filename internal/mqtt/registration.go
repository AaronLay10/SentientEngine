package mqtt

import (
	"encoding/json"
	"fmt"
)

// RegistrationPayload represents a v1 controller registration message.
type RegistrationPayload struct {
	Version    int                  `json:"version"`
	Controller ControllerInfo       `json:"controller"`
	Devices    []DeviceRegistration `json:"devices"`
}

// ControllerInfo contains controller metadata.
type ControllerInfo struct {
	ID           string `json:"id"`
	Type         string `json:"type"`
	Firmware     string `json:"firmware"`
	UptimeMS     int64  `json:"uptime_ms"`
	HeartbeatSec int    `json:"heartbeat_sec"`
}

// DeviceRegistration describes a single device provided by the controller.
type DeviceRegistration struct {
	LogicalID    string           `json:"logical_id"`
	Type         string           `json:"type"`
	Capabilities []string         `json:"capabilities"`
	Signals      DeviceSignals    `json:"signals"`
	Topics       DeviceTopics     `json:"topics"`
}

// DeviceSignals defines input/output signals for a device.
type DeviceSignals struct {
	Inputs  []string `json:"inputs"`
	Outputs []string `json:"outputs"`
}

// DeviceTopics defines MQTT topics for device communication.
type DeviceTopics struct {
	Publish   string `json:"publish"`
	Subscribe string `json:"subscribe"`
}

// ParseRegistration parses a registration payload from JSON bytes.
func ParseRegistration(data []byte) (*RegistrationPayload, error) {
	var payload RegistrationPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid registration JSON: %w", err)
	}

	if payload.Version != 1 {
		return nil, fmt.Errorf("unsupported registration version: %d", payload.Version)
	}

	if payload.Controller.ID == "" {
		return nil, fmt.Errorf("controller.id is required")
	}

	return &payload, nil
}

// DeviceSpec defines expected device from devices.yaml.
type DeviceSpec struct {
	Type         string
	Required     bool
	Capabilities []string
}

// ValidationResult contains validation outcome.
type ValidationResult struct {
	Valid    bool
	Errors   []string
	Warnings []string
}

// ValidateRegistration validates a registration payload against device specs.
func ValidateRegistration(payload *RegistrationPayload, specs map[string]DeviceSpec) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Build map of registered devices
	registered := make(map[string]*DeviceRegistration)
	for i := range payload.Devices {
		dev := &payload.Devices[i]
		if dev.LogicalID == "" {
			result.Errors = append(result.Errors, "device with empty logical_id")
			result.Valid = false
			continue
		}
		registered[dev.LogicalID] = dev
	}

	// Check each spec against registration
	for logicalID, spec := range specs {
		reg, found := registered[logicalID]
		if !found {
			if spec.Required {
				result.Errors = append(result.Errors, fmt.Sprintf("required device missing: %s", logicalID))
				result.Valid = false
			}
			continue
		}

		// Validate type matches
		if reg.Type != spec.Type {
			result.Errors = append(result.Errors, fmt.Sprintf("device %s: type mismatch (expected %s, got %s)", logicalID, spec.Type, reg.Type))
			result.Valid = false
		}

		// Validate capabilities
		for _, reqCap := range spec.Capabilities {
			if !containsString(reg.Capabilities, reqCap) {
				result.Errors = append(result.Errors, fmt.Sprintf("device %s: missing capability %s", logicalID, reqCap))
				result.Valid = false
			}
		}
	}

	// Warn about unrecognized devices
	for logicalID := range registered {
		if _, ok := specs[logicalID]; !ok {
			result.Warnings = append(result.Warnings, fmt.Sprintf("unrecognized device: %s", logicalID))
		}
	}

	return result
}

func containsString(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

// DeviceSpecFromConfig converts a device definition to a DeviceSpec.
func DeviceSpecFromConfig(devType string, required bool, capabilities []string) DeviceSpec {
	return DeviceSpec{
		Type:         devType,
		Required:     required,
		Capabilities: capabilities,
	}
}
