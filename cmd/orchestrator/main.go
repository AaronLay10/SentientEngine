package main

import (
	"fmt"
	"log"
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

const shutdownTimeout = 10 * time.Second

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
	var pgClient *postgres.Client
	pgClient, err = postgres.New(roomCfg.Room.ID)
	if err != nil {
		emit("error", "system.error", "postgres connection failed", map[string]interface{}{
			"error": err.Error(),
		})
		// Continue without postgres per requirement (mark as optional)
		api.SetPostgresState(false, true)
	} else {
		pgConnected = true
		events.SetPostgresClient(pgClient)
		api.SetPostgresState(true, false)
		// Note: pgClient.Close() is called explicitly during graceful shutdown
	}

	// Create runtime
	rt := orchestrator.NewRuntime(sg)

	// Restore state from Postgres if connected (active session only)
	// If no active session found, runtime stays idle until /game/start
	if pgConnected {
		state, count, err := orchestrator.RestoreFromEvents(pgClient, roomCfg.Room.ID, orchestrator.DefaultRestoreLimit)
		if err != nil {
			emit("error", "system.error", "failed to restore from events", map[string]interface{}{
				"error": err.Error(),
			})
		} else if state != nil {
			// Active session found - restore it (no new scene.started emitted)
			if err := rt.ApplyRestoredState(state); err == nil {
				orchestrator.EmitStartupRestore(count, roomCfg.Room.ID)
			}
		}
		// If state == nil, no active session - remain idle until /game/start
	}
	// If postgres not connected, remain idle until /game/start

	// Register runtime with API for operator control
	api.SetRuntimeController(rt)

	// Start API server in goroutine with graceful shutdown support
	apiServer := api.StartServer(roomCfg.UIPort())

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
		// Continue running without MQTT per requirement (mark as optional)
		api.SetMQTTState(false, true)
	} else {
		api.SetMQTTState(true, false)
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
		"service":            "orchestrator",
		"hostname":           hostname,
		"pid":                os.Getpid(),
		"room_id":            roomCfg.Room.ID,
		"revision":           roomCfg.Room.Revision,
		"scenes":             len(sg.Scenes),
		"ui_port":            roomCfg.UIPort(),
		"mqtt_connected":     mqttConnected,
		"postgres_connected": pgConnected,
	})

	// Mark orchestrator as ready for /ready endpoint
	api.SetOrchestratorReady(true)

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	// Begin graceful shutdown
	log.Printf("Received signal %v, starting graceful shutdown...", sig)

	// Mark as not ready (stop accepting traffic)
	api.SetOrchestratorReady(false)

	// Emit system.shutdown event (registry-approved)
	emit("info", "system.shutdown", "orchestrator shutting down", map[string]interface{}{
		"signal":   sig.String(),
		"hostname": hostname,
	})

	// Stop monitor first (stops health checks)
	monitor.Stop()

	// Shutdown API server gracefully (closes WebSockets, waits for requests)
	if err := api.Shutdown(apiServer, shutdownTimeout); err != nil {
		log.Printf("API shutdown error: %v", err)
	}

	// Disconnect MQTT
	if mqttConnected {
		mqttClient.Disconnect()
	}

	// Close Postgres connection
	if pgClient != nil {
		pgClient.Close()
	}

	log.Printf("Graceful shutdown complete")
}
