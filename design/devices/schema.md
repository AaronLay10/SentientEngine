# Devices Schema (V7) — `devices.yaml`

## Purpose

`devices.yaml` defines the **logical device contract** for a room.
It is the bridge between the scene graph and the physical hardware.

Scenes reference **logical device IDs only**.
Physical wiring, pins, and MQTT topics are provided by controllers
**during self-registration**, not in this file.

---

## File Responsibilities

### `devices.yaml` **does**

* Define what devices the room expects
* Define capabilities and signals
* Classify safety sensitivity
* Enforce presence and compatibility at runtime

### `devices.yaml` **does NOT**

* Define physical wiring
* Define MQTT topics
* Define controller firmware behavior
* Contain scene logic

---

## Versioning

```yaml
version: 1
```

Schema changes require a new version number **and an ADR**.

---

## Top‑Level Structure

```yaml
version: 1

devices:
  <logical_device_id>:
    type: <string>
    required: <true|false>
    safety: <none|advisory|critical>
    capabilities:
      - <capability>
    signals:
      inputs:
        - <signal>
      outputs:
        - <signal>
```

---

## Field Definitions

### `logical_device_id`

A unique identifier used by scenes and actions.

Examples:

* `crypt_door`
* `torch_relay`
* `pressure_plate_1`

---

### `type`

High‑level classification of the device.

Examples:

* `door`
* `relay`
* `sensor`
* `motor`
* `light`
* `audio`

Used for validation and UI display only.

---

### `required`

* `true` → Game **cannot start** unless this device is present
* `false` → Optional device

---

### `safety`

Safety classification enforced by the Orchestrator.

| Value      | Meaning                                                |
| ---------- | ------------------------------------------------------ |
| `none`     | No safety concerns                                     |
| `advisory` | Operator‑visible warning                               |
| `critical` | Explicit scene intent and operator visibility required |

Future versions may add interlocks, time limits, or emergency‑stop rules
for `critical` devices.

---

### `capabilities`

Declared behaviors the device supports.

Examples:

* `open`, `close`
* `on`, `off`
* `boolean`
* `locked_state`

Capabilities **must match** those reported by controllers during
self‑registration.

---

### `signals.inputs`

Events the device can emit.

Examples:

* `door_open`
* `pressed`
* `motion_detected`

---

### `signals.outputs`

Commands the Orchestrator may send.

Examples:

* `unlock`
* `power_on`
* `stop`

---

## Full Example

```yaml
version: 1

devices:
  crypt_door:
    type: door
    required: true
    safety: critical
    capabilities:
      - open
      - close
      - locked_state
    signals:
      inputs:
        - door_closed
        - door_open
      outputs:
        - unlock
        - lock
```

---

## Runtime Behavior

1. Controllers connect to the room MQTT broker
2. Controllers self‑register with:

   * controller ID
   * devices provided
   * capabilities
   * MQTT topics
3. Orchestrator validates:

   * required devices present
   * capabilities compatible
   * safety rules satisfied
4. Game start is allowed or blocked accordingly
5. Heartbeats and re‑registration are monitored continuously

---

## Enforcement Rules

* Scenes may reference **only logical device IDs**
* Physical details never appear in scene graphs
* Missing required devices block game start
* Safety rules are enforced centrally by the Orchestrator

Any change to this schema or its rules requires a new ADR.
