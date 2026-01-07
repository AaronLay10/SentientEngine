# ADR-002: Scene Graph Authored as Data (With Limited Code Hooks)

## Status
Accepted

## Context
Previous versions of Sentient Engine embedded scene flow logic directly
in application code. This led to:
- Tight coupling between story logic and runtime code
- Difficulty iterating on scenes without redeploying
- Increased rewrite pressure when behavior felt “wrong”
- Confusion over runtime authority between UI and code

Version 7 introduces a Graph Scene Editor as the primary authoring tool.
To be effective, the scene model must be data-driven and executable by
the Orchestrator in a deterministic way.

## Decision
Scene flow SHALL be authored as a data-defined graph.

Specifically:
- Scenes, transitions, and conditions are defined as graph data
- The Orchestrator executes the graph at runtime
- Scene flow is not implemented directly in Go code

Limited code hooks ARE allowed under strict rules:
- Code hooks may only implement reusable actions or evaluators
- Code hooks may not define scene-to-scene flow
- All flow decisions must still resolve through graph data

The Graph Scene Editor is the source of truth for scene structure.

## Consequences
### Positive
- Creatives can modify scenes without changing runtime code
- Scene logic is inspectable, versionable, and replayable
- Reduced rewrite pressure when adjusting game flow
- Clear separation between “what happens” (data) and “how it happens” (code)

### Negative
- Some complex logic requires careful graph modeling
- Code hooks must be tightly governed to avoid abuse

These tradeoffs are intentional.

## Alternatives Considered
- All scene logic in code
- Fully code-defined scenes with configuration
- Unrestricted hybrid model

These were rejected due to historical instability and increased coupling.

## Enforcement
- Scene transitions must originate from graph data
- Code may not introduce hidden flow control
- Any expansion of code hooks requires a new ADR