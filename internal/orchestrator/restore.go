package orchestrator

import (
	"github.com/AaronLay10/SentientEngine/internal/events"
	"github.com/AaronLay10/SentientEngine/internal/storage/postgres"
)

// DefaultRestoreLimit is the default number of events to load for restore.
const DefaultRestoreLimit = 1000

// RestoredState represents the minimal state reconstructed from events.
type RestoredState struct {
	SessionActive bool
	SceneID       string
	PuzzleStates  map[string]PuzzleResolution // node_id -> resolution
}

// RestoreFromEvents loads events from Postgres and reconstructs minimal runtime state.
// Returns nil if no relevant state was found or if client is nil.
func RestoreFromEvents(client *postgres.Client, roomID string, limit int) (*RestoredState, int, error) {
	if client == nil {
		return nil, 0, nil
	}

	if limit <= 0 {
		limit = DefaultRestoreLimit
	}

	rows, err := client.Query(limit)
	if err != nil {
		return nil, 0, err
	}

	if len(rows) == 0 {
		return nil, 0, nil
	}

	// Reverse to chronological order (Query returns DESC)
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}

	state := &RestoredState{
		PuzzleStates: make(map[string]PuzzleResolution),
	}

	for _, row := range rows {
		switch row.Event {
		case "scene.started":
			state.SessionActive = true
			if sceneID, ok := row.Fields["scene_id"].(string); ok {
				state.SceneID = sceneID
			}

		case "scene.reset":
			state.SessionActive = false
			state.SceneID = ""
			// Clear puzzle states on scene reset
			state.PuzzleStates = make(map[string]PuzzleResolution)

		case "puzzle.solved":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleSolved
			} else if puzzleID, ok := row.Fields["puzzle_id"].(string); ok {
				// Fallback: puzzle_id field used in some events
				state.PuzzleStates[puzzleID] = PuzzleSolved
			}

		case "puzzle.overridden":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}

		case "puzzle.reset":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				state.PuzzleStates[nodeID] = PuzzleUnresolved
			}

		case "operator.override":
			if nodeID, ok := row.Fields["node_id"].(string); ok {
				// operator.override on a puzzle marks it overridden
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}
		}
	}

	return state, len(rows), nil
}

// ApplyRestoredState applies restored state to the runtime.
// This does NOT re-emit events or trigger actions.
func (r *Runtime) ApplyRestoredState(state *RestoredState) error {
	if state == nil || !state.SessionActive || state.SceneID == "" {
		return nil
	}

	// Find and set the active scene
	for i := range r.graph.Scenes {
		if r.graph.Scenes[i].ID == state.SceneID {
			r.activeScene = &r.graph.Scenes[i]
			break
		}
	}
	if r.activeScene == nil {
		return nil
	}

	// Initialize node states for the active scene
	for _, node := range r.activeScene.Nodes {
		r.nodeStates[node.ID] = &NodeStatus{
			NodeID: node.ID,
			State:  NodeStateIdle,
		}

		// Initialize puzzle status for puzzle nodes
		if node.Type == "puzzle" {
			r.puzzleStates[node.ID] = &PuzzleStatus{
				NodeID:     node.ID,
				Resolution: PuzzleUnresolved,
			}
		}
	}

	// Apply restored puzzle states
	for nodeID, resolution := range state.PuzzleStates {
		if ps, ok := r.puzzleStates[nodeID]; ok {
			ps.Resolution = resolution
			// Mark resolved puzzles as completed/overridden
			if ns, ok := r.nodeStates[nodeID]; ok {
				switch resolution {
				case PuzzleSolved:
					ns.State = NodeStateCompleted
				case PuzzleOverridden:
					ns.State = NodeStateOverridden
				}
			}
		}
	}

	return nil
}

// EmitStartupRestore emits the system.startup_restore event.
func EmitStartupRestore(restored int, roomID string) {
	events.Emit("info", "system.startup_restore", "", map[string]interface{}{
		"restored": restored,
		"room_id":  roomID,
	})
}
