package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
)

// LoadSceneGraph loads a scene graph from a JSON file.
func LoadSceneGraph(path string) (*SceneGraph, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read scene graph file: %w", err)
	}

	var sg SceneGraph
	if err := json.Unmarshal(data, &sg); err != nil {
		return nil, fmt.Errorf("failed to parse scene graph JSON: %w", err)
	}

	if sg.Version != 1 {
		return nil, fmt.Errorf("unsupported scene graph version: %d", sg.Version)
	}

	return &sg, nil
}
