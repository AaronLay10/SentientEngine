package mqtt

import (
	"testing"

	"github.com/AaronLay10/SentientEngine/internal/config"
)

func TestParseRegistration(t *testing.T) {
	tests := []struct {
		name    string
		json    string
		wantErr bool
	}{
		{
			name: "valid v1 registration",
			json: `{
				"version": 1,
				"controller": {
					"id": "ctrl-001",
					"type": "teensy",
					"firmware": "1.2.0",
					"uptime_ms": 123456,
					"heartbeat_sec": 5
				},
				"devices": [
					{
						"logical_id": "crypt_door",
						"type": "door",
						"capabilities": ["open", "close"],
						"signals": {
							"inputs": ["door_closed"],
							"outputs": ["unlock"]
						},
						"topics": {
							"publish": "devices/ctrl-001/crypt_door/events",
							"subscribe": "devices/ctrl-001/crypt_door/commands"
						}
					}
				]
			}`,
			wantErr: false,
		},
		{
			name: "unsupported version",
			json: `{
				"version": 2,
				"controller": {"id": "ctrl-001"}
			}`,
			wantErr: true,
		},
		{
			name: "missing controller id",
			json: `{
				"version": 1,
				"controller": {"type": "teensy"}
			}`,
			wantErr: true,
		},
		{
			name:    "invalid json",
			json:    `{invalid}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := ParseRegistration([]byte(tt.json))
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if payload == nil {
				t.Errorf("expected payload, got nil")
			}
		})
	}
}

func TestValidateRegistration(t *testing.T) {
	specs := map[string]DeviceSpec{
		"example_device": {
			Type:         "sensor",
			Required:     false,
			Capabilities: []string{"boolean"},
		},
		"required_device": {
			Type:         "actuator",
			Required:     true,
			Capabilities: []string{"on", "off"},
		},
	}

	tests := []struct {
		name      string
		payload   *RegistrationPayload
		wantValid bool
		wantErrs  int
	}{
		{
			name: "valid registration with all required devices",
			payload: &RegistrationPayload{
				Version: 1,
				Controller: ControllerInfo{
					ID:           "ctrl-001",
					HeartbeatSec: 5,
				},
				Devices: []DeviceRegistration{
					{
						LogicalID:    "required_device",
						Type:         "actuator",
						Capabilities: []string{"on", "off"},
					},
					{
						LogicalID:    "example_device",
						Type:         "sensor",
						Capabilities: []string{"boolean"},
					},
				},
			},
			wantValid: true,
			wantErrs:  0,
		},
		{
			name: "missing required device",
			payload: &RegistrationPayload{
				Version: 1,
				Controller: ControllerInfo{
					ID:           "ctrl-002",
					HeartbeatSec: 5,
				},
				Devices: []DeviceRegistration{
					{
						LogicalID:    "example_device",
						Type:         "sensor",
						Capabilities: []string{"boolean"},
					},
				},
			},
			wantValid: false,
			wantErrs:  1,
		},
		{
			name: "type mismatch",
			payload: &RegistrationPayload{
				Version: 1,
				Controller: ControllerInfo{
					ID:           "ctrl-003",
					HeartbeatSec: 5,
				},
				Devices: []DeviceRegistration{
					{
						LogicalID:    "required_device",
						Type:         "wrong_type",
						Capabilities: []string{"on", "off"},
					},
				},
			},
			wantValid: false,
			wantErrs:  1,
		},
		{
			name: "missing capability",
			payload: &RegistrationPayload{
				Version: 1,
				Controller: ControllerInfo{
					ID:           "ctrl-004",
					HeartbeatSec: 5,
				},
				Devices: []DeviceRegistration{
					{
						LogicalID:    "required_device",
						Type:         "actuator",
						Capabilities: []string{"on"}, // missing "off"
					},
				},
			},
			wantValid: false,
			wantErrs:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateRegistration(tt.payload, specs)
			if result.Valid != tt.wantValid {
				t.Errorf("expected Valid=%v, got %v", tt.wantValid, result.Valid)
			}
			if len(result.Errors) != tt.wantErrs {
				t.Errorf("expected %d errors, got %d: %v", tt.wantErrs, len(result.Errors), result.Errors)
			}
		})
	}
}

func TestValidateAgainstDevicesYaml(t *testing.T) {
	// Load actual devices.yaml template
	devCfg, err := config.LoadDevicesConfig("../../rooms/_template/devices.yaml")
	if err != nil {
		t.Fatalf("failed to load devices.yaml: %v", err)
	}

	// Convert to specs
	specs := make(map[string]DeviceSpec)
	for id, dev := range devCfg.Devices {
		specs[id] = DeviceSpecFromConfig(dev.Type, dev.Required, dev.Capabilities)
	}

	// Create a registration payload matching the template
	payload := &RegistrationPayload{
		Version: 1,
		Controller: ControllerInfo{
			ID:           "test-ctrl",
			Type:         "teensy",
			Firmware:     "1.0.0",
			HeartbeatSec: 5,
		},
		Devices: []DeviceRegistration{
			{
				LogicalID:    "example_device",
				Type:         "sensor",
				Capabilities: []string{"boolean"},
			},
		},
	}

	result := ValidateRegistration(payload, specs)
	if !result.Valid {
		t.Errorf("expected valid registration against template devices.yaml, got errors: %v", result.Errors)
	}
}
