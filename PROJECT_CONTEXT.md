# Project Context — Sentient Engine V7

## What we are building
A deterministic, event-sourced escape-room engine where each room runs as an isolated container.

## Deployment model
- One room = one container
- Many rooms = many containers on the same host
- Restarting one room must not affect others
- Per-room Mosquitto broker
- Per-room PostgreSQL database
- Devices connect directly to the room MQTT broker

## Runtime model
- Single active scene at a time
- Scenes can run parallel actions and parallel puzzles
- Internal event bus inside the room
- Orchestrator runs a rule-driven evaluation loop with a central clock
- Graceful degradation with notifications and operator input

## Scene graph
- Authored in Graph Scene Editor
- Export to files → imported into DB at deploy/start
- Runtime reads from DB
- Live edits allowed for Admin only
- Live edits create new revision; promotion required after game

## Roles
- Administrator: full control + live edits + promote revisions
- Creative: edit scenes/puzzles (no live game authority)
- Technician: hardware power/test/diagnostics

## Current phase
Phase 1: Repo skeleton and governance files.
Next: ADR-001, then define scene graph schema, then MVP vertical slice.