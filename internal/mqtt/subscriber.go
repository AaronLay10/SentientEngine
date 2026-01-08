package mqtt

import (
	"encoding/json"
	"sync"

	paho "github.com/eclipse/paho.mqtt.golang"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

// DeviceSubscriber manages subscriptions to device event topics.
// It ensures idempotent subscription handling across reconnects.
type DeviceSubscriber struct {
	mu          sync.RWMutex
	client      *Client
	registry    *DeviceRegistry
	subscribed  map[string]bool // topic -> subscribed
}

// NewDeviceSubscriber creates a new device subscriber.
func NewDeviceSubscriber(client *Client, registry *DeviceRegistry) *DeviceSubscriber {
	return &DeviceSubscriber{
		client:     client,
		registry:   registry,
		subscribed: make(map[string]bool),
	}
}

// SubscribeDevice subscribes to a device's event topic if not already subscribed.
// This is idempotent - calling multiple times for the same device is safe.
func (s *DeviceSubscriber) SubscribeDevice(dev *RegisteredDevice) error {
	if dev.EventTopic == "" {
		return nil // No event topic to subscribe to
	}

	s.mu.Lock()
	if s.subscribed[dev.EventTopic] {
		s.mu.Unlock()
		return nil // Already subscribed
	}
	s.mu.Unlock()

	// Subscribe to the device's event topic
	handler := s.createHandler(dev.ControllerID, dev.LogicalID, dev.EventTopic)
	if err := s.client.Subscribe(dev.EventTopic, handler); err != nil {
		return err
	}

	s.mu.Lock()
	s.subscribed[dev.EventTopic] = true
	s.mu.Unlock()

	return nil
}

// SubscribeAll subscribes to all devices in the registry.
// Useful for initial subscription after connection.
func (s *DeviceSubscriber) SubscribeAll() error {
	devices := s.registry.All()
	for _, dev := range devices {
		if err := s.SubscribeDevice(dev); err != nil {
			// Log error but continue with other devices
			events.Emit("error", "device.error", "failed to subscribe to device events", map[string]interface{}{
				"logical_id": dev.LogicalID,
				"topic":      dev.EventTopic,
				"error":      err.Error(),
			})
		}
	}
	return nil
}

// createHandler creates a message handler that emits device.input events.
func (s *DeviceSubscriber) createHandler(controllerID, logicalID, topic string) paho.MessageHandler {
	return func(client paho.Client, msg paho.Message) {
		// Parse the payload as JSON if possible
		var payload interface{}
		if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
			// If not valid JSON, use raw string
			payload = string(msg.Payload())
		}

		events.Emit("info", "device.input", "", map[string]interface{}{
			"controller_id": controllerID,
			"logical_id":    logicalID,
			"topic":         topic,
			"payload":       payload,
		})
	}
}

// IsSubscribed returns true if the topic is already subscribed.
func (s *DeviceSubscriber) IsSubscribed(topic string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.subscribed[topic]
}

// SubscribedTopics returns a list of all subscribed topics.
func (s *DeviceSubscriber) SubscribedTopics() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	topics := make([]string, 0, len(s.subscribed))
	for topic := range s.subscribed {
		topics = append(topics, topic)
	}
	return topics
}

// ClearSubscriptions clears the subscription tracking.
// Call this on disconnect to allow re-subscription on reconnect.
func (s *DeviceSubscriber) ClearSubscriptions() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscribed = make(map[string]bool)
}
