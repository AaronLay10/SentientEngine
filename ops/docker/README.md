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

## Two-Room Isolation Test

Prove V7 isolation by running pharaohs and clockwork rooms simultaneously:

```bash
# Start both rooms
./ops/docker/run-two-rooms.sh

# Stop both rooms
./ops/docker/stop-two-rooms.sh
```

### Port Mapping

| Room      | API   | MQTT  | PostgreSQL |
|-----------|-------|-------|------------|
| pharaohs  | 8081  | 1884  | 5433       |
| clockwork | 8082  | 1885  | 5434       |

## MQTT Broker Ports (Important)

When subscribing to MQTT topics from external tools (mosquitto_sub, MQTT Explorer, etc.), use the correct host port:

| Deployment         | Host MQTT Port | Notes                                           |
|--------------------|----------------|-------------------------------------------------|
| Single room        | 1883           | Default single-room deployment                  |
| Pharaohs two-room  | 1884           | pharaohs room in two-room setup                 |
| Clockwork two-room | 1885           | clockwork room in two-room setup                |

Example commands:
```bash
# Single room - subscribe to device commands
mosquitto_sub -h localhost -p 1883 -t 'devices/#'

# Pharaohs two-room - subscribe to device commands
mosquitto_sub -h localhost -p 1884 -t 'devices/#'

# Clockwork two-room - subscribe to device commands
mosquitto_sub -h localhost -p 1885 -t 'devices/#'
```

### Verify Isolation

```bash
# Check health
curl http://localhost:8081/health   # pharaohs
curl http://localhost:8082/health   # clockwork

# Verify each room reports its own room_id and mqtt_connected=true
curl -s http://localhost:8081/events | grep system.startup
# => "room_id":"pharaohs"..."mqtt_connected":true

curl -s http://localhost:8082/events | grep system.startup
# => "room_id":"clockwork"..."mqtt_connected":true

# Verify isolation: actions in one room don't affect the other
# POST to pharaohs and check clockwork /events shows no change
```

### Cleanup

```bash
# Stop containers
./ops/docker/stop-two-rooms.sh

# Remove data volumes (deletes all data!)
docker volume rm sentient_pharaohs_data sentient_clockwork_data
```

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
