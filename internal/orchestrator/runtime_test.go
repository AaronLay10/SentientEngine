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
