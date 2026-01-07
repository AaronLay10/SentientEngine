package main

import (
	"log"

	"github.com/AaronLay10/SentientEngine/internal/api"
	"github.com/AaronLay10/SentientEngine/internal/config"
)

func main() {
	roomCfg, err := config.LoadRoomConfig("rooms/_template/room.yaml")
	if err != nil {
		log.Fatalf("failed to load room.yaml: %v", err)
	}

	port := roomCfg.UIPort()
	log.Printf("API listening on :%d\n", port)

	if err := api.ListenAndServe(port); err != nil {
		log.Fatalf("api server failed: %v", err)
	}
}
