# Project Governance — V7

## Purpose
Prevent architectural drift and rewrite cycles.

## Change rules
- Any architecture change requires an ADR written first.
- Any new infrastructure dependency requires an ADR.
- Implementation pain is not an architectural justification.

## Rewrite tripwire
If considering a rewrite, answer:
1) What exact behavior is broken?
2) Can it be fixed without architecture change?
3) Has this happened in previous rewrites?
4) Is this discomfort vs constraint?

If unclear → do not rewrite.

## Rooms policy
- `runtime/` contains the engine (shared)
- `rooms/<room>/` contains deployment content (config, graphs, media, scripts)
- Do not duplicate engine code per room.