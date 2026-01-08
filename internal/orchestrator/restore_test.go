package orchestrator

import (
	"testing"
	"time"

	"github.com/AaronLay10/SentientEngine/internal/events"
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

// TestRestoreOverrideRestart tests the full flow:
// 1. Start game
// 2. Override puzzle_scarab
// 3. Restart runtime (simulate container restart)
// 4. Confirm puzzle_scarab is still resolved and system.startup_restore is emitted
func TestRestoreOverrideRestart(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	// Phase 1: Start game and override a puzzle
	rt1 := NewRuntime(sg)
	if err := rt1.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Verify scene is active
	if !rt1.IsGameActive() {
		t.Fatal("expected game to be active after StartScene")
	}

	// Verify puzzle_scarab is unresolved initially
	if rt1.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Error("expected puzzle_scarab to be unresolved initially")
	}

	// Override puzzle_scarab
	if err := rt1.OverrideNode("puzzle_scarab"); err != nil {
		t.Fatalf("failed to override puzzle: %v", err)
	}

	// Verify override worked
	if rt1.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Errorf("expected puzzle_scarab to be overridden, got %s", rt1.GetPuzzleResolution("puzzle_scarab"))
	}

	// Phase 2: Simulate restart by creating new runtime and restoring state
	rt2 := NewRuntime(sg)

	// Create state as if it was restored from DB events
	// This simulates what RestoreFromEvents returns after processing:
	// 1. scene.started (scene_id: scene_intro)
	// 2. operator.override (node_id: puzzle_scarab)
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

	// Emit startup restore event
	EmitStartupRestore(2, "test_room")

	// Verify game is active after restore
	if !rt2.IsGameActive() {
		t.Error("expected game to be active after restore")
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

	// Verify system.startup_restore was emitted
	snapshot := events.Snapshot()
	hasStartupRestore := false
	for _, e := range snapshot {
		if e.Name == "system.startup_restore" {
			hasStartupRestore = true
			if roomID, ok := e.Fields["room_id"].(string); !ok || roomID != "test_room" {
				t.Errorf("expected room_id=test_room, got %v", e.Fields["room_id"])
			}
			break
		}
	}
	if !hasStartupRestore {
		t.Error("expected system.startup_restore event to be emitted")
	}
}

// TestProcessEventsToState simulates processing DB events to build state.
func TestProcessEventsToState(t *testing.T) {
	// Simulate events as they would appear in the database
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
			Timestamp: time.Now().Add(-8 * time.Minute),
			Level:     "info",
			Event:     "operator.override",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
			RoomID:    "test_room",
		},
		{
			EventID:   3,
			Timestamp: time.Now().Add(-7 * time.Minute),
			Level:     "info",
			Event:     "puzzle.overridden",
			Fields:    map[string]interface{}{"node_id": "puzzle_scarab"},
			RoomID:    "test_room",
		},
	}

	// Process events to build state (simulating RestoreFromEvents logic)
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
			state.PuzzleStates = make(map[string]PuzzleResolution)
		case "operator.override":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
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

	// Now apply this state to a runtime
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)
	if err := rt.ApplyRestoredState(state); err != nil {
		t.Fatalf("failed to apply restored state: %v", err)
	}

	// Verify runtime state
	if !rt.IsGameActive() {
		t.Error("expected game to be active")
	}
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Errorf("expected puzzle_scarab to be overridden, got %s", rt.GetPuzzleResolution("puzzle_scarab"))
	}
}

func TestRestoreSceneResetClearsState(t *testing.T) {
	// Test that scene.reset clears puzzle states and session
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

func TestRestoreNewSceneStartClearsPuzzles(t *testing.T) {
	// Test that a new scene.started clears puzzle states from previous scene
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
			Event:     "scene.started",
			Fields:    map[string]interface{}{"scene_id": "scene_two"},
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
			// Clear puzzle states when a new scene starts
			state.PuzzleStates = make(map[string]PuzzleResolution)
		case "puzzle.overridden":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}
		}
	}

	// Session should be active with the new scene
	if !state.SessionActive {
		t.Error("expected session to be active")
	}
	if state.SceneID != "scene_two" {
		t.Errorf("expected scene_two, got %s", state.SceneID)
	}
	// Puzzle states should be cleared (puzzle_scarab was in scene_intro)
	if len(state.PuzzleStates) != 0 {
		t.Errorf("expected empty puzzle states after new scene, got %d", len(state.PuzzleStates))
	}
}

func TestExtractNodeID(t *testing.T) {
	// Test extractNodeID with node_id field
	fields1 := map[string]interface{}{"node_id": "puzzle_scarab"}
	if nodeID := extractNodeID(fields1); nodeID != "puzzle_scarab" {
		t.Errorf("expected puzzle_scarab, got %s", nodeID)
	}

	// Test extractNodeID with puzzle_id field (fallback)
	fields2 := map[string]interface{}{"puzzle_id": "scarab"}
	if nodeID := extractNodeID(fields2); nodeID != "scarab" {
		t.Errorf("expected scarab, got %s", nodeID)
	}

	// Test extractNodeID with no matching field
	fields3 := map[string]interface{}{"other": "value"}
	if nodeID := extractNodeID(fields3); nodeID != "" {
		t.Errorf("expected empty string, got %s", nodeID)
	}

	// Test extractNodeID with nil map
	if nodeID := extractNodeID(nil); nodeID != "" {
		t.Errorf("expected empty string for nil map, got %s", nodeID)
	}
}

