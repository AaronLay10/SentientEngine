# Room Schema (V7) — room.yaml

## Purpose
room.yaml defines identity and operational metadata for a room.
It does not define devices, scenes, or physical wiring.

This file is used for:
- UI display and labeling
- Runtime defaults and limits
- Operational sanity checks
- Deployment clarity

---

## Versioning

version: 1

Schema changes require a new version number and an ADR.

---

## Top-Level Structure

version: 1

room:
  id: <string>
  revision: <string>
  name: <string>
  description: <string>

ops:
  timezone: <IANA timezone>
  default_game_minutes: <int>
  max_game_minutes: <int>

network:
  ui_port: <int>
  mqtt_port: <int>
  db_port: <int>

limits:
  max_clients: <int>
  max_concurrent_actions: <int>

---

## Field Definitions

### room.id
Stable slug identifier.
Used in logs, metrics, and container naming.
Must not change once deployed.

Examples:
- pharaohs
- clockwork

---

### room.revision
Human-readable revision string.
Used for ops clarity and deployments.

Examples:
- 2026.01.07
- v1-launch

---

### room.name
Display name shown in UI.

---

### room.description
Short description for operators and creatives.

---

### ops.timezone
IANA timezone identifier.
Used for logging and scheduling.

Example:
timezone: America/Phoenix

---

### ops.default_game_minutes
Default duration when starting a game.

---

### ops.max_game_minutes
Hard cap to prevent runaway sessions.

---

### network.ui_port
Port exposed for Web UI / API.

---

### network.mqtt_port
Port exposed for device connectivity.

---

### network.db_port
Port exposed for database access (ops/debug).

---

### limits.max_clients
Maximum number of connected UI clients.

---

### limits.max_concurrent_actions
Guardrail for parallel runtime actions.

---

## Example

version: 1

room:
  id: pharaohs
  revision: 2026.01.07
  name: Return of the Pharaohs
  description: Egyptian themed escape room

ops:
  timezone: America/Phoenix
  default_game_minutes: 60
  max_game_minutes: 90

network:
  ui_port: 8080
  mqtt_port: 1883
  db_port: 5432

limits:
  max_clients: 8
  max_concurrent_actions: 32

---

## Enforcement Rules
- room.yaml must not reference devices or scenes
- Physical details never appear here
- Changes require schema version bump and an ADR
