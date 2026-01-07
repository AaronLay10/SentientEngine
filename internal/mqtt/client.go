package mqtt

import (
	"log"
	"os"
	"sync"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"
)

// Client wraps the Paho MQTT client for Sentient Engine.
type Client struct {
	client paho.Client
	mu     sync.Mutex
}

// BrokerURL returns the MQTT broker URL from env or default.
func BrokerURL() string {
	if url := os.Getenv("MQTT_URL"); url != "" {
		return url
	}
	return "tcp://localhost:1883"
}

// NewClient creates a new MQTT client but does not connect.
func NewClient(clientID string) *Client {
	opts := paho.NewClientOptions().
		AddBroker(BrokerURL()).
		SetClientID(clientID).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetKeepAlive(30 * time.Second)

	return &Client{
		client: paho.NewClient(opts),
	}
}

// Connect attempts to connect to the broker.
// Returns an error if connection fails, but does not block indefinitely.
func (c *Client) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	token := c.client.Connect()
	if !token.WaitTimeout(10 * time.Second) {
		return &ConnectTimeoutError{}
	}
	if err := token.Error(); err != nil {
		return err
	}
	return nil
}

// Subscribe subscribes to a topic with the given handler.
func (c *Client) Subscribe(topic string, handler paho.MessageHandler) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	token := c.client.Subscribe(topic, 1, handler)
	if !token.WaitTimeout(10 * time.Second) {
		return &SubscribeTimeoutError{Topic: topic}
	}
	return token.Error()
}

// Disconnect cleanly disconnects from the broker.
func (c *Client) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.client.Disconnect(1000)
}

// IsConnected returns true if the client is connected.
func (c *Client) IsConnected() bool {
	return c.client.IsConnected()
}

// ConnectTimeoutError indicates connection timed out.
type ConnectTimeoutError struct{}

func (e *ConnectTimeoutError) Error() string {
	return "mqtt connect timeout"
}

// SubscribeTimeoutError indicates subscription timed out.
type SubscribeTimeoutError struct {
	Topic string
}

func (e *SubscribeTimeoutError) Error() string {
	return "mqtt subscribe timeout: " + e.Topic
}

// StartWithRetry attempts to connect and subscribe, logging errors but not crashing.
// Returns true if connected, false otherwise.
func (c *Client) StartWithRetry(topic string, handler paho.MessageHandler) bool {
	if err := c.Connect(); err != nil {
		log.Printf("mqtt: failed to connect to %s: %v", BrokerURL(), err)
		return false
	}

	if err := c.Subscribe(topic, handler); err != nil {
		log.Printf("mqtt: failed to subscribe to %s: %v", topic, err)
		return false
	}

	log.Printf("mqtt: connected and subscribed to %s", topic)
	return true
}
