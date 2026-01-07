package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/AaronLay10/SentientEngine/internal/api"
	"github.com/AaronLay10/SentientEngine/internal/config"
	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/orchestrator"
)

func emit(level, event, msg string, fields map[string]interface{}) {
	b, err := events.Emit(level, event, msg, fields)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
}

func main() {
	roomCfg, err := config.LoadRoomConfig("rooms/_template/room.yaml")
	if err != nil {
		emit("error", "system.error", "failed to load room.yaml", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	_, err = config.LoadDevicesConfig("rooms/_template/devices.yaml")
	if err != nil {
		emit("error", "system.error", "failed to load devices.yaml", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	// Load scene graph
	sg, err := orchestrator.LoadSceneGraph("design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		emit("error", "system.error", "failed to load scene graph", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}

	// Create runtime and start scene
	rt := orchestrator.NewRuntime(sg)
	if len(sg.Scenes) > 0 {
		_ = rt.StartScene(sg.Scenes[0].ID)
	}

	// Register runtime with API for node validation
	api.SetNodeValidator(rt)

	// Start API server in goroutine (shares event buffer with orchestrator)
	api.Start(roomCfg.UIPort())

	hostname, _ := os.Hostname()
	emit("info", "system.startup", "orchestrator starting", map[string]interface{}{
		"service":  "orchestrator",
		"hostname": hostname,
		"pid":      os.Getpid(),
		"room_id":  roomCfg.Room.ID,
		"revision": roomCfg.Room.Revision,
		"scenes":   len(sg.Scenes),
		"ui_port":  roomCfg.UIPort(),
	})

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
}
