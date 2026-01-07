package orchestrator

// SceneGraph is the top-level container loaded from JSON.
type SceneGraph struct {
	Version int     `json:"version"`
	Scenes  []Scene `json:"scenes"`
}

// Scene is a container with nodes, edges, and subgraphs.
// Scenes are NOT node types; they are containers only.
type Scene struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Entry     string     `json:"entry"`
	Nodes     []Node     `json:"nodes"`
	Edges     []Edge     `json:"edges"`
	Subgraphs []Subgraph `json:"subgraphs"`
}

// Node represents a node in the scene or subgraph.
// Allowed types: action, puzzle, decision, timer, parallel, loop, gate, checkpoint, operator, random, subgraph, terminal
type Node struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// Edge represents a transition between nodes.
type Edge struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Condition string `json:"condition"`
}

// Subgraph represents a puzzle subgraph.
type Subgraph struct {
	ID      string                 `json:"id"`
	Entry   string                 `json:"entry"`
	Nodes   []Node                 `json:"nodes"`
	Edges   []Edge                 `json:"edges"`
	Outputs map[string]interface{} `json:"outputs,omitempty"`
}
