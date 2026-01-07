# Orchestrator Execution Loop (V7)

## Purpose
Defines the deterministic runtime algorithm for executing:
- scenes and nodes
- puzzle subgraphs
- loop nodes (timer-driven with optional random interval)
- timers
- operator Override/Reset
- strict event registry enforcement

This document is written to be directly implementable in Go.

---

## Core Runtime Concepts

### State
The Orchestrator maintains an in-memory state model (also projected to DB):
- active scene id
- active node states
- active puzzle subgraphs and their node states
- loop scheduling state (active flag, next execution time, RNG seed)
- timer scheduling state
- device/controller liveness state
- last processed event offsets (event-sourcing)

### Event Bus
All runtime changes are driven by events. Events are:
- validated against the Event Registry
- appended to the event log (Postgres)
- applied to update the in-memory state
- used to trigger edge evaluation

### Determinism
- No implicit advancement
- Scene completion only via explicit completion edge
- Condition expressions are evaluated only on relevant events (event-triggered evaluation)
- Timer/loop scheduling uses the Orchestrator central clock

---

## Node Lifecycle (General)
Each node has a lifecycle state:
- idle
- active
- completed
- failed
- overridden (treated as completed for flow)
- reset (returns to idle/active depending on node type)

Operator actions:
- Override(node_id): forces node to "overridden" and emits operator.override + node.overridden
- Reset(node_id): forces node back to "reset" and emits operator.reset + node.reset

Scenes are never overrideable; only nodes within the active scene are.

---

## Main Loop Overview

The Orchestrator runs a loop that processes three input sources:

1) Incoming events (MQTT device events, controller registrations, operator commands)
2) Scheduled timer events (timer.expired)
3) Scheduled loop ticks (loop.tick)

All three sources are normalized into a single internal event queue.

---

## Data Structures (Conceptual)

- EventQueue: FIFO queue of events to process
- Scheduler:
  - timers: min-heap by next_fire_time
  - loops: min-heap by next_tick_time
- GraphRuntime:
  - active_scene
  - node_states (scene nodes)
  - puzzle_states (active puzzle nodes -> subgraph runtime)
  - scene_graph (loaded from DB)
- Projections:
  - current_state projection (for UI)
  - device/controller liveness projection

---

## Initialization

1. Load room.yaml for metadata defaults
2. Load devices.yaml contract
3. Start MQTT broker connectivity (room-local)
4. Load the active scene graph revision from DB
5. Initialize projections
6. Begin controller liveness monitoring (requires continuous registration/heartbeat)
7. Emit system.startup

---

## Continuous Controller Validation (Background)
On each controller registration event:
1. Validate JSON schema and registry event name (device.connected or system.error as appropriate)
2. Update controller liveness state (last_seen, heartbeat interval)
3. Validate advertised logical devices against devices.yaml:
   - required devices must exist
   - capabilities must match
4. If validation fails:
   - mark room "not ready"
   - emit system.error with details
5. If validation succeeds:
   - mark room "ready"
   - emit device.connected / device.input as appropriate

Room "ready" is required to start a game.

---

## Starting a Game Session (Operator Command)
Input: operator starts game with selected scene graph revision (or default)

1. Verify room "ready" (required devices present)
2. Set active_scene to configured first scene (or selected)
3. Activate scene entry node
4. Emit scene.started and node.started events as appropriate
5. Persist session start events to event log

---

## Event Processing Algorithm (Core)

For each event E pulled from EventQueue:

### 1) Validate and Persist
1. Validate E name is in Event Registry (strict)
2. Append E to Postgres event log (durable)
3. Apply E to in-memory state (update node/puzzle/timer/loop/controller states)

### 2) Apply Operator Overrides/Resets
If E is operator.override:
- Resolve target node:
  - must exist in active scene OR be an active puzzle node
  - must not be a scene
- Force node state to overridden
- Emit node.overridden (append + apply)
- For puzzle node: mark puzzle resolved = true
If E is operator.reset:
- Force node state to reset (and return to active waiting state)
- Emit node.reset (append + apply)
- For puzzle node: mark puzzle resolved = false and restart puzzle subgraph runtime

### 3) Advance Active Executions
Depending on what changed (node completion, puzzle resolution, timer expired, loop tick):

A) Node completion handling
- When a node becomes completed/overridden/failed:
  - emit node.completed / node.failed if not already emitted
  - evaluate outgoing edges from that node

B) Puzzle node activation
- When a puzzle node becomes active:
  - instantiate puzzle subgraph runtime
  - set subgraph entry node active
  - emit puzzle.activated
  - puzzle remains unresolved until:
    - puzzle.solved is emitted by subgraph OR
    - operator.override occurs on the puzzle node

C) Puzzle subgraph execution
- Puzzle subgraph nodes process like normal nodes
- Puzzle subgraph completion emits puzzle.solved (or puzzle.failed if explicitly modeled)
- Parent puzzle node resolves true when:
  - puzzle.solved OR puzzle.overridden
- Then evaluate outgoing edges in the parent scene graph

D) Timer handling
- Timers schedule timer.expired events into EventQueue when due
- Timer nodes complete only when their timer.expired condition occurs

E) Loop handling (scene-only)
- Loop nodes are scheduled via Scheduler (central clock)
- At each loop tick:
  1. Emit loop.tick
  2. Execute configured loop action
  3. Recompute stop_condition (event-triggered evaluation)
  4. If stop_condition true:
     - mark loop stopped
     - emit loop.stopped
  5. Else:
     - schedule next tick using:
       - fixed interval OR
       - random interval within bounds using seeded RNG
- Persist minimal loop state:
  - active flag
  - next scheduled tick time
  - RNG seed

### 4) Edge Evaluation (Condition Expressions)
Edges are evaluated only when relevant events occur.

Algorithm:
1. Identify the set of nodes whose outgoing edges may be affected by E:
   - the node that changed state
   - the parent puzzle node if a puzzle resolved
   - parallel join nodes when children complete
2. For each candidate edge:
   - evaluate condition expression using current state + E context
3. If condition true:
   - transition to target node:
     - mark target node active
     - emit node.started
   - if target is terminal:
     - emit scene.completed
     - transition to next scene only if explicitly defined (future schema), otherwise stop

### 5) Parallel Join (AND-Join)
For a parallel node:
- Activate all children when parallel becomes active
- Parallel is considered complete only when all children complete (or are overridden)
- When all children complete:
  - mark parallel node complete
  - emit node.completed
  - evaluate outgoing edges from the parallel node

### 6) Persist Projections for UI
After processing E and any derived events:
- Update current_state projection for UI clients
- Publish UI updates over WebSocket (out of scope here)

---

## Failure Handling (V7)
- Failures are explicit only.
- Graceful degradation is preferred:
  - retry device interactions where possible
  - notify operator
  - continue execution unless a required gate is blocked

---

## Notes for Implementation
- Keep event log append atomic
- Derived events (node.completed, puzzle.solved, loop.tick) must also be appended to log
- Avoid recursion: use an internal queue for derived events
- Ensure expressions are evaluated in a controlled environment (no arbitrary code execution)

