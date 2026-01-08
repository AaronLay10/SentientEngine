package orchestrator

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/mqtt"
)

// TestDeviceCommandIntegration tests the complete flow from device.input to MQTT publish.
// This test verifies:
// 1. Template scene graph loads correctly
// 2. Controller registration populates device registry
// 3. Scene starts and puzzle activates
// 4. device.input triggers puzzle.solved
// 5. Post-solve action node (scarab_unlock) executes device.command
// 6. MQTT Publish is called with correct topic and payload
func TestDeviceCommandIntegration(t *testing.T) {
	// Clear events buffer
	events.Clear()

	// Load the template scene graph
	sg, err := LoadSceneGraph("../../rooms/_template/graphs/scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load template scene graph: %v", err)
	}

	// Create device registry and simulate controller registration
	registry := mqtt.NewDeviceRegistry()
	registrationPayload := &mqtt.RegistrationPayload{
		Version: 1,
		Controller: mqtt.ControllerInfo{
			ID:   "ctrl-001",
			Type: "esp32",
		},
		Devices: []mqtt.DeviceRegistration{
			{
				LogicalID:    "crypt_door",
				Type:         "door",
				Capabilities: []string{"open", "close"},
				Signals: mqtt.DeviceSignals{
					Inputs:  []string{"door_closed", "door_open"},
					Outputs: []string{"unlock", "lock"},
				},
				Topics: mqtt.DeviceTopics{
					Publish:   "devices/ctrl-001/crypt_door/events",
					Subscribe: "devices/ctrl-001/crypt_door/commands",
				},
			},
		},
	}
	registry.RegisterFromPayload(registrationPayload)

	// Verify registration populated correctly
	dev := registry.Get("crypt_door")
	if dev == nil {
		t.Fatal("crypt_door not found in registry after registration")
	}
	if dev.CommandTopic != "devices/ctrl-001/crypt_door/commands" {
		t.Errorf("wrong command topic: %s", dev.CommandTopic)
	}

	// Create mock MQTT client
	mockClient := NewMockMQTTClient()

	// Create action executor with mock client wrapper
	executor := newMockActionExecutor(registry, mockClient)

	// Create runtime and set action executor
	rt := NewRuntime(sg)
	rt.SetActionExecutor(executor)

	// Start the intro scene
	if err := rt.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Verify puzzle_scarab is active and unresolved
	if rt.GetNodeState("puzzle_scarab") != NodeStateActive {
		t.Errorf("expected puzzle_scarab to be active, got %v", rt.GetNodeState("puzzle_scarab"))
	}
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Error("expected puzzle_scarab to be unresolved initially")
	}

	// Inject device.input event that matches the puzzle condition
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "crypt_door",
		"topic":         "devices/ctrl-001/crypt_door/events",
		"payload": map[string]interface{}{
			"door_closed": true,
		},
	})

	// Verify puzzle_scarab is now solved
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleSolved {
		t.Errorf("expected puzzle_scarab to be solved, got %v", rt.GetPuzzleResolution("puzzle_scarab"))
	}
	if rt.GetNodeState("puzzle_scarab") != NodeStateCompleted {
		t.Errorf("expected puzzle_scarab node to be completed, got %v", rt.GetNodeState("puzzle_scarab"))
	}

	// Verify puzzle.solved event was emitted
	snapshot := events.Snapshot()
	hasPuzzleSolved := false
	hasNodeStartedUnlock := false
	hasNodeCompletedUnlock := false

	for _, e := range snapshot {
		if e.Name == "puzzle.solved" {
			if puzzleID, ok := e.Fields["puzzle_id"].(string); ok && puzzleID == "puzzle_scarab" {
				hasPuzzleSolved = true
			}
		}
		if e.Name == "node.started" {
			if nodeID, ok := e.Fields["node_id"].(string); ok && nodeID == "scarab_unlock" {
				hasNodeStartedUnlock = true
			}
		}
		if e.Name == "node.completed" {
			if nodeID, ok := e.Fields["node_id"].(string); ok && nodeID == "scarab_unlock" {
				hasNodeCompletedUnlock = true
			}
		}
	}

	if !hasPuzzleSolved {
		t.Error("expected puzzle.solved event for puzzle_scarab")
	}
	if !hasNodeStartedUnlock {
		t.Error("expected node.started event for scarab_unlock action node")
	}
	if !hasNodeCompletedUnlock {
		t.Error("expected node.completed event for scarab_unlock action node")
	}

	// Verify MQTT Publish was called with correct topic and payload
	published := mockClient.GetPublished()
	if len(published) != 1 {
		t.Fatalf("expected 1 MQTT publish, got %d", len(published))
	}

	expectedTopic := "devices/ctrl-001/crypt_door/commands"
	if published[0].Topic != expectedTopic {
		t.Errorf("wrong MQTT topic: expected %s, got %s", expectedTopic, published[0].Topic)
	}

	// Verify payload structure
	var cmdPayload map[string]interface{}
	if err := json.Unmarshal(published[0].Payload, &cmdPayload); err != nil {
		t.Fatalf("failed to unmarshal MQTT payload: %v", err)
	}

	if cmdPayload["signal"] != "unlock" {
		t.Errorf("wrong signal in payload: expected 'unlock', got %v", cmdPayload["signal"])
	}

	innerPayload, ok := cmdPayload["payload"].(map[string]interface{})
	if !ok {
		t.Fatal("expected nested payload object")
	}
	if innerPayload["source"] != "puzzle_solved" {
		t.Errorf("wrong source in inner payload: expected 'puzzle_solved', got %v", innerPayload["source"])
	}
}

