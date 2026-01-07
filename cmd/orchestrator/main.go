package main

import (
	"fmt"
	"os"

	"github.com/AaronLay10/SentientEngine/internal/config"
	"github.com/AaronLay10/SentientEngine/internal/events"
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

	hostname, _ := os.Hostname()
	emit("info", "system.startup", "orchestrator starting", map[string]interface{}{
		"service":  "orchestrator",
		"hostname": hostname,
		"pid":      os.Getpid(),
		"room_id":  roomCfg.Room.ID,
		"revision": roomCfg.Room.Revision,
	})
}
