package orchestrator

// NodeState represents the lifecycle state of a node.
type NodeState string

const (
	NodeStateIdle       NodeState = "idle"
	NodeStateActive     NodeState = "active"
	NodeStateCompleted  NodeState = "completed"
	NodeStateFailed     NodeState = "failed"
	NodeStateOverridden NodeState = "overridden"
)

// NodeStatus tracks the runtime state of a node.
type NodeStatus struct {
	NodeID string
	State  NodeState
}

// PuzzleResolution indicates how a puzzle was resolved.
type PuzzleResolution string

const (
	PuzzleUnresolved  PuzzleResolution = "unresolved"
	PuzzleSolved      PuzzleResolution = "solved"
	PuzzleOverridden  PuzzleResolution = "overridden"
)

// PuzzleStatus tracks the resolution state of a puzzle node.
type PuzzleStatus struct {
	NodeID     string
	Resolution PuzzleResolution
}

// IsResolved returns true if the puzzle has been resolved (solved or overridden).
func (ps *PuzzleStatus) IsResolved() bool {
	return ps.Resolution == PuzzleSolved || ps.Resolution == PuzzleOverridden
}
