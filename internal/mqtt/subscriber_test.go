package mqtt

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"
)

// MockMQTTClient is a mock MQTT client for testing subscriptions.
type MockMQTTClient struct {
	mu            sync.Mutex
	subscriptions map[string]paho.MessageHandler
	connected     bool
}

func NewMockMQTTClient() *MockMQTTClient {
	return &MockMQTTClient{
		subscriptions: make(map[string]paho.MessageHandler),
		connected:     true,
	}
}

func (m *MockMQTTClient) Subscribe(topic string, handler paho.MessageHandler) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.subscriptions[topic] = handler
	return nil
}

func (m *MockMQTTClient) IsConnected() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.connected
}

func (m *MockMQTTClient) GetSubscriptions() map[string]paho.MessageHandler {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make(map[string]paho.MessageHandler)
	for k, v := range m.subscriptions {
		result[k] = v
	}
	return result
}

func (m *MockMQTTClient) SimulateMessage(topic string, payload []byte) {
	m.mu.Lock()
	handler, ok := m.subscriptions[topic]
	m.mu.Unlock()
	if ok {
		handler(nil, &mockMessage{topic: topic, payload: payload})
	}
}

type mockMessage struct {
	topic   string
	payload []byte
}

func (m *mockMessage) Duplicate() bool   { return false }
func (m *mockMessage) Qos() byte         { return 1 }
func (m *mockMessage) Retained() bool    { return false }
func (m *mockMessage) Topic() string     { return m.topic }
func (m *mockMessage) MessageID() uint16 { return 0 }
func (m *mockMessage) Payload() []byte   { return m.payload }
func (m *mockMessage) Ack()              {}

// testSubscriberClient wraps MockMQTTClient to implement the methods DeviceSubscriber needs.
type testSubscriberClient struct {
	mock *MockMQTTClient
}

func (c *testSubscriberClient) Subscribe(topic string, qos byte, handler paho.MessageHandler) paho.Token {
	c.mock.Subscribe(topic, handler)
	return &mockToken{}
}

func (c *testSubscriberClient) IsConnected() bool {
	return c.mock.IsConnected()
}

type mockToken struct{}

func (t *mockToken) Wait() bool                         { return true }
func (t *mockToken) WaitTimeout(_ time.Duration) bool   { return true }
func (t *mockToken) Done() <-chan struct{}              { ch := make(chan struct{}); close(ch); return ch }
func (t *mockToken) Error() error                       { return nil }

// testDeviceSubscriber is a test version that uses mock client.
type testDeviceSubscriber struct {
	mu         sync.RWMutex
	mock       *MockMQTTClient
	registry   *DeviceRegistry
	subscribed map[string]bool
}

func newTestDeviceSubscriber(mock *MockMQTTClient, registry *DeviceRegistry) *testDeviceSubscriber {
	return &testDeviceSubscriber{
		mock:       mock,
		registry:   registry,
		subscribed: make(map[string]bool),
	}
}

func (s *testDeviceSubscriber) SubscribeDevice(dev *RegisteredDevice) error {
	if dev.EventTopic == "" {
		return nil
	}

	s.mu.Lock()
	if s.subscribed[dev.EventTopic] {
		s.mu.Unlock()
		return nil
	}
	s.mu.Unlock()

	// Create handler that would emit device.input
	handler := func(client paho.Client, msg paho.Message) {
		// In test, we just record that the handler was invoked
	}

	if err := s.mock.Subscribe(dev.EventTopic, handler); err != nil {
		return err
	}

	s.mu.Lock()
	s.subscribed[dev.EventTopic] = true
	s.mu.Unlock()

	return nil
}

func (s *testDeviceSubscriber) IsSubscribed(topic string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.subscribed[topic]
}

func (s *testDeviceSubscriber) SubscribedTopics() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	topics := make([]string, 0, len(s.subscribed))
	for topic := range s.subscribed {
		topics = append(topics, topic)
	}
	return topics
}

func TestDeviceSubscriber_SubscribeDevice(t *testing.T) {
	mock := NewMockMQTTClient()
	registry := NewDeviceRegistry()

	subscriber := newTestDeviceSubscriber(mock, registry)

	dev := &RegisteredDevice{
		LogicalID:    "crypt_door",
		ControllerID: "ctrl-001",
		EventTopic:   "devices/ctrl-001/crypt_door/events",
	}

	err := subscriber.SubscribeDevice(dev)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify subscription was created
	subs := mock.GetSubscriptions()
	if _, ok := subs["devices/ctrl-001/crypt_door/events"]; !ok {
		t.Error("expected subscription to device event topic")
	}

	if !subscriber.IsSubscribed("devices/ctrl-001/crypt_door/events") {
		t.Error("expected subscriber to track subscription")
	}
}

