package orchestrator

import (
	"testing"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

func TestLoadSceneGraph(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	if sg.Version != 1 {
		t.Errorf("expected version 1, got %d", sg.Version)
	}

	if len(sg.Scenes) != 1 {
		t.Errorf("expected 1 scene, got %d", len(sg.Scenes))
	}

	scene := sg.Scenes[0]
	if scene.ID != "scene_intro" {
		t.Errorf("expected scene_intro, got %s", scene.ID)
	}

	if len(scene.Subgraphs) != 2 {
		t.Errorf("expected 2 subgraphs, got %d", len(scene.Subgraphs))
	}
}

func TestMVPPuzzleFlow(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Start the intro scene
	if err := rt.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Verify entry node is active (parallel)
	if rt.GetNodeState("start_parallel") != NodeStateActive {
		t.Errorf("expected start_parallel to be active")
	}

	// Verify both puzzles are activated
	if rt.GetNodeState("puzzle_scarab") != NodeStateActive {
		t.Errorf("expected puzzle_scarab to be active")
	}
	if rt.GetNodeState("puzzle_tiles") != NodeStateActive {
		t.Errorf("expected puzzle_tiles to be active")
	}

	// Verify puzzles are unresolved
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Errorf("expected puzzle_scarab to be unresolved")
	}
	if rt.GetPuzzleResolution("puzzle_tiles") != PuzzleUnresolved {
		t.Errorf("expected puzzle_tiles to be unresolved")
	}

	// Verify scene_complete is still idle
	if rt.GetNodeState("scene_complete") != NodeStateIdle {
		t.Errorf("expected scene_complete to be idle before puzzles solved")
	}

	// Inject puzzle.solved for scarab
	rt.InjectEvent("puzzle.solved", map[string]interface{}{
		"puzzle_id": "scarab",
	})

	// Verify scarab is now solved
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleSolved {
		t.Errorf("expected puzzle_scarab to be solved")
	}
	if rt.GetNodeState("puzzle_scarab") != NodeStateCompleted {
		t.Errorf("expected puzzle_scarab node to be completed")
	}

	// scene_complete should still be idle (tiles not solved yet)
	if rt.GetNodeState("scene_complete") != NodeStateIdle {
		t.Errorf("expected scene_complete to still be idle (tiles not solved)")
	}

	// Inject puzzle.solved for tiles
	rt.InjectEvent("puzzle.solved", map[string]interface{}{
		"puzzle_id": "tiles",
	})

	// Verify tiles is now solved
	if rt.GetPuzzleResolution("puzzle_tiles") != PuzzleSolved {
		t.Errorf("expected puzzle_tiles to be solved")
	}
	if rt.GetNodeState("puzzle_tiles") != NodeStateCompleted {
		t.Errorf("expected puzzle_tiles node to be completed")
	}

	// Verify parallel is now completed (all children done)
	if rt.GetNodeState("start_parallel") != NodeStateCompleted {
		t.Errorf("expected start_parallel to be completed")
	}

	// Verify scene_complete is now active/completed (edge condition satisfied)
	sceneCompleteState := rt.GetNodeState("scene_complete")
	if sceneCompleteState != NodeStateCompleted {
		t.Errorf("expected scene_complete to be completed, got %s", sceneCompleteState)
	}
}

func TestEventEmission(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	if err := rt.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	snapshot := events.Snapshot()

	// Check that key events were emitted
	hasSceneStarted := false
	hasPuzzleActivatedScarab := false
	hasPuzzleActivatedTiles := false

	for _, e := range snapshot {
		if e.Name == "scene.started" {
			hasSceneStarted = true
		}
		if e.Name == "puzzle.activated" {
			if nodeID, ok := e.Fields["node_id"]; ok {
				if nodeID == "puzzle_scarab" {
					hasPuzzleActivatedScarab = true
				}
				if nodeID == "puzzle_tiles" {
					hasPuzzleActivatedTiles = true
				}
			}
		}
	}

	if !hasSceneStarted {
		t.Error("expected scene.started event")
	}
	if !hasPuzzleActivatedScarab {
		t.Error("expected puzzle.activated for puzzle_scarab")
	}
	if !hasPuzzleActivatedTiles {
		t.Error("expected puzzle.activated for puzzle_tiles")
	}
}

