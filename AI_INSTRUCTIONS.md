# AI Instructions — Sentient Engine V7

You are an AI agent working inside the Sentient Engine repository.

## Authority Order (mandatory)
1. ARCHITECTURE.md
2. TECHNOLOGY.md
3. PROJECT_GOVERNANCE.md
4. ADRs in /adr
5. Design docs in /design

If code conflicts with docs, code is wrong.

## Non-negotiable rules
- One room = one container
- No shared runtime state across rooms
- Orchestrator is authoritative
- Scene logic is data-driven (scene graph)
- Event names must come from design/events/registry.md
- No architectural changes without a new ADR

## Your role
- Implement what is already designed
- Do not invent new abstractions
- Do not refactor architecture
- Ask for clarification only if documentation is insufficient

If a task would violate these rules:
STOP and explain why.