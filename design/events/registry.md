# Event Registry (V7)

## Purpose
This registry defines the **only allowed events** in Sentient Engine V7.
All events are **strictly validated**. Unknown events are rejected/logged.

Events drive scene graph flow, puzzle resolution, loop control, timers,
and operator actions.

---

## Naming Convention
- Dot notation
- Lowercase
- Scoped by domain

Format:
<scope>.<event>

---

## Scopes

- node
- puzzle
- scene
- room
- timer
- loop
- operator
- device
- system

---

## Node Events
- node.started
- node.completed
- node.failed
- node.reset
- node.overridden

---

## Puzzle Events
- puzzle.activated
- puzzle.solved
- puzzle.failed
- puzzle.reset
- puzzle.overridden

---

## Scene Events
- scene.started
- scene.completed
- scene.failed
- scene.reset

Note:
- Scenes are **never overridden**
- scene.completed only occurs via explicit edge

---

## Loop Events
- loop.started
- loop.tick
- loop.stopped

---

## Timer Events
- timer.started
- timer.expired
- timer.cancelled

---

## Operator Events
- operator.override
- operator.reset
- operator.jump
- operator.pause
- operator.resume

---

## Device Events
- device.connected
- device.disconnected
- device.input
- device.error

---

## System Events
- system.startup
- system.shutdown
- system.error

---

## Enforcement Rules
- Only events listed in this registry are allowed
- Event names are case-sensitive
- Events must include scope and node identifiers in payload
- Any new event requires:
  - Registry update
  - Version bump
  - ADR