// TestGameLifecycleEvents verifies scene.started and scene.reset are emitted
// via events.Emit (which persists to Postgres when client is set).
func TestGameLifecycleEvents(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Start game via StartGame (simulates /game/start API call)
	if err := rt.StartGame("scene_intro"); err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

	snapshot := events.Snapshot()

	// Verify scene.started was emitted with correct scene_id
	hasSceneStarted := false
	for _, e := range snapshot {
		if e.Name == "scene.started" {
			hasSceneStarted = true
			if sceneID, ok := e.Fields["scene_id"].(string); !ok || sceneID != "scene_intro" {
				t.Errorf("expected scene_id=scene_intro, got %v", e.Fields["scene_id"])
			}
		}
	}
	if !hasSceneStarted {
		t.Error("expected scene.started event to be emitted via events.Emit")
	}

	// Stop game via StopGame (simulates /game/stop API call)
	if err := rt.StopGame(); err != nil {
		t.Fatalf("failed to stop game: %v", err)
	}

	snapshot = events.Snapshot()

	// Verify scene.reset was emitted with correct scene_id
	hasSceneReset := false
	for _, e := range snapshot {
		if e.Name == "scene.reset" {
			hasSceneReset = true
			if sceneID, ok := e.Fields["scene_id"].(string); !ok || sceneID != "scene_intro" {
				t.Errorf("expected scene_id=scene_intro, got %v", e.Fields["scene_id"])
			}
		}
	}
	if !hasSceneReset {
		t.Error("expected scene.reset event to be emitted via events.Emit")
	}

	// Verify game is no longer active
	if rt.IsGameActive() {
		t.Error("expected game to be inactive after StopGame")
	}
}

