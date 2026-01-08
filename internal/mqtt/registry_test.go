package mqtt

import (
	"testing"
)

func TestDeviceRegistry_RegisterAndGet(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID:     "crypt_door",
		ControllerID:  "ctrl-001",
		Type:          "door",
		CommandTopic:  "devices/ctrl-001/crypt_door/commands",
		EventTopic:    "devices/ctrl-001/crypt_door/events",
		Capabilities:  []string{"open", "close"},
		InputSignals:  []string{"door_closed", "door_open"},
		OutputSignals: []string{"unlock", "lock"},
	}

	registry.Register(dev)

	// Test Get
	got := registry.Get("crypt_door")
	if got == nil {
		t.Fatal("expected device, got nil")
	}
	if got.LogicalID != "crypt_door" {
		t.Errorf("expected logical_id crypt_door, got %s", got.LogicalID)
	}
	if got.CommandTopic != "devices/ctrl-001/crypt_door/commands" {
		t.Errorf("expected command topic, got %s", got.CommandTopic)
	}

	// Test Exists
	if !registry.Exists("crypt_door") {
		t.Error("expected device to exist")
	}
	if registry.Exists("nonexistent") {
		t.Error("expected device to not exist")
	}
}

func TestDeviceRegistry_GetCommandTopic(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID:    "crypt_door",
		CommandTopic: "devices/ctrl-001/crypt_door/commands",
	}
	registry.Register(dev)

	topic := registry.GetCommandTopic("crypt_door")
	if topic != "devices/ctrl-001/crypt_door/commands" {
		t.Errorf("expected command topic, got %s", topic)
	}

	topic = registry.GetCommandTopic("nonexistent")
	if topic != "" {
		t.Errorf("expected empty string for nonexistent device, got %s", topic)
	}
}

func TestDeviceRegistry_HasOutputSignal(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID:     "crypt_door",
		OutputSignals: []string{"unlock", "lock"},
	}
	registry.Register(dev)

	if !registry.HasOutputSignal("crypt_door", "unlock") {
		t.Error("expected to have unlock signal")
	}
	if !registry.HasOutputSignal("crypt_door", "lock") {
		t.Error("expected to have lock signal")
	}
	if registry.HasOutputSignal("crypt_door", "open") {
		t.Error("expected to not have open signal")
	}
	if registry.HasOutputSignal("nonexistent", "unlock") {
		t.Error("expected false for nonexistent device")
	}
}

func TestDeviceRegistry_ValidateCommand(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID:     "crypt_door",
		CommandTopic:  "devices/ctrl-001/crypt_door/commands",
		OutputSignals: []string{"unlock", "lock"},
	}
	registry.Register(dev)

	// Valid command
	err := registry.ValidateCommand("crypt_door", "unlock")
	if err != nil {
		t.Errorf("expected valid command, got error: %v", err)
	}

	// Invalid signal
	err = registry.ValidateCommand("crypt_door", "explode")
	if err == nil {
		t.Error("expected error for invalid signal")
	}

	// Nonexistent device
	err = registry.ValidateCommand("nonexistent", "unlock")
	if err == nil {
		t.Error("expected error for nonexistent device")
	}
}

func TestDeviceRegistry_RegisterFromPayload(t *testing.T) {
	registry := NewDeviceRegistry()

	payload := &RegistrationPayload{
		Version: 1,
		Controller: ControllerInfo{
			ID:           "ctrl-001",
			Type:         "teensy",
			Firmware:     "1.2.0",
			UptimeMS:     123456,
			HeartbeatSec: 5,
		},
		Devices: []DeviceRegistration{
			{
				LogicalID:    "crypt_door",
				Type:         "door",
				Capabilities: []string{"open", "close"},
				Signals: DeviceSignals{
					Inputs:  []string{"door_closed", "door_open"},
					Outputs: []string{"unlock", "lock"},
				},
				Topics: DeviceTopics{
					Publish:   "devices/ctrl-001/crypt_door/events",
					Subscribe: "devices/ctrl-001/crypt_door/commands",
				},
			},
			{
				LogicalID:    "scarab_sensor",
				Type:         "sensor",
				Capabilities: []string{"detect"},
				Signals: DeviceSignals{
					Inputs:  []string{"triggered"},
					Outputs: []string{},
				},
				Topics: DeviceTopics{
					Publish:   "devices/ctrl-001/scarab_sensor/events",
					Subscribe: "devices/ctrl-001/scarab_sensor/commands",
				},
			},
		},
	}

	registry.RegisterFromPayload(payload)

	// Verify crypt_door
	door := registry.Get("crypt_door")
	if door == nil {
		t.Fatal("expected crypt_door to be registered")
	}
	if door.CommandTopic != "devices/ctrl-001/crypt_door/commands" {
		t.Errorf("wrong command topic: %s", door.CommandTopic)
	}
	if door.ControllerID != "ctrl-001" {
		t.Errorf("wrong controller ID: %s", door.ControllerID)
	}

	// Verify scarab_sensor
	sensor := registry.Get("scarab_sensor")
	if sensor == nil {
		t.Fatal("expected scarab_sensor to be registered")
	}
	if sensor.CommandTopic != "devices/ctrl-001/scarab_sensor/commands" {
		t.Errorf("wrong command topic: %s", sensor.CommandTopic)
	}

	// Verify All()
	all := registry.All()
	if len(all) != 2 {
		t.Errorf("expected 2 devices, got %d", len(all))
	}
}

func TestDeviceRegistry_Unregister(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID: "crypt_door",
	}
	registry.Register(dev)

	if !registry.Exists("crypt_door") {
		t.Error("expected device to exist")
	}

	registry.Unregister("crypt_door")

	if registry.Exists("crypt_door") {
		t.Error("expected device to be unregistered")
	}
}

func TestDeviceRegistry_Clear(t *testing.T) {
	registry := NewDeviceRegistry()

	dev1 := &RegisteredDevice{LogicalID: "dev1"}
	dev2 := &RegisteredDevice{LogicalID: "dev2"}
	registry.Register(dev1)
	registry.Register(dev2)

	if len(registry.All()) != 2 {
		t.Error("expected 2 devices")
	}

	registry.Clear()

	if len(registry.All()) != 0 {
		t.Error("expected 0 devices after clear")
	}
}

func TestDeviceRegistry_ValidateCommand_NoCommandTopic(t *testing.T) {
	registry := NewDeviceRegistry()

	dev := &RegisteredDevice{
		LogicalID:     "sensor",
		CommandTopic:  "", // No command topic
		OutputSignals: []string{"trigger"},
	}
	registry.Register(dev)

	err := registry.ValidateCommand("sensor", "trigger")
	if err == nil {
		t.Error("expected error for device with no command topic")
	}
}