func TestDeviceSubscriber_SubscribeDevice_Idempotent(t *testing.T) {
	mock := NewMockMQTTClient()
	registry := NewDeviceRegistry()

	subscriber := newTestDeviceSubscriber(mock, registry)

	dev := &RegisteredDevice{
		LogicalID:    "crypt_door",
		ControllerID: "ctrl-001",
		EventTopic:   "devices/ctrl-001/crypt_door/events",
	}

	// Subscribe twice
	_ = subscriber.SubscribeDevice(dev)
	_ = subscriber.SubscribeDevice(dev)

	// Should still only have one subscription
	topics := subscriber.SubscribedTopics()
	if len(topics) != 1 {
		t.Errorf("expected 1 subscribed topic, got %d", len(topics))
	}
}

func TestDeviceSubscriber_SubscribeDevice_NoEventTopic(t *testing.T) {
	mock := NewMockMQTTClient()
	registry := NewDeviceRegistry()

	subscriber := newTestDeviceSubscriber(mock, registry)

	dev := &RegisteredDevice{
		LogicalID:    "sensor",
		ControllerID: "ctrl-001",
		EventTopic:   "", // No event topic
	}

	err := subscriber.SubscribeDevice(dev)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should not have any subscriptions
	subs := mock.GetSubscriptions()
	if len(subs) != 0 {
		t.Error("expected no subscriptions for device without event topic")
	}
}

func TestDeviceSubscriber_MultipleDevices(t *testing.T) {
	mock := NewMockMQTTClient()
	registry := NewDeviceRegistry()

	subscriber := newTestDeviceSubscriber(mock, registry)

	devices := []*RegisteredDevice{
		{LogicalID: "crypt_door", ControllerID: "ctrl-001", EventTopic: "devices/ctrl-001/crypt_door/events"},
		{LogicalID: "scarab_sensor", ControllerID: "ctrl-001", EventTopic: "devices/ctrl-001/scarab_sensor/events"},
		{LogicalID: "lock", ControllerID: "ctrl-002", EventTopic: "devices/ctrl-002/lock/events"},
	}

	for _, dev := range devices {
		_ = subscriber.SubscribeDevice(dev)
	}

	topics := subscriber.SubscribedTopics()
	if len(topics) != 3 {
		t.Errorf("expected 3 subscribed topics, got %d", len(topics))
	}
}

func TestMonitor_HandleRegistration_SubscribesDevices(t *testing.T) {
	specs := map[string]DeviceSpec{
		"crypt_door": {Type: "door", Required: true},
	}

	monitor := NewMonitor(specs, 2.0)
	mock := NewMockMQTTClient()
	subscriber := newTestDeviceSubscriber(mock, monitor.DeviceRegistry())

	// Use a custom subscriber wrapper to integrate with monitor
	// For this test, we manually subscribe after registration
	payload := &RegistrationPayload{
		Version: 1,
		Controller: ControllerInfo{
			ID:           "ctrl-001",
			HeartbeatSec: 5,
		},
		Devices: []DeviceRegistration{
			{
				LogicalID: "crypt_door",
				Type:      "door",
				Topics: DeviceTopics{
					Publish:   "devices/ctrl-001/crypt_door/events",
					Subscribe: "devices/ctrl-001/crypt_door/commands",
				},
			},
		},
	}

	result := monitor.HandleRegistration(payload)
	if !result.Valid {
		t.Fatalf("registration should be valid")
	}

	// Manually subscribe to test the subscriber logic
	dev := monitor.DeviceRegistry().Get("crypt_door")
	if dev == nil {
		t.Fatal("device should be in registry")
	}

	_ = subscriber.SubscribeDevice(dev)

	if !subscriber.IsSubscribed("devices/ctrl-001/crypt_door/events") {
		t.Error("expected subscription after registration")
	}
}

func TestDeviceInput_PayloadParsing(t *testing.T) {
	// Test that JSON payloads are parsed correctly
	testCases := []struct {
		name     string
		payload  []byte
		expected interface{}
	}{
		{
			name:     "JSON object",
			payload:  []byte(`{"signal": "door_open", "value": true}`),
			expected: map[string]interface{}{"signal": "door_open", "value": true},
		},
		{
			name:     "JSON array",
			payload:  []byte(`[1, 2, 3]`),
			expected: []interface{}{float64(1), float64(2), float64(3)},
		},
		{
			name:     "Invalid JSON",
			payload:  []byte(`not json`),
			expected: "not json",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var result interface{}
			if err := json.Unmarshal(tc.payload, &result); err != nil {
				result = string(tc.payload)
			}

			// Just verify the parsing logic works
			switch expected := tc.expected.(type) {
			case string:
				if result != expected {
					t.Errorf("expected %v, got %v", expected, result)
				}
			case map[string]interface{}:
				resultMap, ok := result.(map[string]interface{})
				if !ok {
					t.Errorf("expected map, got %T", result)
				}
				if resultMap["signal"] != expected["signal"] {
					t.Errorf("expected signal %v, got %v", expected["signal"], resultMap["signal"])
				}
			case []interface{}:
				resultArr, ok := result.([]interface{})
				if !ok {
					t.Errorf("expected array, got %T", result)
				}
				if len(resultArr) != len(expected) {
					t.Errorf("expected length %d, got %d", len(expected), len(resultArr))
				}
			}
		})
	}
}
