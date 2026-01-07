# ADR-001: Per-Room Runtime Isolation

## Status
Accepted

## Context
Sentient Engine controls real-time escape room experiences involving
hardware devices, timing, and player interaction.

Previous versions attempted to manage multiple rooms within shared
runtime infrastructure. This created several problems:
- Cross-room state leakage
- Increased blast radius during restarts or failures
- Difficulty reasoning about live behavior
- Risk when updating or debugging one room affecting others

These issues repeatedly caused rewrites and blocked progress.

## Decision
Each escape room SHALL run in its own fully isolated Docker container.

Specifically:
- One room = one container
- Each container includes its own:
  - Orchestrator
  - API
  - MQTT broker (Mosquitto)
  - PostgreSQL database
- No runtime state, broker, or database is shared between rooms

Multiple rooms may run simultaneously on the same host, but they do so
as independent container instances.

## Consequences
### Positive
- Restarting or updating one room does not affect others
- Clear operational boundaries
- Simplified debugging and failure recovery
- Deterministic behavior per room
- Safe parallel operation

### Negative
- Higher resource usage than shared infrastructure
- Some duplication of services per room

These tradeoffs are intentional and accepted.

## Alternatives Considered
- Shared broker and database with namespacing
- Single orchestrator managing multiple rooms
- Multi-tenant runtime model

These alternatives were rejected due to increased complexity,
higher risk, and repeated failures in prior versions.

## Enforcement
- No shared databases across rooms
- No shared MQTT brokers across rooms
- No cross-container runtime communication
- Any proposal to change this requires a new ADR