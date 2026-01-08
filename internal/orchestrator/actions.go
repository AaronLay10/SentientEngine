package orchestrator

import (
	"encoding/json"
	"fmt"

	"github.com/AaronLay10/SentientEngine/internal/config"
	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/mqtt"
)

// ActionExecutorInterface defines the interface for action execution.
// This allows for testing with mock implementations.
type ActionExecutorInterface interface {
	ExecuteAction(nodeID string, config map[string]interface{}) error
}

// ActionExecutor handles execution of action nodes.
type ActionExecutor struct {
	mqttClient     *mqtt.Client
	deviceRegistry *mqtt.DeviceRegistry
	devicesConfig  *config.DevicesConfig
}

// NewActionExecutor creates a new action executor.
func NewActionExecutor(mqttClient *mqtt.Client, deviceRegistry *mqtt.DeviceRegistry, devicesConfig *config.DevicesConfig) *ActionExecutor {
	return &ActionExecutor{
		mqttClient:     mqttClient,
		deviceRegistry: deviceRegistry,
		devicesConfig:  devicesConfig,
	}
}

// ExecuteAction executes an action node and returns an error if the action fails.
// For device.command actions, this publishes to the device's MQTT command topic.
func (e *ActionExecutor) ExecuteAction(nodeID string, config map[string]interface{}) error {
	actionName, ok := config["action"].(string)
	if !ok {
		return fmt.Errorf("action node %s: missing 'action' field", nodeID)
	}

	switch actionName {
	case "device.command":
		return e.executeDeviceCommand(nodeID, config)
	default:
		// Unknown action types complete without doing anything (MVP behavior)
		return nil
	}
}

// executeDeviceCommand handles the device.command action type.
func (e *ActionExecutor) executeDeviceCommand(nodeID string, config map[string]interface{}) error {
	params, ok := config["params"].(map[string]interface{})
	if !ok {
		return e.emitDeviceError(nodeID, "", "", "", "missing 'params' field")
	}

	deviceID, ok := params["device_id"].(string)
	if !ok || deviceID == "" {
		return e.emitDeviceError(nodeID, "", "", "", "missing 'device_id' in params")
	}

	signal, ok := params["signal"].(string)
	if !ok || signal == "" {
		return e.emitDeviceError(nodeID, deviceID, "", "", "missing 'signal' in params")
	}

	payload := params["payload"]

	// Validate device is registered
	if e.deviceRegistry == nil {
		return e.emitDeviceError(nodeID, deviceID, signal, "", "device registry not available")
	}

	if err := e.deviceRegistry.ValidateCommand(deviceID, signal); err != nil {
		return e.emitDeviceError(nodeID, deviceID, signal, "", err.Error())
	}

	// Validate signal is allowed by devices.yaml outputs
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
				return e.emitDeviceError(nodeID, deviceID, signal, "", fmt.Sprintf("signal %s not allowed by devices.yaml for %s", signal, deviceID))
			}
		}
	}

	// Get command topic
	commandTopic := e.deviceRegistry.GetCommandTopic(deviceID)
	if commandTopic == "" {
		return e.emitDeviceError(nodeID, deviceID, signal, "", fmt.Sprintf("no command topic for device %s", deviceID))
	}

	// Build command payload
	cmdPayload := map[string]interface{}{
		"signal":  signal,
		"payload": payload,
	}

	payloadBytes, err := json.Marshal(cmdPayload)
	if err != nil {
		return e.emitDeviceError(nodeID, deviceID, signal, commandTopic, fmt.Sprintf("failed to marshal payload: %v", err))
	}

	// Publish to MQTT
	if e.mqttClient == nil || !e.mqttClient.IsConnected() {
		return e.emitDeviceError(nodeID, deviceID, signal, commandTopic, "MQTT client not connected")
	}

	if err := e.mqttClient.Publish(commandTopic, payloadBytes); err != nil {
		return e.emitDeviceError(nodeID, deviceID, signal, commandTopic, fmt.Sprintf("MQTT publish failed: %v", err))
	}

	return nil
}

// emitDeviceError emits a device.error event with full context and returns an error.
func (e *ActionExecutor) emitDeviceError(nodeID, deviceID, signal, topic, msg string) error {
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
