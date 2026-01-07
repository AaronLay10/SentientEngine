#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check dependencies
for cmd in docker curl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: $cmd is required but not installed." >&2
        exit 1
    fi
done

echo "Starting two-room isolation test..."

# Build image if needed
if ! docker image inspect sentient-room:dev &>/dev/null; then
    echo "Building sentient-room:dev image..."
    docker build -t sentient-room:dev -f "$SCRIPT_DIR/Dockerfile" "$REPO_ROOT"
fi

# Cleanup any existing containers
echo "Cleaning up existing containers..."
docker rm -f sentient-pharaohs sentient-clockwork 2>/dev/null || true

# Start pharaohs container
echo "Starting pharaohs container..."
docker run -d \
    --name sentient-pharaohs \
    -p 8081:8080 \
    -p 1884:1883 \
    -p 5433:5432 \
    -v sentient_pharaohs_data:/data \
    -v "$REPO_ROOT/rooms/pharaohs:/config:ro" \
    sentient-room:dev

# Start clockwork container
echo "Starting clockwork container..."
docker run -d \
    --name sentient-clockwork \
    -p 8082:8080 \
    -p 1885:1883 \
    -p 5434:5432 \
    -v sentient_clockwork_data:/data \
    -v "$REPO_ROOT/rooms/clockwork:/config:ro" \
    sentient-room:dev

echo "Waiting for services to start..."
sleep 8

echo ""
echo "=========================================="
echo "VERIFICATION"
echo "=========================================="

echo ""
echo "=== Pharaohs (http://localhost:8081) ==="
echo "Health:"
curl -s http://localhost:8081/health
echo ""
PHARAOHS_EVENTS=$(curl -s http://localhost:8081/events)
if echo "$PHARAOHS_EVENTS" | grep -q '"room_id":"pharaohs"' && echo "$PHARAOHS_EVENTS" | grep -q '"mqtt_connected":true'; then
    echo "Startup: OK (room_id=pharaohs, mqtt_connected=true)"
else
    echo "Startup: FAILED - check /events manually"
fi

echo ""
echo "=== Clockwork (http://localhost:8082) ==="
echo "Health:"
curl -s http://localhost:8082/health
echo ""
CLOCKWORK_EVENTS=$(curl -s http://localhost:8082/events)
if echo "$CLOCKWORK_EVENTS" | grep -q '"room_id":"clockwork"' && echo "$CLOCKWORK_EVENTS" | grep -q '"mqtt_connected":true'; then
    echo "Startup: OK (room_id=clockwork, mqtt_connected=true)"
else
    echo "Startup: FAILED - check /events manually"
fi

echo ""
echo "=========================================="
echo "PORTS"
echo "=========================================="
echo "Pharaohs:  API=8081  MQTT=1884  PG=5433"
echo "Clockwork: API=8082  MQTT=1885  PG=5434"
echo ""
echo "To stop: ops/docker/stop-two-rooms.sh"
