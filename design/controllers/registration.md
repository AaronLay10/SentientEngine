# Controller Self-Registration (V7)

## Purpose
Controllers self-register with Sentient to declare the physical devices
they provide and how to communicate with them.

This allows:
- Hardware to change without modifying scenes
- Strict validation against devices.yaml
- Continuous health monitoring
- Safe recovery during disconnects

---

## MQTT Topic
Controllers publish registration messages to:

sentient/registration/<controller_id>

Example:
sentient/registration/ctrl-001

---

## Payload Format
JSON

---

## Registration Payload (v1)

{
  "version": 1,
  "controller": {
    "id": "ctrl-001",
    "type": "teensy",
    "firmware": "1.2.0",
    "uptime_ms": 123456,
    "heartbeat_sec": 5
  },
  "devices": [
    {
      "logical_id": "crypt_door",
      "type": "door",
      "capabilities": ["open", "close", "locked_state"],
      "signals": {
        "inputs": ["door_closed", "door_open"],
        "outputs": ["unlock", "lock"]
      },
      "topics": {
        "publish": "devices/ctrl-001/crypt_door/events",
        "subscribe": "devices/ctrl-001/crypt_door/commands"
      }
    }
  ]
}

---

## Field Definitions

### controller.id
Unique identifier for the controller.
Must be stable across restarts.

### controller.type
Controller platform identifier.
Examples:
- teensy
- esp32
- raspberrypi

### controller.firmware
Firmware version string for diagnostics and compatibility checks.

### controller.uptime_ms
Milliseconds since controller boot.
Used for debugging and restart detection.

### controller.heartbeat_sec
Interval (in seconds) at which the controller will re-publish
its registration payload.

### devices[].logical_id
Logical device ID that must match an entry in devices.yaml.

### devices[].topics
Defines the MQTT topics used for communication.

- publish: events emitted by the device
- subscribe: commands received by the device

---

## Runtime Behavior

1. Controller connects to the room MQTT broker
2. Controller publishes registration payload
3. Orchestrator validates required devices and capabilities
4. Registration is re-published on heartbeat and reconnect
5. Orchestrator monitors liveness continuously

---

## Enforcement Rules
- Scenes reference logical device IDs only
- Physical topics never appear in scenes
- Missing required devices block game start
- Schema changes require a new version and ADR