// TestStartGameEmitsSceneStarted verifies StartGame emits scene.started
func TestStartGameEmitsSceneStarted(t *testing.T) {
	sg, err := LoadSceneGraph("../../design/scene-graph/examples/mvp-scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Start game with empty scene_id (should use first scene)
	if err := rt.StartGame(""); err != nil {
		t.Fatalf("failed to start game: %v", err)
	}

	if !rt.IsGameActive() {
		t.Error("expected game to be active after StartGame")
	}

	// Check scene.started was emitted
	snapshot := events.Snapshot()
	found := false
	for _, e := range snapshot {
		if e.Name == "scene.started" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected scene.started event after StartGame")
	}
}

func TestConditionEvaluator(t *testing.T) {
	// Test empty condition
	if !EvalCondition("", nil) {
		t.Error("empty condition should return true")
	}

	// Test .resolved condition
	puzzleStates := map[string]*PuzzleStatus{
		"puzzle_scarab": {NodeID: "puzzle_scarab", Resolution: PuzzleSolved},
		"puzzle_tiles":  {NodeID: "puzzle_tiles", Resolution: PuzzleUnresolved},
	}
	ctx := &EvalContext{PuzzleStates: puzzleStates}

	if !EvalCondition("puzzle_scarab.resolved", ctx) {
		t.Error("puzzle_scarab.resolved should be true")
	}
	if EvalCondition("puzzle_tiles.resolved", ctx) {
		t.Error("puzzle_tiles.resolved should be false")
	}

	// Test AND condition
	if EvalCondition("puzzle_scarab.resolved && puzzle_tiles.resolved", ctx) {
		t.Error("AND condition should be false when tiles is unresolved")
	}

	puzzleStates["puzzle_tiles"].Resolution = PuzzleSolved
	if !EvalCondition("puzzle_scarab.resolved && puzzle_tiles.resolved", ctx) {
		t.Error("AND condition should be true when both resolved")
	}

	// Test event condition
	eventCtx := &EvalContext{
		Event: &Event{
			Name:   "puzzle.solved",
			Fields: map[string]interface{}{"puzzle_id": "scarab"},
		},
	}
	if !EvalCondition("event == 'puzzle.solved'", eventCtx) {
		t.Error("event == 'puzzle.solved' should match")
	}
	if !EvalCondition("puzzle_id == 'scarab'", eventCtx) {
		t.Error("puzzle_id == 'scarab' should match")
	}
	if EvalCondition("puzzle_id == 'tiles'", eventCtx) {
		t.Error("puzzle_id == 'tiles' should not match")
	}
}

// TestNestedFieldEvaluation tests nested payload field matching for device.input
func TestNestedFieldEvaluation(t *testing.T) {
	// Test device.input with nested payload
	deviceInputCtx := &EvalContext{
		Event: &Event{
			Name: "device.input",
			Fields: map[string]interface{}{
				"controller_id": "ctrl-001",
				"logical_id":    "scarab_sensor",
				"topic":         "devices/ctrl-001/scarab_sensor/events",
				"payload": map[string]interface{}{
					"signal": "triggered",
					"value":  true,
				},
			},
		},
	}

	// Test event name matching
	if !EvalCondition("event == 'device.input'", deviceInputCtx) {
		t.Error("event == 'device.input' should match")
	}

	// Test logical_id matching
	if !EvalCondition("logical_id == 'scarab_sensor'", deviceInputCtx) {
		t.Error("logical_id == 'scarab_sensor' should match")
	}

	// Test nested payload.signal matching
	if !EvalCondition("payload.signal == 'triggered'", deviceInputCtx) {
		t.Error("payload.signal == 'triggered' should match")
	}

	// Test nested payload.value matching (boolean)
	if !EvalCondition("payload.value == 'true'", deviceInputCtx) {
		t.Error("payload.value == 'true' should match")
	}

	// Test combined condition
	if !EvalCondition("event == 'device.input' && logical_id == 'scarab_sensor' && payload.signal == 'triggered'", deviceInputCtx) {
		t.Error("combined device.input condition should match")
	}

	// Test non-matching signal
	if EvalCondition("payload.signal == 'released'", deviceInputCtx) {
		t.Error("payload.signal == 'released' should not match")
	}

	// Test non-matching device
	if EvalCondition("logical_id == 'other_sensor'", deviceInputCtx) {
		t.Error("logical_id == 'other_sensor' should not match")
	}
}

// TestDeviceInputPuzzleResolution tests that device.input events can resolve puzzles
func TestDeviceInputPuzzleResolution(t *testing.T) {
	// Create a scene graph with a puzzle that responds to device.input
	sg := &SceneGraph{
		Version: 1,
		Scenes: []Scene{
			{
				ID:    "scene_device_test",
				Name:  "Device Test",
				Entry: "puzzle_sensor",
				Nodes: []Node{
					{
						ID:   "puzzle_sensor",
						Type: "puzzle",
						Config: map[string]interface{}{
							"subgraph": "sensor_puzzle_v1",
							"required": true,
						},
					},
					{
						ID:     "scene_complete",
						Type:   "terminal",
						Config: map[string]interface{}{},
					},
				},
				Edges: []Edge{
					{From: "puzzle_sensor", To: "scene_complete", Condition: "puzzle_sensor.resolved"},
				},
				Subgraphs: []Subgraph{
					{
						ID:    "sensor_puzzle_v1",
						Entry: "sensor_wait",
						Nodes: []Node{
							{
								ID:   "sensor_wait",
								Type: "decision",
								Config: map[string]interface{}{
									"expression": "event == 'device.input' && logical_id == 'scarab_sensor' && payload.signal == 'triggered'",
								},
							},
							{
								ID:     "sensor_done",
								Type:   "terminal",
								Config: map[string]interface{}{},
							},
						},
						Edges: []Edge{
							{
								From:      "sensor_wait",
								To:        "sensor_done",
								Condition: "event == 'device.input' && logical_id == 'scarab_sensor' && payload.signal == 'triggered'",
							},
						},
					},
				},
			},
		},
	}

	rt := NewRuntime(sg)

	// Start scene
	if err := rt.StartScene("scene_device_test"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Verify puzzle is active and unresolved
	if rt.GetNodeState("puzzle_sensor") != NodeStateActive {
		t.Error("expected puzzle_sensor to be active")
	}
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleUnresolved {
		t.Error("expected puzzle_sensor to be unresolved")
	}

	// Verify scene_complete is still idle
	if rt.GetNodeState("scene_complete") != NodeStateIdle {
		t.Error("expected scene_complete to be idle before puzzle solved")
	}

	// Inject device.input event that does NOT match (wrong signal)
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "scarab_sensor",
		"topic":         "devices/ctrl-001/scarab_sensor/events",
		"payload": map[string]interface{}{
			"signal": "released",
			"value":  false,
		},
	})

	// Puzzle should still be unresolved
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleUnresolved {
		t.Error("expected puzzle_sensor to still be unresolved after non-matching event")
	}

	// Inject device.input event that matches
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "scarab_sensor",
		"topic":         "devices/ctrl-001/scarab_sensor/events",
		"payload": map[string]interface{}{
			"signal": "triggered",
			"value":  true,
		},
	})

	// Puzzle should now be solved
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleSolved {
		t.Errorf("expected puzzle_sensor to be solved, got %v", rt.GetPuzzleResolution("puzzle_sensor"))
	}
	if rt.GetNodeState("puzzle_sensor") != NodeStateCompleted {
		t.Errorf("expected puzzle_sensor node to be completed, got %v", rt.GetNodeState("puzzle_sensor"))
	}

	// Scene should now complete
	if rt.GetNodeState("scene_complete") != NodeStateCompleted {
		t.Errorf("expected scene_complete to be completed, got %v", rt.GetNodeState("scene_complete"))
	}

	// Verify puzzle.solved event was emitted
	snapshot := events.Snapshot()
	hasPuzzleSolved := false
	hasNodeCompleted := false
	for _, e := range snapshot {
		if e.Name == "puzzle.solved" {
			if puzzleID, ok := e.Fields["puzzle_id"].(string); ok && puzzleID == "puzzle_sensor" {
				hasPuzzleSolved = true
			}
		}
		if e.Name == "node.completed" {
			if nodeID, ok := e.Fields["node_id"].(string); ok && nodeID == "puzzle_sensor" {
				hasNodeCompleted = true
			}
		}
	}
	if !hasPuzzleSolved {
		t.Error("expected puzzle.solved event for puzzle_sensor")
	}
	if !hasNodeCompleted {
		t.Error("expected node.completed event for puzzle_sensor")
	}
}

