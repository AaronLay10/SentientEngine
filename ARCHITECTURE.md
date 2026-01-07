# Sentient Engine — Architecture V7

## Status
Frozen for implementation.

This file will contain the canonical V7 architecture (room isolation, orchestrator authority, scene model, graph lifecycle, event sourcing, roles, and ops boundaries).

Non-negotiables:
- One room = one container
- No shared runtime state across rooms
- Orchestrator is authoritative
- Graph-authored scene logic
- Event-sourced persistence per room