package orchestrator

import (
	"fmt"

	"github.com/AaronLay10/SentientEngine/internal/events"
)

// Runtime manages scene graph execution.
type Runtime struct {
	graph          *SceneGraph
	activeScene    *Scene
	nodeStates     map[string]*NodeStatus
	puzzleStates   map[string]*PuzzleStatus
	puzzleRuntimes map[string]*PuzzleRuntime
}

// NewRuntime creates a new scene runtime.
func NewRuntime(sg *SceneGraph) *Runtime {
	return &Runtime{
		graph:          sg,
		nodeStates:     make(map[string]*NodeStatus),
		puzzleStates:   make(map[string]*PuzzleStatus),
		puzzleRuntimes: make(map[string]*PuzzleRuntime),
	}
}

// StartScene initializes and starts a scene by ID.
func (r *Runtime) StartScene(sceneID string) error {
	// Find scene
	for i := range r.graph.Scenes {
		if r.graph.Scenes[i].ID == sceneID {
			r.activeScene = &r.graph.Scenes[i]
			break
		}
	}
	if r.activeScene == nil {
		return fmt.Errorf("scene not found: %s", sceneID)
	}

	// Initialize all nodes to idle
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

	// Emit scene.started
	r.emitEvent("scene.started", map[string]interface{}{"scene_id": sceneID})

	// Activate entry node
	r.activateNode(r.activeScene.Entry)

	return nil
}

// InjectEvent processes an external event (for testing).
func (r *Runtime) InjectEvent(name string, fields map[string]interface{}) {
	evt := Event{Name: name, Fields: fields}

	// Route to active puzzle runtimes
	for nodeID, pr := range r.puzzleRuntimes {
		if pr.HandleEvent(evt) {
			// Puzzle resolved
			r.puzzleStates[nodeID].Resolution = pr.Resolution()
			r.completeNode(nodeID)
		}
	}

	// Re-evaluate conditions that may depend on puzzle resolution
	r.evaluateAllConditions()
}

func (r *Runtime) activateNode(nodeID string) {
	node := r.findNode(nodeID)
	if node == nil {
		return
	}

	status := r.nodeStates[nodeID]
	if status.State != NodeStateIdle {
		return
	}

	status.State = NodeStateActive
	r.emitEvent("node.started", map[string]interface{}{"node_id": nodeID})

	switch node.Type {
	case "parallel":
		r.activateParallel(node)
	case "puzzle":
		r.activatePuzzle(node)
	case "action":
		r.executeAction(node)
	case "loop":
		// MVP: loops stay active until stop_condition is true
		// Stop condition is evaluated when puzzle states change
		r.emitEvent("loop.started", map[string]interface{}{"node_id": nodeID})
	case "terminal":
		// Terminal nodes complete immediately
		r.completeNode(nodeID)
		r.emitEvent("scene.completed", map[string]interface{}{"scene_id": r.activeScene.ID})
	}
}

func (r *Runtime) activateParallel(node *Node) {
	childrenRaw, ok := node.Config["children"].([]interface{})
	if !ok {
		return
	}
	for _, child := range childrenRaw {
		if childID, ok := child.(string); ok {
			r.activateNode(childID)
		}
	}
}

func (r *Runtime) activatePuzzle(node *Node) {
	subgraphID, ok := node.Config["subgraph"].(string)
	if !ok {
		return
	}
	subgraph := r.findSubgraph(subgraphID)
	if subgraph == nil {
		return
	}

	pr := NewPuzzleRuntime(subgraph, node.ID)
	r.puzzleRuntimes[node.ID] = pr

	r.emitEvent("puzzle.activated", map[string]interface{}{
		"node_id":     node.ID,
		"subgraph_id": subgraphID,
	})

	// Start subgraph execution
	pr.Start()
}

func (r *Runtime) executeAction(node *Node) {
	// MVP: actions complete immediately
	r.completeNode(node.ID)
}

func (r *Runtime) completeNode(nodeID string) {
	status := r.nodeStates[nodeID]
	if status.State == NodeStateCompleted {
		return
	}
	status.State = NodeStateCompleted

	r.emitEvent("node.completed", map[string]interface{}{"node_id": nodeID})

	// Check if this completes a parallel node
	r.checkParallelCompletion()

	// Evaluate outgoing edges
	r.evaluateEdgesFrom(nodeID)
}

func (r *Runtime) checkParallelCompletion() {
	for _, node := range r.activeScene.Nodes {
		if node.Type != "parallel" {
			continue
		}
		status := r.nodeStates[node.ID]
		if status.State != NodeStateActive {
			continue
		}

		// Check if all children are completed (or overridden)
		childrenRaw, ok := node.Config["children"].([]interface{})
		if !ok {
			continue
		}
		allComplete := true
		for _, child := range childrenRaw {
			if childID, ok := child.(string); ok {
				childStatus := r.nodeStates[childID]
				if childStatus.State != NodeStateCompleted && childStatus.State != NodeStateOverridden {
					allComplete = false
					break
				}
			}
		}
		if allComplete {
			r.completeNode(node.ID)
		}
	}
}

