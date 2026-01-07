# Sentient Engine V7 - Docker Deployment

Single-container-per-room deployment using s6-overlay to run:
- Orchestrator (with embedded API)
- Mosquitto MQTT broker
- PostgreSQL database

## Architecture

Each room runs as ONE container with all services managed by s6-overlay.
No sidecars, no external dependencies.

```
┌─────────────────────────────────────────┐
│           sentient-room container       │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ PostgreSQL  │  │    Mosquitto    │  │
│  │  :5432      │  │     :1883       │  │
│  └─────────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────┐   │
│  │     Orchestrator + API          │   │
│  │          :8080                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Volumes

| Path | Purpose |
|------|---------|
| `/data/db` | PostgreSQL data |
| `/data/mqtt` | Mosquitto persistence |
| `/config` | Room configuration (room.yaml, devices.yaml, scene-graph.json) |

## Build

From repository root:

```bash
docker build -t sentient-room:dev -f ops/docker/Dockerfile .
```

## Run Single Room

```bash
docker run -d \
  --name room-crypt \
  -p 8080:8080 \
  -p 1883:1883 \
  -v room-crypt-db:/data/db \
  -v room-crypt-mqtt:/data/mqtt \
  -v $(pwd)/rooms/_template:/config:ro \
  sentient-room:dev
```

## Run Two Rooms Simultaneously

Each room needs different host ports to avoid conflicts:

```bash
# Room 1: Crypt (ports 8080, 1883)
docker run -d \
  --name room-crypt \
  -p 8080:8080 \
  -p 1883:1883 \
  -v room-crypt-db:/data/db \
  -v room-crypt-mqtt:/data/mqtt \
  -v $(pwd)/rooms/crypt:/config:ro \
  sentient-room:dev

# Room 2: Lab (ports 8081, 1884)
docker run -d \
  --name room-lab \
  -p 8081:8080 \
  -p 1884:1883 \
  -v room-lab-db:/data/db \
  -v room-lab-mqtt:/data/mqtt \
  -v $(pwd)/rooms/lab:/config:ro \
  sentient-room:dev
```

Each container:
- Has its own named volumes (no shared state)
- Exposes different host ports
- Mounts different room config directories

## Using Docker Compose

Quick start with template room:

```bash
cd ops/docker
docker compose up -d
```

For multiple rooms, create a compose file per room or use profiles.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTIENT_CONFIG_DIR` | `/config` | Path to room configuration |
| `MQTT_URL` | `tcp://localhost:1883` | MQTT broker URL |
| `POSTGRES_USER` | `sentient` | PostgreSQL user |
| `POSTGRES_DB` | `sentient` | PostgreSQL database |

## Verify Running Container

```bash
# Check health endpoint
curl http://localhost:8080/health

# Check events
curl http://localhost:8080/events

# Check logs
docker logs room-crypt
```

## Stop and Cleanup

```bash
# Stop container
docker stop room-crypt

# Remove container
docker rm room-crypt

# Remove volumes (deletes all data!)
docker volume rm room-crypt-db room-crypt-mqtt
```