// TestDeviceInputWrongDevice tests that device.input from wrong device doesn't resolve puzzle
func TestDeviceInputWrongDevice(t *testing.T) {
	sg := &SceneGraph{
		Version: 1,
		Scenes: []Scene{
			{
				ID:    "scene_device_test",
				Name:  "Device Test",
				Entry: "puzzle_sensor",
				Nodes: []Node{
					{
						ID:   "puzzle_sensor",
						Type: "puzzle",
						Config: map[string]interface{}{
							"subgraph": "sensor_puzzle_v1",
						},
					},
				},
				Subgraphs: []Subgraph{
					{
						ID:    "sensor_puzzle_v1",
						Entry: "sensor_wait",
						Nodes: []Node{
							{
								ID:     "sensor_wait",
								Type:   "decision",
								Config: map[string]interface{}{},
							},
							{
								ID:     "sensor_done",
								Type:   "terminal",
								Config: map[string]interface{}{},
							},
						},
						Edges: []Edge{
							{
								From:      "sensor_wait",
								To:        "sensor_done",
								Condition: "event == 'device.input' && logical_id == 'scarab_sensor'",
							},
						},
					},
				},
			},
		},
	}

	rt := NewRuntime(sg)
	_ = rt.StartScene("scene_device_test")

	// Inject device.input from wrong device
	rt.InjectEvent("device.input", map[string]interface{}{
		"logical_id": "other_sensor",
		"payload":    map[string]interface{}{"signal": "triggered"},
	})

	// Puzzle should still be unresolved
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleUnresolved {
		t.Error("expected puzzle to remain unresolved for wrong device")
	}

	// Inject device.input from correct device
	rt.InjectEvent("device.input", map[string]interface{}{
		"logical_id": "scarab_sensor",
		"payload":    map[string]interface{}{"signal": "triggered"},
	})

	// Now puzzle should be solved
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleSolved {
		t.Error("expected puzzle to be solved for correct device")
	}
}

