# Technology Decisions — V7

## Confirmed stack

| Layer | Technology | Purpose |
|------|-----------|---------|
| Orchestrator | Go | Deterministic runtime authority |
| API | Go (net/http or Fiber) | UI command/query |
| Event Model | In-process event bus | Room-local messaging |
| Persistence | PostgreSQL (per room) | Event log + projections + graph storage |
| Broker | Eclipse Mosquitto (per room) | Device connectivity |
| UI | React + TypeScript SPA | Single app, role-gated |
| Real-time | WebSockets | Live updates |
| Deployment | Docker | Per-room isolation |
| Storage | Named Docker volumes | Durable per-room data |

## Explicit rejections (V7)
- Shared brokers / shared databases across rooms
- External brokers (Kafka/NATS) in V7 core
- Generic workflow engines (Temporal) for scene runtime

## Future-safe swaps
- DB/event store can change later only if event-sourcing semantics are preserved.
- UI framework can change later if editor + realtime semantics remain.