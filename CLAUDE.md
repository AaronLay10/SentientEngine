# CLAUDE.md

# Claude Code Instructions — Sentient Engine V7

You are an AI coding agent working on Sentient Engine Version 7.

## Authority Order (must follow)
1. ARCHITECTURE.md
2. TECHNOLOGY.md
3. PROJECT_GOVERNANCE.md
4. ADRs in /adr
5. Design docs in /design

If code conflicts with documentation, the documentation is correct.

## Non-negotiable rules
- One room = one Docker container
- No shared runtime state across rooms
- Orchestrator is authoritative
- Scene logic is data-driven (scene graph)
- Event names MUST come from design/events/registry.md
- Scenes are never overridden
- Puzzles are nodes with subgraphs
- Loops are scene-only and timer-driven
- No architectural changes without a new ADR

## Your role
- Implement what is already specified
- Do not invent new abstractions
- Do not refactor architecture
- Do not generalize “for flexibility”
- Ask for clarification ONLY if documentation is insufficient

If a task would violate these rules:
STOP and explain why.

## Authority Order

Before making changes, consult documents in this order:
1. ARCHITECTURE.md (frozen V7 spec)
2. TECHNOLOGY.md (stack decisions)
3. PROJECT_GOVERNANCE.md (change control)
4. adr/ (architectural decisions)
5. design/ (schemas and specs)

**If code conflicts with docs, docs are authoritative.** Do not refactor architecture or invent new abstractions. Implement what is already designed.

## Build Commands

```bash
go build ./cmd/api/...           # Build API server
go build ./cmd/orchestrator/...  # Build orchestrator
```

No tests or linting configured yet.

## Architecture

Sentient Engine V7 is a deterministic, event-sourced escape-room engine. Each room runs as an isolated Docker container with its own orchestrator, API, PostgreSQL, and MQTT broker.

### Non-Negotiable Constraints
- One room = one Docker container
- No shared runtime state between rooms
- Orchestrator is authoritative; UI is never authoritative
- Scene logic is data-driven (scene graphs, not code)
- Event names must come from `design/events/registry.md`
- No architectural changes without a new ADR

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Orchestrator | `cmd/orchestrator/`, `internal/orchestrator/` | Deterministic event-driven runtime, executes scene graphs |
| API | `cmd/api/`, `internal/api/` | REST endpoints, WebSocket support |
| Event Bus | `internal/events/` | Event validation, ring buffer, strict registry enforcement |
| Config | `internal/config/` | YAML parsing for room.yaml and devices.yaml |

### Key Design Documents
- `design/scene-graph/schema.md` — Node types, edges, parallel execution, loop nodes
- `design/events/registry.md` — Allowed event names (strictly validated in code)
- `design/orchestrator/execution-loop.md` — Detailed execution algorithm
- `design/room/schema.md` — Room identity and ops configuration
- `design/devices/schema.md` — Device contracts and safety classifications

### Repo Layout
- `cmd/` — Binary entry points
- `internal/` — Shared packages (not exposed)
- `rooms/` — Per-room deployment content (config, graphs, media)
- `rooms/_template/` — Canonical template for new rooms
- `design/` — Schema specifications
- `adr/` — Architectural Decision Records
- `ops/` — Container/deploy configuration

## Tech Stack

- **Language:** Go 1.22.2
- **Persistence:** PostgreSQL (per room, event-sourced)
- **Broker:** Eclipse Mosquitto (per room)
- **UI:** React + TypeScript SPA
- **Real-time:** WebSockets
- **Deployment:** Docker with named volumes

Explicitly rejected: shared brokers/databases across rooms, Kafka/NATS, Temporal.
