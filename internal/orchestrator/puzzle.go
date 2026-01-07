package orchestrator

import (
	"github.com/AaronLay10/SentientEngine/internal/events"
)

// PuzzleRuntime manages execution of a single puzzle subgraph.
type PuzzleRuntime struct {
	subgraph     *Subgraph
	parentNodeID string
	nodeStates   map[string]*NodeStatus
	resolution   PuzzleResolution
}

// NewPuzzleRuntime creates a new runtime for a puzzle subgraph.
func NewPuzzleRuntime(subgraph *Subgraph, parentNodeID string) *PuzzleRuntime {
	pr := &PuzzleRuntime{
		subgraph:     subgraph,
		parentNodeID: parentNodeID,
		nodeStates:   make(map[string]*NodeStatus),
		resolution:   PuzzleUnresolved,
	}

	// Initialize all subgraph nodes to idle
	for _, node := range subgraph.Nodes {
		pr.nodeStates[node.ID] = &NodeStatus{
			NodeID: node.ID,
			State:  NodeStateIdle,
		}
	}

	return pr
}

// Start begins subgraph execution at the entry node.
func (pr *PuzzleRuntime) Start() {
	pr.activateNode(pr.subgraph.Entry)
}

// HandleEvent processes an event and returns true if the puzzle resolved.
func (pr *PuzzleRuntime) HandleEvent(evt Event) bool {
	if pr.resolution != PuzzleUnresolved {
		return false
	}

	ctx := &EvalContext{
		Event: &evt,
	}

	// Find active decision nodes and evaluate their outgoing edges
	for _, node := range pr.subgraph.Nodes {
		status := pr.nodeStates[node.ID]
		if status.State != NodeStateActive {
			continue
		}

		if node.Type == "decision" {
			for _, edge := range pr.subgraph.Edges {
				if edge.From == node.ID {
					if EvalCondition(edge.Condition, ctx) {
						pr.completeNode(node.ID)
						pr.activateNode(edge.To)
						break
					}
				}
			}
		}
	}

	return pr.resolution != PuzzleUnresolved
}

// Override marks the puzzle as resolved via operator override.
// This is modeled explicitly even though not yet wired to operator commands.
func (pr *PuzzleRuntime) Override() {
	if pr.resolution != PuzzleUnresolved {
		return
	}
	pr.resolution = PuzzleOverridden
	events.Emit("info", "puzzle.overridden", "", map[string]interface{}{
		"puzzle_id":   pr.parentNodeID,
		"subgraph_id": pr.subgraph.ID,
	})
}

// Resolution returns the current resolution state.
func (pr *PuzzleRuntime) Resolution() PuzzleResolution {
	return pr.resolution
}

func (pr *PuzzleRuntime) activateNode(nodeID string) {
	node := pr.findNode(nodeID)
	if node == nil {
		return
	}

	status := pr.nodeStates[nodeID]
	if status.State != NodeStateIdle {
		return
	}

	status.State = NodeStateActive

	switch node.Type {
	case "action":
		// Actions complete immediately in MVP
		pr.completeNode(nodeID)
		pr.advanceFromNode(nodeID)
	case "decision":
		// Decision waits for events - handled in HandleEvent
	case "terminal":
		pr.reachTerminal()
	}
}

func (pr *PuzzleRuntime) completeNode(nodeID string) {
	status := pr.nodeStates[nodeID]
	status.State = NodeStateCompleted
}

func (pr *PuzzleRuntime) advanceFromNode(nodeID string) {
	ctx := &EvalContext{
		Event: &Event{
			Name:   "node.completed",
			Fields: map[string]interface{}{"node_id": nodeID},
		},
	}

	for _, edge := range pr.subgraph.Edges {
		if edge.From == nodeID {
			if EvalCondition(edge.Condition, ctx) {
				pr.activateNode(edge.To)
				return
			}
		}
	}
}

func (pr *PuzzleRuntime) reachTerminal() {
	pr.resolution = PuzzleSolved
	events.Emit("info", "puzzle.solved", "", map[string]interface{}{
		"puzzle_id":   pr.parentNodeID,
		"subgraph_id": pr.subgraph.ID,
	})
}

func (pr *PuzzleRuntime) findNode(nodeID string) *Node {
	for i := range pr.subgraph.Nodes {
		if pr.subgraph.Nodes[i].ID == nodeID {
			return &pr.subgraph.Nodes[i]
		}
	}
	return nil
}
