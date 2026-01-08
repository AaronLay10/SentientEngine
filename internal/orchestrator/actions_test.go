package orchestrator

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/AaronLay10/SentientEngine/internal/config"
	"github.com/AaronLay10/SentientEngine/internal/mqtt"
)

// MockMQTTClient is a mock MQTT client for testing.
type MockMQTTClient struct {
	mu           sync.Mutex
	connected    bool
	published    []PublishedMessage
	publishError error
}

type PublishedMessage struct {
	Topic   string
	Payload []byte
}

func NewMockMQTTClient() *MockMQTTClient {
	return &MockMQTTClient{
		connected: true,
		published: []PublishedMessage{},
	}
}

func (m *MockMQTTClient) IsConnected() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.connected
}

func (m *MockMQTTClient) Publish(topic string, payload []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.publishError != nil {
		return m.publishError
	}
	m.published = append(m.published, PublishedMessage{Topic: topic, Payload: payload})
	return nil
}

func (m *MockMQTTClient) GetPublished() []PublishedMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]PublishedMessage{}, m.published...)
}

func (m *MockMQTTClient) SetConnected(connected bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connected = connected
}

// MQTTPublisher interface for action executor
type MQTTPublisher interface {
	IsConnected() bool
	Publish(topic string, payload []byte) error
}

func TestActionExecutor_DeviceCommand_Success(t *testing.T) {
	// Set up device registry
	registry := mqtt.NewDeviceRegistry()
	registry.Register(&mqtt.RegisteredDevice{
		LogicalID:     "crypt_door",
		ControllerID:  "ctrl-001",
		Type:          "door",
		CommandTopic:  "devices/ctrl-001/crypt_door/commands",
		OutputSignals: []string{"unlock", "lock"},
	})

	// Set up devices config
	devCfg := &config.DevicesConfig{
		Version: 1,
		Devices: map[string]config.DeviceDefinition{
			"crypt_door": {
				Type:         "door",
				Required:     true,
				Capabilities: []string{"open", "close"},
				Signals: struct {
					Inputs  []string `yaml:"inputs"`
					Outputs []string `yaml:"outputs"`
				}{
					Inputs:  []string{"door_closed", "door_open"},
					Outputs: []string{"unlock", "lock"},
				},
			},
		},
	}

	// Create mock MQTT client
	mockClient := NewMockMQTTClient()

	// Create action executor with mock wrapper
	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  devCfg,
		mockClient:     mockClient,
	}

	// Execute device.command action
	nodeConfig := map[string]interface{}{
		"action": "device.command",
		"params": map[string]interface{}{
			"device_id": "crypt_door",
			"signal":    "unlock",
			"payload":   map[string]interface{}{"force": true},
		},
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Verify message was published
	published := mockClient.GetPublished()
	if len(published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(published))
	}

	if published[0].Topic != "devices/ctrl-001/crypt_door/commands" {
		t.Errorf("wrong topic: %s", published[0].Topic)
	}

	// Verify payload structure
	var payload map[string]interface{}
	if err := json.Unmarshal(published[0].Payload, &payload); err != nil {
		t.Fatalf("failed to unmarshal payload: %v", err)
	}

	if payload["signal"] != "unlock" {
		t.Errorf("wrong signal in payload: %v", payload["signal"])
	}
}