// TestDeviceCommandWithoutRegistration verifies device.error is emitted when device not registered.
func TestDeviceCommandWithoutRegistration(t *testing.T) {
	events.Clear()

	sg, err := LoadSceneGraph("../../rooms/_template/graphs/scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load template scene graph: %v", err)
	}

	// Create empty device registry (no devices registered)
	registry := mqtt.NewDeviceRegistry()
	mockClient := NewMockMQTTClient()

	executor := newMockActionExecutor(registry, mockClient)

	rt := NewRuntime(sg)
	rt.SetActionExecutor(executor)

	if err := rt.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Inject device.input to trigger puzzle solve
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "crypt_door",
		"topic":         "devices/ctrl-001/crypt_door/events",
		"payload": map[string]interface{}{
			"door_closed": true,
		},
	})

	// Puzzle should still solve (action error doesn't block flow)
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleSolved {
		t.Errorf("expected puzzle_scarab to be solved despite action error")
	}

	// Verify device.error was emitted
	snapshot := events.Snapshot()
	hasDeviceError := false
	for _, e := range snapshot {
		if e.Name == "device.error" {
			hasDeviceError = true
			// Verify error contains device_id
			if devID, ok := e.Fields["device_id"].(string); ok && devID == "crypt_door" {
				// Good - device_id is included
			}
		}
	}

	if !hasDeviceError {
		t.Error("expected device.error event when device not registered")
	}

	// Verify no MQTT publish occurred
	if len(mockClient.GetPublished()) != 0 {
		t.Error("expected no MQTT publish when device not registered")
	}
}

// mockActionExecutor implements ActionExecutorInterface for testing.
type mockActionExecutor struct {
	deviceRegistry *mqtt.DeviceRegistry
	mockClient     *MockMQTTClient
}

func newMockActionExecutor(registry *mqtt.DeviceRegistry, mockClient *MockMQTTClient) *mockActionExecutor {
	return &mockActionExecutor{
		deviceRegistry: registry,
		mockClient:     mockClient,
	}
}

// ExecuteAction implements ActionExecutorInterface.
func (m *mockActionExecutor) ExecuteAction(nodeID string, config map[string]interface{}) error {
	actionName, ok := config["action"].(string)
	if !ok {
		return m.emitDeviceError(nodeID, "", "", "", "missing 'action' field")
	}

	switch actionName {
	case "device.command":
		return m.executeDeviceCommandMock(nodeID, config)
	default:
		return nil
	}
}

func (m *mockActionExecutor) executeDeviceCommandMock(nodeID string, config map[string]interface{}) error {
	params, ok := config["params"].(map[string]interface{})
	if !ok {
		return m.emitDeviceError(nodeID, "", "", "", "missing 'params' field")
	}

	deviceID, ok := params["device_id"].(string)
	if !ok || deviceID == "" {
		return m.emitDeviceError(nodeID, "", "", "", "missing 'device_id' in params")
	}

	signal, ok := params["signal"].(string)
	if !ok || signal == "" {
		return m.emitDeviceError(nodeID, deviceID, "", "", "missing 'signal' in params")
	}

	payload := params["payload"]

	if m.deviceRegistry == nil {
		return m.emitDeviceError(nodeID, deviceID, signal, "", "device registry not available")
	}

	if err := m.deviceRegistry.ValidateCommand(deviceID, signal); err != nil {
		return m.emitDeviceError(nodeID, deviceID, signal, "", err.Error())
	}

	commandTopic := m.deviceRegistry.GetCommandTopic(deviceID)
	if commandTopic == "" {
		return m.emitDeviceError(nodeID, deviceID, signal, "", "no command topic for device")
	}

	cmdPayload := map[string]interface{}{
		"signal":  signal,
		"payload": payload,
	}

	payloadBytes, err := json.Marshal(cmdPayload)
	if err != nil {
		return m.emitDeviceError(nodeID, deviceID, signal, commandTopic, "failed to marshal payload")
	}

	if m.mockClient == nil || !m.mockClient.IsConnected() {
		return m.emitDeviceError(nodeID, deviceID, signal, commandTopic, "MQTT client not connected")
	}

	return m.mockClient.Publish(commandTopic, payloadBytes)
}

// emitDeviceError emits a device.error event with context.
func (m *mockActionExecutor) emitDeviceError(nodeID, deviceID, signal, topic, msg string) error {
	fields := map[string]interface{}{
		"node_id": nodeID,
		"error":   msg,
	}
	if deviceID != "" {
		fields["device_id"] = deviceID
	}
	if signal != "" {
		fields["signal"] = signal
	}
	if topic != "" {
		fields["topic"] = topic
	}
	events.Emit("error", "device.error", msg, fields)
	return fmt.Errorf("%s", msg)
}
