package mqtt

import (
	"fmt"
	"sync"
)

// RegisteredDevice holds runtime information about a registered device.
type RegisteredDevice struct {
	LogicalID    string
	ControllerID string
	Type         string
	CommandTopic string   // topics.subscribe from registration
	EventTopic   string   // topics.publish from registration
	Capabilities []string
	InputSignals []string
	OutputSignals []string
}

// DeviceRegistry maintains a mapping of logical device IDs to their MQTT topics and metadata.
type DeviceRegistry struct {
	mu      sync.RWMutex
	devices map[string]*RegisteredDevice
}

// NewDeviceRegistry creates a new empty device registry.
func NewDeviceRegistry() *DeviceRegistry {
	return &DeviceRegistry{
		devices: make(map[string]*RegisteredDevice),
	}
}

// Register adds or updates a device in the registry.
func (r *DeviceRegistry) Register(dev *RegisteredDevice) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.devices[dev.LogicalID] = dev
}

// Unregister removes a device from the registry.
func (r *DeviceRegistry) Unregister(logicalID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.devices, logicalID)
}

// Get returns a device by logical ID, or nil if not found.
func (r *DeviceRegistry) Get(logicalID string) *RegisteredDevice {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if dev, ok := r.devices[logicalID]; ok {
		// Return a copy to prevent mutation
		cpy := *dev
		cpy.Capabilities = append([]string{}, dev.Capabilities...)
		cpy.InputSignals = append([]string{}, dev.InputSignals...)
		cpy.OutputSignals = append([]string{}, dev.OutputSignals...)
		return &cpy
	}
	return nil
}

// Exists returns true if the device is registered.
func (r *DeviceRegistry) Exists(logicalID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.devices[logicalID]
	return ok
}

// GetCommandTopic returns the command topic for a device, or empty string if not found.
func (r *DeviceRegistry) GetCommandTopic(logicalID string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if dev, ok := r.devices[logicalID]; ok {
		return dev.CommandTopic
	}
	return ""
}

// HasOutputSignal returns true if the device supports the given output signal.
func (r *DeviceRegistry) HasOutputSignal(logicalID, signal string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if dev, ok := r.devices[logicalID]; ok {
		for _, s := range dev.OutputSignals {
			if s == signal {
				return true
			}
		}
	}
	return false
}

// ValidateCommand validates that a device exists and supports the given output signal.
// Returns an error describing the validation failure, or nil if valid.
func (r *DeviceRegistry) ValidateCommand(logicalID, signal string) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	dev, ok := r.devices[logicalID]
	if !ok {
		return fmt.Errorf("device not registered: %s", logicalID)
	}

	if dev.CommandTopic == "" {
		return fmt.Errorf("device %s has no command topic", logicalID)
	}

	for _, s := range dev.OutputSignals {
		if s == signal {
			return nil
		}
	}

	return fmt.Errorf("device %s does not support output signal: %s", logicalID, signal)
}

// All returns a copy of all registered devices.
func (r *DeviceRegistry) All() []*RegisteredDevice {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*RegisteredDevice, 0, len(r.devices))
	for _, dev := range r.devices {
		cpy := *dev
		cpy.Capabilities = append([]string{}, dev.Capabilities...)
		cpy.InputSignals = append([]string{}, dev.InputSignals...)
		cpy.OutputSignals = append([]string{}, dev.OutputSignals...)
		result = append(result, &cpy)
	}
	return result
}

// RegisterFromPayload registers all devices from a registration payload.
func (r *DeviceRegistry) RegisterFromPayload(payload *RegistrationPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, dev := range payload.Devices {
		r.devices[dev.LogicalID] = &RegisteredDevice{
			LogicalID:     dev.LogicalID,
			ControllerID:  payload.Controller.ID,
			Type:          dev.Type,
			CommandTopic:  dev.Topics.Subscribe,
			EventTopic:    dev.Topics.Publish,
			Capabilities:  append([]string{}, dev.Capabilities...),
			InputSignals:  append([]string{}, dev.Signals.Inputs...),
			OutputSignals: append([]string{}, dev.Signals.Outputs...),
		}
	}
}

// Clear removes all devices from the registry.
func (r *DeviceRegistry) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.devices = make(map[string]*RegisteredDevice)
}
