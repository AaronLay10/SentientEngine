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

## Versioning

Sentient Engine uses semantic versioning (MAJOR.MINOR.PATCH). The version is embedded
in the binary at build time and reported via:

- `/health` endpoint (`version` field)
- `/ready` endpoint (`version` field)
- `system.startup` event (`version` field)
- Docker image labels (OCI standard)

### Version Scheme

| Version | Meaning |
|---------|---------|
| `1.0.0` | Initial stable release |
| `1.0.x` | Patch releases (bug fixes, no breaking changes) |
| `1.x.0` | Minor releases (new features, backward compatible) |
| `x.0.0` | Major releases (breaking changes) |

## Build

From repository root:

```bash
docker build -t sentient-room:dev -f ops/docker/Dockerfile .
```

### Building a Release Image

For tagged releases, pass version and git metadata as build arguments:

```bash
VERSION=1.0.0
GIT_COMMIT=$(git rev-parse HEAD)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

docker build \
  --build-arg VERSION=${VERSION} \
  --build-arg GIT_COMMIT=${GIT_COMMIT} \
  --build-arg BUILD_DATE=${BUILD_DATE} \
  -t sentient-room:${VERSION} \
  -t sentient-room:latest \
  -f ops/docker/Dockerfile .
```

This embeds:
- Version in the binary (reported by `/health`, `/ready`, `system.startup`)
- OCI labels for image inspection

### Verify Image Labels

```bash
docker inspect sentient-room:1.0.0 --format '{{json .Config.Labels}}' | jq .
```

Output:
```json
{
  "org.opencontainers.image.created": "2024-01-15T10:30:00Z",
  "org.opencontainers.image.revision": "abc123def456...",
  "org.opencontainers.image.version": "1.0.0"
}
```

### Verify Runtime Version

```bash
# Start container
docker run -d --name test -p 8080:8080 sentient-room:1.0.0

# Check version via /health
curl -s http://localhost:8080/health | jq .version
# => "1.0.0"

# Check version via /ready
curl -s http://localhost:8080/ready | jq .version
# => "1.0.0"

# Check version in system.startup event
curl -s http://localhost:8080/events | jq '.[0].fields.version'
# => "1.0.0"

# Cleanup
docker rm -f test
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

## Authentication

Authentication is optional. If no credentials are configured, all endpoints are accessible without auth.

| Variable | Description |
|----------|-------------|
| `SENTIENT_ADMIN_USER` | Admin username |
| `SENTIENT_ADMIN_PASS` | Admin password |
| `SENTIENT_OPERATOR_USER` | Operator username |
| `SENTIENT_OPERATOR_PASS` | Operator password |

### Using Environment Variables

```bash
docker run -d \
  --name room-crypt \
  -p 8080:8080 \
  -e SENTIENT_ADMIN_USER=admin \
  -e SENTIENT_ADMIN_PASS=supersecret \
  -e SENTIENT_OPERATOR_USER=operator \
  -e SENTIENT_OPERATOR_PASS=opsecret \
  -v $(pwd)/rooms/_template:/config:ro \
  sentient-room:dev
```

### Using File-Based Secrets (*_FILE convention)

For Docker secrets, Kubernetes secrets, or systemd credentials, use the `*_FILE` variants.
The value is read from the specified file path at startup.

```bash
# Create secrets directory
mkdir -p ./secrets
echo -n "admin" > ./secrets/admin_user
echo -n "supersecret" > ./secrets/admin_pass

docker run -d \
  --name room-crypt \
  -p 8080:8080 \
  -e SENTIENT_ADMIN_USER_FILE=/run/secrets/admin_user \
  -e SENTIENT_ADMIN_PASS_FILE=/run/secrets/admin_pass \
  -v $(pwd)/secrets:/run/secrets:ro \
  -v $(pwd)/rooms/_template:/config:ro \
  sentient-room:dev
```

With Docker Swarm secrets:

```yaml
services:
  room:
    image: sentient-room:dev
    secrets:
      - admin_user
      - admin_pass
    environment:
      - SENTIENT_ADMIN_USER_FILE=/run/secrets/admin_user
      - SENTIENT_ADMIN_PASS_FILE=/run/secrets/admin_pass

secrets:
  admin_user:
    external: true
  admin_pass:
    external: true
```

## TLS Configuration

| Variable | Description |
|----------|-------------|
| `SENTIENT_TLS_CERT` | Path to TLS certificate file |
| `SENTIENT_TLS_KEY` | Path to TLS private key file |

### Using Environment Variables

```bash
docker run -d \
  --name room-crypt \
  -p 8443:8443 \
  -e SENTIENT_TLS_CERT=/certs/server.crt \
  -e SENTIENT_TLS_KEY=/certs/server.key \
  -v $(pwd)/certs:/certs:ro \
  -v $(pwd)/rooms/_template:/config:ro \
  sentient-room:dev
```

### Using File-Based Secrets

```bash
# Store cert paths in files (useful for dynamic cert rotation)
echo -n "/certs/server.crt" > ./secrets/tls_cert_path
echo -n "/certs/server.key" > ./secrets/tls_key_path

docker run -d \
  --name room-crypt \
  -p 8443:8443 \
  -e SENTIENT_TLS_CERT_FILE=/run/secrets/tls_cert_path \
  -e SENTIENT_TLS_KEY_FILE=/run/secrets/tls_key_path \
  -v $(pwd)/secrets:/run/secrets:ro \
  -v $(pwd)/certs:/certs:ro \
  -v $(pwd)/rooms/_template:/config:ro \
  sentient-room:dev
```

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
