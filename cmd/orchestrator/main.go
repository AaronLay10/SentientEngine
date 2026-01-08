package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"

	"github.com/AaronLay10/SentientEngine/internal/api"
	"github.com/AaronLay10/SentientEngine/internal/config"
	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/mqtt"
	"github.com/AaronLay10/SentientEngine/internal/orchestrator"
	"github.com/AaronLay10/SentientEngine/internal/storage/postgres"
)

func emit(level, event, msg string, fields map[string]interface{}) {
	b, err := events.Emit(level, event, msg, fields)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
}

// configDir returns the config directory from SENTIENT_CONFIG_DIR or default.
func configDir() string {
	if dir := os.Getenv("SENTIENT_CONFIG_DIR"); dir != "" {
		return dir
	}
	return "/config"
}

// sceneGraphPath returns the scene graph path from SENTIENT_SCENE_GRAPH_PATH or default.
func sceneGraphPath() string {
	if path := os.Getenv("SENTIENT_SCENE_GRAPH_PATH"); path != "" {
		return path
	}
	return "/config/graphs/scene-graph.v1.json"
}

func main() {
	cfgDir := configDir()

	roomCfg, err := config.LoadRoomConfig(cfgDir + "/room.yaml")
	if err != nil {
		emit("error", "system.error", "failed to load room.yaml", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	devCfg, err := config.LoadDevicesConfig(cfgDir + "/devices.yaml")
	if err != nil {
		emit("error", "system.error", "failed to load devices.yaml", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	// Convert device config to specs for MQTT validation
	deviceSpecs := make(map[string]mqtt.DeviceSpec)
	for id, dev := range devCfg.Devices {
		deviceSpecs[id] = mqtt.DeviceSpecFromConfig(dev.Type, dev.Required, dev.Capabilities)
	}

	// Load scene graph
	sg, err := orchestrator.LoadSceneGraph(sceneGraphPath())
	if err != nil {
		emit("error", "system.error", "failed to load scene graph", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	// Initialize Postgres for event persistence (before runtime, for restore)
	var pgConnected bool
	pgClient, err := postgres.New(roomCfg.Room.ID)
	if err != nil {
		emit("error", "system.error", "postgres connection failed", map[string]interface{}{
			"error": err.Error(),
		})
		// Continue without postgres per requirement
	} else {
		pgConnected = true
		events.SetPostgresClient(pgClient)
		defer pgClient.Close()
	}

	// Create runtime
	rt := orchestrator.NewRuntime(sg)

	// Restore state from Postgres if connected
	var restored bool
	if pgConnected {
		state, count, err := orchestrator.RestoreFromEvents(pgClient, roomCfg.Room.ID, orchestrator.DefaultRestoreLimit)
		if err != nil {
			emit("error", "system.error", "failed to restore from events", map[string]interface{}{
				"error": err.Error(),
			})
		} else if state != nil {
			// Active session found - restore it
			if err := rt.ApplyRestoredState(state); err == nil {
				restored = true
				orchestrator.EmitStartupRestore(count, roomCfg.Room.ID)
			}
		}
	}

	// Start fresh scene only if no state was restored
	if !restored && len(sg.Scenes) > 0 {
		_ = rt.StartScene(sg.Scenes[0].ID)
	}

	// Register runtime with API for operator control
	api.SetRuntimeController(rt)

	// Start API server in goroutine (shares event buffer with orchestrator)
	api.Start(roomCfg.UIPort())

	// Start MQTT controller registration monitor
	monitor := mqtt.NewMonitor(deviceSpecs, 2.0) // 2x heartbeat tolerance
	monitor.Start(5 * time.Second)               // Check health every 5s

	mqttClient := mqtt.NewClient(roomCfg.Room.ID + "-orchestrator")
	mqttConnected := mqttClient.StartWithRetry("sentient/registration/#", func(client paho.Client, msg paho.Message) {
		payload, err := mqtt.ParseRegistration(msg.Payload())
		if err != nil {
			events.Emit("error", "device.error", "invalid registration payload", map[string]interface{}{
				"topic": msg.Topic(),
				"error": err.Error(),
			})
			return
		}
		monitor.HandleRegistration(payload)
	})
	if !mqttConnected {
		emit("error", "system.error", "mqtt broker not reachable", map[string]interface{}{
			"broker": mqtt.BrokerURL(),
		})
		// Continue running without MQTT per requirement
	}

	// Set up device input subscriber for event topic subscriptions
	if mqttConnected {
		deviceSubscriber := mqtt.NewDeviceSubscriber(mqttClient, monitor.DeviceRegistry())
		// Route device.input events to puzzle runtime
		deviceSubscriber.SetInputHandler(func(eventName string, fields map[string]interface{}) {
			rt.InjectEvent(eventName, fields)
		})
		monitor.SetSubscriber(deviceSubscriber)
	}

	// Set up action executor for device commands
	actionExecutor := orchestrator.NewActionExecutor(mqttClient, monitor.DeviceRegistry(), devCfg)
	rt.SetActionExecutor(actionExecutor)

	hostname, _ := os.Hostname()
	emit("info", "system.startup", "orchestrator starting", map[string]interface{}{
		"service":           "orchestrator",
		"hostname":          hostname,
		"pid":               os.Getpid(),
		"room_id":           roomCfg.Room.ID,
		"revision":          roomCfg.Room.Revision,
		"scenes":            len(sg.Scenes),
		"ui_port":           roomCfg.UIPort(),
		"mqtt_connected":    mqttConnected,
		"postgres_connected": pgConnected,
	})

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	// Cleanup
	monitor.Stop()
	if mqttConnected {
		mqttClient.Disconnect()
	}
}
