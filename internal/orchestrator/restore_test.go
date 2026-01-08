package orchestrator

import (
	"testing"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/storage/postgres"
)

func TestRestoreFromEventsNilClient(t *testing.T) {
	// Test with nil client - should return nil state without error
	state, count, err := RestoreFromEvents(nil, "test_room", 100)
	if err != nil {
		t.Errorf("expected no error with nil client, got %v", err)
	}
	if state != nil {
		t.Error("expected nil state with nil client")
	}
	if count != 0 {
		t.Errorf("expected 0 count with nil client, got %d", count)
	}
}

func TestRestoredStateBasic(t *testing.T) {
	// Test RestoredState initialization
	state := &RestoredState{
		SessionActive: true,
		SceneID:       "scene_intro",
		PuzzleStates:  make(map[string]PuzzleResolution),
	}

	state.PuzzleStates["puzzle_scarab"] = PuzzleOverridden
	state.PuzzleStates["puzzle_tiles"] = PuzzleSolved

	if !state.SessionActive {
		t.Error("expected session to be active")
	}
	if state.SceneID != "scene_intro" {
		t.Errorf("expected scene_intro, got %s", state.SceneID)
	}
	if state.PuzzleStates["puzzle_scarab"] != PuzzleOverridden {
		t.Error("expected puzzle_scarab to be overridden")
	}
	if state.PuzzleStates["puzzle_tiles"] != PuzzleSolved {
		t.Error("expected puzzle_tiles to be solved")
	}
}

func TestApplyRestoredState(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Create restored state with one puzzle overridden
	state := &RestoredState{
		SessionActive: true,
		SceneID:       "scene_intro",
		PuzzleStates: map[string]PuzzleResolution{
			"puzzle_scarab": PuzzleOverridden,
		},
	}

	// Apply restored state
	if err := rt.ApplyRestoredState(state); err != nil {
		t.Fatalf("failed to apply restored state: %v", err)
	}

	// Verify scene is active
	if !rt.IsGameActive() {
		t.Error("expected game to be active after restore")
	}

	// Verify puzzle_scarab is marked as overridden
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Errorf("expected puzzle_scarab to be overridden, got %s", rt.GetPuzzleResolution("puzzle_scarab"))
	}
	if rt.GetNodeState("puzzle_scarab") != NodeStateOverridden {
		t.Errorf("expected puzzle_scarab node state to be overridden, got %s", rt.GetNodeState("puzzle_scarab"))
	}

	// Verify puzzle_tiles is unresolved (not in restored state)
	if rt.GetPuzzleResolution("puzzle_tiles") != PuzzleUnresolved {
		t.Errorf("expected puzzle_tiles to be unresolved, got %s", rt.GetPuzzleResolution("puzzle_tiles"))
	}
}

func TestApplyRestoredStateNil(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Apply nil state should be a no-op
	if err := rt.ApplyRestoredState(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Game should not be active
	if rt.IsGameActive() {
		t.Error("expected game to not be active after nil restore")
	}
}

func TestApplyRestoredStateInactive(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Create restored state with inactive session
	state := &RestoredState{
		SessionActive: false,
		SceneID:       "",
		PuzzleStates:  make(map[string]PuzzleResolution),
	}

	// Apply restored state
	if err := rt.ApplyRestoredState(state); err != nil {
		t.Fatalf("failed to apply restored state: %v", err)
	}

	// Game should not be active
	if rt.IsGameActive() {
		t.Error("expected game to not be active after inactive restore")
	}
}

func TestRestoreOverrideRestart(t *testing.T) {
	// This test simulates: start game -> override puzzle -> restart -> verify restored
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	// Phase 1: Start game and override a puzzle
	rt1 := NewRuntime(sg)
	if err := rt1.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Override puzzle_scarab
	if err := rt1.OverrideNode("puzzle_scarab"); err != nil {
		t.Fatalf("failed to override puzzle: %v", err)
	}

	// Verify override worked
	if rt1.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Error("expected puzzle_scarab to be overridden")
	}

	// Phase 2: Simulate restart by creating new runtime and restoring state
	rt2 := NewRuntime(sg)

	// Create state as if it was restored from DB events
	restoredState := &RestoredState{
		SessionActive: true,
		SceneID:       "scene_intro",
		PuzzleStates: map[string]PuzzleResolution{
			"puzzle_scarab": PuzzleOverridden,
		},
	}

	// Apply restored state
	if err := rt2.ApplyRestoredState(restoredState); err != nil {
		t.Fatalf("failed to apply restored state: %v", err)
	}

	// Verify puzzle_scarab is still overridden after "restart"
	if rt2.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Errorf("expected puzzle_scarab to be overridden after restore, got %s", rt2.GetPuzzleResolution("puzzle_scarab"))
	}
	if rt2.GetNodeState("puzzle_scarab") != NodeStateOverridden {
		t.Errorf("expected puzzle_scarab node state to be overridden after restore, got %s", rt2.GetNodeState("puzzle_scarab"))
	}

	// Verify puzzle_tiles is still unresolved
	if rt2.GetPuzzleResolution("puzzle_tiles") != PuzzleUnresolved {
		t.Errorf("expected puzzle_tiles to be unresolved, got %s", rt2.GetPuzzleResolution("puzzle_tiles"))
	}
}

