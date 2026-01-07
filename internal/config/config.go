package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type RoomConfig struct {
	Version int `yaml:"version"`
	Room    struct {
		ID          string `yaml:"id"`
		Revision    string `yaml:"revision"`
		Name        string `yaml:"name"`
		Description string `yaml:"description"`
	} `yaml:"room"`
	Network struct {
		UIPort   int `yaml:"ui_port"`
		MQTTPort int `yaml:"mqtt_port"`
		DBPort   int `yaml:"db_port"`
	} `yaml:"network"`
}

// UIPort returns the configured UI port, defaulting to 8080 if not set.
func (c *RoomConfig) UIPort() int {
	if c.Network.UIPort == 0 {
		return 8080
	}
	return c.Network.UIPort
}

type DevicesConfig struct {
	Version int                    `yaml:"version"`
	Devices map[string]interface{} `yaml:"devices"`
}

func LoadRoomConfig(path string) (*RoomConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg RoomConfig
	if err := yaml.Unmarshal(b, &cfg); err != nil {
		return nil, err
	}

	if cfg.Version != 1 {
		return nil, fmt.Errorf("unsupported room.yaml version: %d", cfg.Version)
	}

	return &cfg, nil
}

func LoadDevicesConfig(path string) (*DevicesConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg DevicesConfig
	if err := yaml.Unmarshal(b, &cfg); err != nil {
		return nil, err
	}

	if cfg.Version != 1 {
		return nil, fmt.Errorf("unsupported devices.yaml version: %d", cfg.Version)
	}

	return &cfg, nil
}