func (r *Runtime) evaluateEdgesFrom(fromNodeID string) {
	ctx := &EvalContext{
		PuzzleStates: r.puzzleStates,
	}

	for _, edge := range r.activeScene.Edges {
		if edge.From != fromNodeID {
			continue
		}
		toStatus := r.nodeStates[edge.To]
		if toStatus.State != NodeStateIdle {
			continue
		}
		if EvalCondition(edge.Condition, ctx) {
			r.activateNode(edge.To)
		}
	}
}

func (r *Runtime) evaluateAllConditions() {
	ctx := &EvalContext{
		PuzzleStates: r.puzzleStates,
	}

	// Evaluate loop stop conditions (loops complete when stop_condition is true)
	for _, node := range r.activeScene.Nodes {
		if node.Type != "loop" {
			continue
		}
		status := r.nodeStates[node.ID]
		if status.State != NodeStateActive {
			continue
		}
		stopCondition, ok := node.Config["stop_condition"].(string)
		if !ok || stopCondition == "" {
			continue
		}
		if EvalCondition(stopCondition, ctx) {
			r.emitEvent("loop.stopped", map[string]interface{}{"node_id": node.ID})
			r.completeNode(node.ID)
		}
	}

	// Evaluate edge conditions
	for _, edge := range r.activeScene.Edges {
		fromStatus := r.nodeStates[edge.From]
		toStatus := r.nodeStates[edge.To]

		// Only evaluate if source is completed and target is idle
		if fromStatus.State == NodeStateCompleted && toStatus.State == NodeStateIdle {
			if EvalCondition(edge.Condition, ctx) {
				r.activateNode(edge.To)
			}
		}
	}
}

func (r *Runtime) emitEvent(name string, fields map[string]interface{}) {
	events.Emit("info", name, "", fields)
}

func (r *Runtime) findNode(nodeID string) *Node {
	for i := range r.activeScene.Nodes {
		if r.activeScene.Nodes[i].ID == nodeID {
			return &r.activeScene.Nodes[i]
		}
	}
	return nil
}

func (r *Runtime) findSubgraph(subgraphID string) *Subgraph {
	for i := range r.activeScene.Subgraphs {
		if r.activeScene.Subgraphs[i].ID == subgraphID {
			return &r.activeScene.Subgraphs[i]
		}
	}
	return nil
}

// GetNodeState returns the state of a node (for testing).
func (r *Runtime) GetNodeState(nodeID string) NodeState {
	if status, ok := r.nodeStates[nodeID]; ok {
		return status.State
	}
	return NodeStateIdle
}

// GetPuzzleResolution returns the resolution of a puzzle node (for testing).
func (r *Runtime) GetPuzzleResolution(nodeID string) PuzzleResolution {
	if status, ok := r.puzzleStates[nodeID]; ok {
		return status.Resolution
	}
	return PuzzleUnresolved
}

// HasNode returns true if the node exists in the active scene.
func (r *Runtime) HasNode(nodeID string) bool {
	if r.activeScene == nil {
		return false
	}
	return r.findNode(nodeID) != nil
}

// OverrideNode forces a node to completed/overridden state.
// For puzzle nodes, marks the puzzle as overridden and emits puzzle.overridden.
// Triggers evaluation logic (loop stop, parallel join, edges).
func (r *Runtime) OverrideNode(nodeID string) error {
	if r.activeScene == nil {
		return fmt.Errorf("no active scene")
	}

	node := r.findNode(nodeID)
	if node == nil {
		return fmt.Errorf("node not found: %s", nodeID)
	}

	status := r.nodeStates[nodeID]
	if status.State == NodeStateCompleted || status.State == NodeStateOverridden {
		return nil // already completed
	}

	// For puzzle nodes, mark puzzle as overridden
	if node.Type == "puzzle" {
		if ps, ok := r.puzzleStates[nodeID]; ok {
			ps.Resolution = PuzzleOverridden
		}
		r.emitEvent("puzzle.overridden", map[string]interface{}{"node_id": nodeID})
	}

	// Mark node as overridden
	status.State = NodeStateOverridden
	r.emitEvent("node.overridden", map[string]interface{}{"node_id": nodeID})

	// Emit node.completed (overridden counts as completed for flow)
	r.emitEvent("node.completed", map[string]interface{}{"node_id": nodeID})

	// Trigger evaluation logic
	r.checkParallelCompletion()
	r.evaluateAllConditions()

	return nil
}

// ResetNode returns a node to active/waiting state.
// For puzzle nodes, marks the puzzle as unresolved and emits puzzle.reset.
func (r *Runtime) ResetNode(nodeID string) error {
	if r.activeScene == nil {
		return fmt.Errorf("no active scene")
	}

	node := r.findNode(nodeID)
	if node == nil {
		return fmt.Errorf("node not found: %s", nodeID)
	}

	status := r.nodeStates[nodeID]

	// For puzzle nodes, mark puzzle as unresolved
	if node.Type == "puzzle" {
		if ps, ok := r.puzzleStates[nodeID]; ok {
			ps.Resolution = PuzzleUnresolved
		}
		r.emitEvent("puzzle.reset", map[string]interface{}{"node_id": nodeID})
	}

	// Return node to active state
	status.State = NodeStateActive
	r.emitEvent("node.reset", map[string]interface{}{"node_id": nodeID})

	return nil
}
