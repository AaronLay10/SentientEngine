package orchestrator

import (
	"log"

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
// Session is considered active if there is a scene.started without a later scene.reset.
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

	// Reverse to chronological order (Query returns DESC by timestamp)
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}

	state := &RestoredState{
		PuzzleStates: make(map[string]PuzzleResolution),
	}

	// Process events in chronological order to determine final state
	for _, row := range rows {
		switch row.Event {
		case "scene.started":
			// Scene started - session becomes active
			state.SessionActive = true
			if sceneID, ok := row.Fields["scene_id"].(string); ok {
				state.SceneID = sceneID
			}
			// Clear puzzle states when a new scene starts
			state.PuzzleStates = make(map[string]PuzzleResolution)

		case "scene.reset":
			// Scene reset - session becomes inactive
			state.SessionActive = false
			state.SceneID = ""
			state.PuzzleStates = make(map[string]PuzzleResolution)

		case "puzzle.solved":
			// Puzzle was solved
			nodeID := extractNodeID(row.Fields)
			if nodeID != "" {
				state.PuzzleStates[nodeID] = PuzzleSolved
			}

		case "puzzle.overridden":
			// Puzzle was overridden (via operator action)
			nodeID := extractNodeID(row.Fields)
			if nodeID != "" {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}

		case "operator.override":
			// Operator override - marks puzzle as overridden
			nodeID := extractNodeID(row.Fields)
			if nodeID != "" {
				state.PuzzleStates[nodeID] = PuzzleOverridden
			}

		case "puzzle.reset":
			// Puzzle was reset - returns to unresolved
			nodeID := extractNodeID(row.Fields)
			if nodeID != "" {
				state.PuzzleStates[nodeID] = PuzzleUnresolved
			}

		case "operator.reset":
			// Operator reset - returns puzzle to unresolved
			nodeID := extractNodeID(row.Fields)
			if nodeID != "" {
				state.PuzzleStates[nodeID] = PuzzleUnresolved
			}
		}
	}

	log.Printf("[restore] processed %d events: session_active=%v scene_id=%q puzzles=%d",
		len(rows), state.SessionActive, state.SceneID, len(state.PuzzleStates))

	// Only return state if session is active with a valid scene
	if !state.SessionActive || state.SceneID == "" {
		return nil, len(rows), nil
	}

	return state, len(rows), nil
}

// extractNodeID extracts node_id from event fields, trying multiple field names.
func extractNodeID(fields map[string]interface{}) string {
	if nodeID, ok := fields["node_id"].(string); ok {
		return nodeID
	}
	// Fallback for puzzle events that might use puzzle_id
	if puzzleID, ok := fields["puzzle_id"].(string); ok {
		return puzzleID
	}
	return ""
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
		log.Printf("[restore] scene not found: %s", state.SceneID)
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
			log.Printf("[restore] applied puzzle state: %s -> %s", nodeID, resolution)
		}
	}

	log.Printf("[restore] restored scene %s with %d puzzle states", state.SceneID, len(state.PuzzleStates))
	return nil
}

// EmitStartupRestore emits the system.startup_restore event.
func EmitStartupRestore(restored int, roomID string) {
	events.Emit("info", "system.startup_restore", "", map[string]interface{}{
		"restored": restored,
		"room_id":  roomID,
	})
}
