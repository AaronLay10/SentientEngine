# Scene Graph Schema (V7) — scene-graph.json

## Purpose
The scene graph defines room flow as data:
- Rooms contain multiple scenes
- A scene is a group of nodes
- A puzzle is a node on the scene graph that activates a puzzle subgraph
- Nodes are sensors, actions, timers, decisions, etc.

Physical wiring and MQTT topics never appear in the scene graph.

---

## Non-Negotiable Invariants (V7)
- One active scene at a time
- Scene progression is always explicit (no implicit auto-advance)
- Puzzles are gates: a puzzle node activates a puzzle subgraph and must resolve before flow continues
- Multiple puzzles may be active in parallel
- Parallel joins are AND-join (all branches must complete)
- Loop nodes exist in scenes only
- Loop nodes are timer-driven with optional random interval bounds
- Loop nodes stop only via a condition expression
- Operator can Override/Reset nodes, but never scenes
- Scene completion occurs only via an explicit completion edge

---

## Top-Level JSON Shape

version: 1
scenes: [ ... ]

---

## Scene Object

A scene is a container with its own nodes and edges.

Fields:
- id: unique identifier (string)
- name: display name (string)
- entry: node id where the scene begins (string)
- nodes: array of node objects
- edges: array of edge objects

---

## Node Object (Base)

Fields:
- id: unique identifier within the scene (string)
- type: node type (string)
- config: type-specific configuration (object)

Allowed node types (v1):
- scene
- action
- puzzle
- decision
- timer
- parallel
- loop
- gate
- checkpoint
- operator
- random
- subgraph

Note: In V7, “puzzle” is a node type AND it activates a puzzle subgraph.

---

## Node Types (v1)

### action
Represents a side-effect (audio/video/device command/etc.).

Typical config fields:
- action: action name (string)
- params: action parameters (object)

---

### puzzle (gate)
A node on the scene graph that activates a puzzle subgraph.

Typical config fields:
- subgraph: puzzle subgraph id (string)
- required: true/false (boolean)

Puzzle resolution events:
- solved
- override
- reset (operator)

The scene does not proceed past the puzzle gate until the puzzle resolves.

---

### puzzle subgraph
A contained graph that runs when a puzzle node is activated.

Fields:
- id: subgraph id (string)
- entry: node id inside the subgraph
- nodes: array of node objects
- edges: array of edge objects

Puzzle subgraphs may contain parallel logic internally, but they must resolve to a
single puzzle outcome for the parent puzzle node.

---

### parallel
Fans out into multiple branches and rejoins.

Join semantics (V7):
- AND-join only (all branches must complete)

Typical config fields:
- children: array of node ids

---

### loop
Repeating node for ambiance (fog, sound, lighting) while waiting.

Constraints (V7):
- Allowed only in scenes (not puzzle subgraphs)
- Timer-driven scheduling using the orchestrator’s central clock
- Optional randomized interval within bounds
- Stops only by stop_condition expression

Typical config fields:
- interval_ms:
    - min: integer
    - max: integer (optional; if present, random between min and max)
- action: action name (string)
- params: action parameters (object)
- stop_condition: condition expression (string)

Persisted loop state (minimal):
- loop node id
- active flag
- next scheduled execution time
- seeded RNG for deterministic replay

---

### timer
Represents a delay or timeout.

Typical config fields:
- duration_ms: integer
- emit: event name (string)

---

### decision
Evaluates an expression and routes flow.

Typical config fields:
- expression: condition expression (string)

---

## Edges

An edge is an explicit transition from one node to another.

Fields:
- from: node id (string)
- to: node id (string)
- condition: condition expression (string)

Condition expressions are evaluated:
- event-triggered (on relevant events), not continuous polling

---

## Scene Completion
Scenes complete only via an explicit transition to a terminal node (or scene-complete marker).
There is no implicit completion.

---

## Operator Actions
Operator (gamemaster) actions are recorded as events and influence flow.

Allowed actions:
- Override(node_id): forces node to resolve true and continue
- Reset(node_id): forces node back to unresolved and waits again

Restriction:
- Scenes are never overrideable; only nodes inside the active scene can be overridden/reset.

---

## Enforcement Rules
- No physical device identifiers, pins, or MQTT topics in the scene graph
- Puzzle nodes gate progression unless explicitly configured otherwise in future versions
- Any schema change requires a schema version bump and an ADR