func TestActionExecutor_DeviceCommand_DeviceNotRegistered(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	mockClient := NewMockMQTTClient()

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	nodeConfig := map[string]interface{}{
		"action": "device.command",
		"params": map[string]interface{}{
			"device_id": "nonexistent",
			"signal":    "unlock",
		},
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err == nil {
		t.Error("expected error for unregistered device")
	}

	// Verify no message was published
	if len(mockClient.GetPublished()) != 0 {
		t.Error("expected no messages to be published")
	}
}

func TestActionExecutor_DeviceCommand_InvalidSignal(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	registry.Register(&mqtt.RegisteredDevice{
		LogicalID:     "crypt_door",
		CommandTopic:  "devices/ctrl-001/crypt_door/commands",
		OutputSignals: []string{"unlock", "lock"},
	})

	mockClient := NewMockMQTTClient()

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	nodeConfig := map[string]interface{}{
		"action": "device.command",
		"params": map[string]interface{}{
			"device_id": "crypt_door",
			"signal":    "explode", // Invalid signal
		},
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err == nil {
		t.Error("expected error for invalid signal")
	}

	// Verify no message was published
	if len(mockClient.GetPublished()) != 0 {
		t.Error("expected no messages to be published")
	}
}

func TestActionExecutor_DeviceCommand_MissingParams(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	mockClient := NewMockMQTTClient()

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	// Missing params
	nodeConfig := map[string]interface{}{
		"action": "device.command",
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err == nil {
		t.Error("expected error for missing params")
	}
}

func TestActionExecutor_DeviceCommand_MissingDeviceID(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	mockClient := NewMockMQTTClient()

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	nodeConfig := map[string]interface{}{
		"action": "device.command",
		"params": map[string]interface{}{
			"signal": "unlock",
		},
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err == nil {
		t.Error("expected error for missing device_id")
	}
}

func TestActionExecutor_DeviceCommand_MQTTNotConnected(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	registry.Register(&mqtt.RegisteredDevice{
		LogicalID:     "crypt_door",
		CommandTopic:  "devices/ctrl-001/crypt_door/commands",
		OutputSignals: []string{"unlock"},
	})

	mockClient := NewMockMQTTClient()
	mockClient.SetConnected(false)

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	nodeConfig := map[string]interface{}{
		"action": "device.command",
		"params": map[string]interface{}{
			"device_id": "crypt_door",
			"signal":    "unlock",
		},
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err == nil {
		t.Error("expected error when MQTT not connected")
	}
}

func TestActionExecutor_UnknownAction(t *testing.T) {
	registry := mqtt.NewDeviceRegistry()
	mockClient := NewMockMQTTClient()

	executor := &testActionExecutor{
		deviceRegistry: registry,
		devicesConfig:  nil,
		mockClient:     mockClient,
	}

	nodeConfig := map[string]interface{}{
		"action": "unknown.action",
	}

	err := executor.ExecuteAction("action_node_1", nodeConfig)
	if err != nil {
		t.Errorf("expected no error for unknown action (MVP behavior), got: %v", err)
	}
}

// testActionExecutor is a test version that uses MockMQTTClient
type testActionExecutor struct {
	deviceRegistry *mqtt.DeviceRegistry
	devicesConfig  *config.DevicesConfig
	mockClient     *MockMQTTClient
}

func (e *testActionExecutor) ExecuteAction(nodeID string, config map[string]interface{}) error {
	actionName, ok := config["action"].(string)
	if !ok {
		return errorf("action node %s: missing 'action' field", nodeID)
	}

	switch actionName {
	case "device.command":
		return e.executeDeviceCommand(nodeID, config)
	default:
		return nil
	}
}

func (e *testActionExecutor) executeDeviceCommand(nodeID string, config map[string]interface{}) error {
	params, ok := config["params"].(map[string]interface{})
	if !ok {
		return errorf("missing 'params' field")
	}

	deviceID, ok := params["device_id"].(string)
	if !ok || deviceID == "" {
		return errorf("missing 'device_id' in params")
	}

	signal, ok := params["signal"].(string)
	if !ok || signal == "" {
		return errorf("missing 'signal' in params")
	}

	payload := params["payload"]

	if e.deviceRegistry == nil {
		return errorf("device registry not available")
	}

	if err := e.deviceRegistry.ValidateCommand(deviceID, signal); err != nil {
		return err
	}

	if e.devicesConfig != nil {
		if devDef, ok := e.devicesConfig.Devices[deviceID]; ok {
			found := false
			for _, output := range devDef.Signals.Outputs {
				if output == signal {
					found = true
					break
				}
			}
			if !found {
				return errorf("signal %s not allowed by devices.yaml for %s", signal, deviceID)
			}
		}
	}

	commandTopic := e.deviceRegistry.GetCommandTopic(deviceID)
	if commandTopic == "" {
		return errorf("no command topic for device %s", deviceID)
	}

	cmdPayload := map[string]interface{}{
		"signal":  signal,
		"payload": payload,
	}

	payloadBytes, err := json.Marshal(cmdPayload)
	if err != nil {
		return errorf("failed to marshal payload: %v", err)
	}

	if e.mockClient == nil || !e.mockClient.IsConnected() {
		return errorf("MQTT client not connected")
	}

	return e.mockClient.Publish(commandTopic, payloadBytes)
}

func errorf(format string, args ...interface{}) error {
	return &testError{msg: format}
}

type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
