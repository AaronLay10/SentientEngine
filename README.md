# Sentient Engine (V7)

Version 7 is the canonical architecture.

## Authority Order (highest → lowest)
1. ARCHITECTURE.md (V7)
2. TECHNOLOGY.md (V7)
3. PROJECT_GOVERNANCE.md
4. adr/
5. design/
6. code

If code conflicts with docs, code is wrong.

## V7 Core Rules (non-negotiable)
- One room = one Docker container
- No shared runtime state between rooms
- Orchestrator is authoritative; UI is never authoritative
- Graph Scene Editor is source of truth for scene graph
- Live edits allowed only for Admin; edits create a revision and require promotion
- Event-sourced persistence per room

## Repo Layout
- runtime/ : engine code (shared)
- rooms/   : per-room deployment content (config, graphs, media, scripts)
- ops/     : container/build/deploy
- adr/     : decisions
- design/  : specs/schemas
- notes/   : open questions and parking lot
- LEGACY/  : historical reference (if ever needed)