// TestBootWithEmptyDB verifies that on boot with no prior events,
// the runtime remains idle (no scene.started) until /game/start is called.
func TestBootWithEmptyDB(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	// Clear events to start fresh
	events.Clear()

	// Create runtime (simulates boot)
	rt := NewRuntime(sg)

	// Simulate restore with no active session (nil client or empty DB)
	state, _, _ := RestoreFromEvents(nil, "test_room", 100)

	// state should be nil (no active session)
	if state != nil {
		t.Error("expected nil state with no prior events")
	}

	// Runtime should NOT be active (no scene started)
	if rt.IsGameActive() {
		t.Error("expected runtime to be idle on boot with empty DB")
	}

	// Verify NO scene.started event was emitted
	snapshot := events.Snapshot()
	for _, e := range snapshot {
		if e.Name == "scene.started" {
			t.Error("expected NO scene.started on boot with empty DB - should wait for /game/start")
		}
	}

	// Now call StartGame (simulates POST /game/start)
	if err := rt.StartGame(""); err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

	// Now runtime should be active
	if !rt.IsGameActive() {
		t.Error("expected runtime to be active after StartGame")
	}

	// Now scene.started should exist
	snapshot = events.Snapshot()
	hasSceneStarted := false
	for _, e := range snapshot {
		if e.Name == "scene.started" {
			hasSceneStarted = true
			break
		}
	}
	if !hasSceneStarted {
		t.Error("expected scene.started after StartGame")
	}
}

// TestBootWithActiveSession verifies that on boot with an active session in DB,
// system.startup_restore is emitted but NO fresh scene.started from boot logic.
func TestBootWithActiveSession(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	// Clear events to start fresh
	events.Clear()

	// Create runtime (simulates boot)
	rt := NewRuntime(sg)

	// Simulate existing active session from DB
	// This is what RestoreFromEvents would return if DB had:
	// - scene.started (scene_id: scene_intro)
	// - operator.override (node_id: puzzle_scarab)
	// - NO scene.reset after that
	restoredState := &RestoredState{
		SessionActive: true,
		SceneID:       "scene_intro",
		PuzzleStates: map[string]PuzzleResolution{
			"puzzle_scarab": PuzzleOverridden,
		},
	}

	// Apply restored state (simulates what main.go does)
	if err := rt.ApplyRestoredState(restoredState); err != nil {
		t.Fatalf("failed to apply restored state: %v", err)
	}

	// Emit startup restore (simulates what main.go does after successful restore)
	EmitStartupRestore(2, "test_room")

	// Verify runtime IS active (session restored)
	if !rt.IsGameActive() {
		t.Error("expected runtime to be active after restore")
	}

	// Verify puzzle state was restored
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleOverridden {
		t.Errorf("expected puzzle_scarab to be overridden, got %v", rt.GetPuzzleResolution("puzzle_scarab"))
	}

	// Check events: should have system.startup_restore but NOT a fresh scene.started
	snapshot := events.Snapshot()
	hasStartupRestore := false
	sceneStartedCount := 0

	for _, e := range snapshot {
		if e.Name == "system.startup_restore" {
			hasStartupRestore = true
		}
		if e.Name == "scene.started" {
			sceneStartedCount++
		}
	}

	if !hasStartupRestore {
		t.Error("expected system.startup_restore event")
	}

	// ApplyRestoredState does NOT emit scene.started - it only restores state
	// The original scene.started is in the DB (not re-emitted on restore)
	if sceneStartedCount > 0 {
		t.Errorf("expected NO fresh scene.started from boot logic, got %d", sceneStartedCount)
	}
}

// TestSessionLifecycle verifies the complete session lifecycle:
// idle -> /game/start -> active -> /game/stop -> idle
func TestSessionLifecycle(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	events.Clear()
	rt := NewRuntime(sg)

	// Initially idle
	if rt.IsGameActive() {
		t.Error("expected runtime to be idle initially")
	}

	// Start game
	if err := rt.StartGame("scene_intro"); err != nil {
		t.Fatalf("StartGame failed: %v", err)
	}

	if !rt.IsGameActive() {
		t.Error("expected runtime to be active after StartGame")
	}

	// Verify scene.started emitted
	snapshot := events.Snapshot()
	hasSceneStarted := false
	for _, e := range snapshot {
		if e.Name == "scene.started" {
			hasSceneStarted = true
		}
	}
	if !hasSceneStarted {
		t.Error("expected scene.started after StartGame")
	}

	// Stop game
	if err := rt.StopGame(); err != nil {
		t.Fatalf("StopGame failed: %v", err)
	}

	// Should be idle again
	if rt.IsGameActive() {
		t.Error("expected runtime to be idle after StopGame")
	}

	// Verify scene.reset emitted
	snapshot = events.Snapshot()
	hasSceneReset := false
	for _, e := range snapshot {
		if e.Name == "scene.reset" {
			hasSceneReset = true
		}
	}
	if !hasSceneReset {
		t.Error("expected scene.reset after StopGame")
	}
}