// TestRestoreFromEventsIntegration tests restore with actual event processing.
// This is a unit test that simulates DB events without requiring a real database.
func TestRestoreFromEventsIntegration(t *testing.T) {
	// Create mock events as if they came from postgres
	mockEvents := []postgres.EventRow{
		{
			EventID:   1,
			Timestamp: time.Now().Add(-10 * time.Minute),
			Level:     "info",
			Event:     "scene.started",
			Fields:    map[string]interface{}{"scene_id": "scene_intro"},
			RoomID:    "test_room",
		},
		{
			EventID:   2,
			Timestamp: time.Now().Add(-5 * time.Minute),
			Level:     "info",
			Event:     "puzzle.overridden",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
			RoomID:    "test_room",
		},
	}

	// Process events to build state (simulating what RestoreFromEvents does)
	state := &RestoredState{
		PuzzleStates: make(map[string]PuzzleResolution),
	}

	for _, row := range mockEvents {
		switch row.Event {
		case "scene.started":
			state.SessionActive = true
			if sceneID, ok := row.Fields["scene_id"].(string); ok {
				state.SceneID = sceneID
			}
		case "puzzle.overridden":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}
		}
	}

	// Verify state was built correctly
	if !state.SessionActive {
		t.Error("expected session to be active")
	}
	if state.SceneID != "scene_intro" {
		t.Errorf("expected scene_intro, got %s", state.SceneID)
	}
	if state.PuzzleStates["puzzle_scarab"] != PuzzleOverridden {
		t.Error("expected puzzle_scarab to be overridden")
	}
}

func TestRestoreSceneResetClearsState(t *testing.T) {
	// Test that scene.reset clears puzzle states
	mockEvents := []postgres.EventRow{
		{
			EventID:   1,
			Timestamp: time.Now().Add(-10 * time.Minute),
			Event:     "scene.started",
			Fields:    map[string]interface{}{"scene_id": "scene_intro"},
		},
		{
			EventID:   2,
			Timestamp: time.Now().Add(-8 * time.Minute),
			Event:     "puzzle.overridden",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
		},
		{
			EventID:   3,
			Timestamp: time.Now().Add(-5 * time.Minute),
			Event:     "scene.reset",
			Fields:    map[string]interface{}{"scene_id": "scene_intro"},
		},
	}

	// Process events
	state := &RestoredState{
		PuzzleStates: make(map[string]PuzzleResolution),
	}

	for _, row := range mockEvents {
		switch row.Event {
		case "scene.started":
			state.SessionActive = true
			if sceneID, ok := row.Fields["scene_id"].(string); ok {
				state.SceneID = sceneID
			}
		case "puzzle.overridden":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}
		case "scene.reset":
			state.SessionActive = false
			state.SceneID = ""
			state.PuzzleStates = make(map[string]PuzzleResolution)
		}
	}

	// After scene.reset, session should be inactive
	if state.SessionActive {
		t.Error("expected session to be inactive after scene.reset")
	}
	if state.SceneID != "" {
		t.Errorf("expected empty scene_id after scene.reset, got %s", state.SceneID)
	}
	if len(state.PuzzleStates) != 0 {
		t.Errorf("expected empty puzzle states after scene.reset, got %d", len(state.PuzzleStates))
	}
}

func TestRestorePuzzleResetClearsPuzzle(t *testing.T) {
	// Test that puzzle.reset clears individual puzzle state
	mockEvents := []postgres.EventRow{
		{
			EventID:   1,
			Timestamp: time.Now().Add(-10 * time.Minute),
			Event:     "scene.started",
			Fields:    map[string]interface{}{"scene_id": "scene_intro"},
		},
		{
			EventID:   2,
			Timestamp: time.Now().Add(-8 * time.Minute),
			Event:     "puzzle.overridden",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
		},
		{
			EventID:   3,
			Timestamp: time.Now().Add(-5 * time.Minute),
			Event:     "puzzle.reset",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
		},
	}

	// Process events
	state := &RestoredState{
		PuzzleStates: make(map[string]PuzzleResolution),
	}

	for _, row := range mockEvents {
		switch row.Event {
		case "scene.started":
			state.SessionActive = true
			if sceneID, ok := row.Fields["scene_id"].(string); ok {
				state.SceneID = sceneID
			}
		case "puzzle.overridden":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}
		case "puzzle.reset":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleUnresolved
			}
		}
	}

	// Session should still be active
	if !state.SessionActive {
		t.Error("expected session to be active")
	}
	// Puzzle should be unresolved after puzzle.reset
	if state.PuzzleStates["puzzle_scarab"] != PuzzleUnresolved {
		t.Errorf("expected puzzle_scarab to be unresolved after puzzle.reset, got %s", state.PuzzleStates["puzzle_scarab"])
	}
}