// TestOperatorOverrideStillWorks verifies operator override takes precedence
func TestOperatorOverrideStillWorks(t *testing.T) {
	sg := &SceneGraph{
		Version: 1,
		Scenes: []Scene{
			{
				ID:    "scene_override_test",
				Name:  "Override Test",
				Entry: "puzzle_sensor",
				Nodes: []Node{
					{
						ID:   "puzzle_sensor",
						Type: "puzzle",
						Config: map[string]interface{}{
							"subgraph": "sensor_puzzle_v1",
						},
					},
					{
						ID:     "scene_complete",
						Type:   "terminal",
						Config: map[string]interface{}{},
					},
				},
				Edges: []Edge{
					{From: "puzzle_sensor", To: "scene_complete", Condition: "puzzle_sensor.resolved"},
				},
				Subgraphs: []Subgraph{
					{
						ID:    "sensor_puzzle_v1",
						Entry: "sensor_wait",
						Nodes: []Node{
							{
								ID:     "sensor_wait",
								Type:   "decision",
								Config: map[string]interface{}{},
							},
							{
								ID:     "sensor_done",
								Type:   "terminal",
								Config: map[string]interface{}{},
							},
						},
						Edges: []Edge{
							{
								From:      "sensor_wait",
								To:        "sensor_done",
								Condition: "event == 'device.input' && logical_id == 'scarab_sensor'",
							},
						},
					},
				},
			},
		},
	}

	rt := NewRuntime(sg)
	_ = rt.StartScene("scene_override_test")

	// Puzzle should be active and unresolved
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleUnresolved {
		t.Error("expected puzzle to be unresolved initially")
	}

	// Override the puzzle (simulates operator action)
	if err := rt.OverrideNode("puzzle_sensor"); err != nil {
		t.Fatalf("failed to override: %v", err)
	}

	// Puzzle should now be overridden (not solved)
	if rt.GetPuzzleResolution("puzzle_sensor") != PuzzleOverridden {
		t.Errorf("expected puzzle to be overridden, got %v", rt.GetPuzzleResolution("puzzle_sensor"))
	}

	// Node should be overridden
	if rt.GetNodeState("puzzle_sensor") != NodeStateOverridden {
		t.Errorf("expected node to be overridden, got %v", rt.GetNodeState("puzzle_sensor"))
	}

	// Scene should still complete (overridden counts as resolved)
	if rt.GetNodeState("scene_complete") != NodeStateCompleted {
		t.Errorf("expected scene_complete after override, got %v", rt.GetNodeState("scene_complete"))
	}
}

// TestTemplateScarabDeviceInput tests the template scene graph's puzzle_scarab
// which is configured to resolve on device.input from crypt_door with door_closed=true.
func TestTemplateScarabDeviceInput(t *testing.T) {
	sg, err := LoadSceneGraph("../../rooms/_template/graphs/scene-graph.v1.json")
	if err != nil {
		t.Fatalf("failed to load template scene graph: %v", err)
	}

	rt := NewRuntime(sg)

	// Start the intro scene
	if err := rt.StartScene("scene_intro"); err != nil {
		t.Fatalf("failed to start scene: %v", err)
	}

	// Verify puzzle_scarab is active and unresolved
	if rt.GetNodeState("puzzle_scarab") != NodeStateActive {
		t.Errorf("expected puzzle_scarab to be active, got %v", rt.GetNodeState("puzzle_scarab"))
	}
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Error("expected puzzle_scarab to be unresolved initially")
	}

	// Send device.input from wrong device - should NOT resolve
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "other_device",
		"topic":         "devices/ctrl-001/other_device/events",
		"payload": map[string]interface{}{
			"door_closed": true,
		},
	})

	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Error("expected puzzle_scarab to remain unresolved for wrong device")
	}

	// Send device.input from crypt_door but with door_closed=false - should NOT resolve
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "crypt_door",
		"topic":         "devices/ctrl-001/crypt_door/events",
		"payload": map[string]interface{}{
			"door_closed": false,
		},
	})

	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleUnresolved {
		t.Error("expected puzzle_scarab to remain unresolved for door_closed=false")
	}

	// Send correct device.input - should resolve the puzzle
	rt.InjectEvent("device.input", map[string]interface{}{
		"controller_id": "ctrl-001",
		"logical_id":    "crypt_door",
		"topic":         "devices/ctrl-001/crypt_door/events",
		"payload": map[string]interface{}{
			"door_closed": true,
		},
	})

	// Verify puzzle_scarab is now solved
	if rt.GetPuzzleResolution("puzzle_scarab") != PuzzleSolved {
		t.Errorf("expected puzzle_scarab to be solved, got %v", rt.GetPuzzleResolution("puzzle_scarab"))
	}
	if rt.GetNodeState("puzzle_scarab") != NodeStateCompleted {
		t.Errorf("expected puzzle_scarab node to be completed, got %v", rt.GetNodeState("puzzle_scarab"))
	}

	// Verify puzzle.solved event was emitted
	snapshot := events.Snapshot()
	hasPuzzleSolved := false
	for _, e := range snapshot {
		if e.Name == "puzzle.solved" {
			if puzzleID, ok := e.Fields["puzzle_id"].(string); ok && puzzleID == "puzzle_scarab" {
				hasPuzzleSolved = true
				break
			}
		}
	}
	if !hasPuzzleSolved {
		t.Error("expected puzzle.solved event for puzzle_scarab")
	}
}
