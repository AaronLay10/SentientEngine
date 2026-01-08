#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./start-room.sh <room_name> <api_port> <mqtt_port> <pg_port>

ROOM_NAME="${1:-_template}"
API_PORT="${2:-8080}"
MQTT_PORT="${3:-1883}"
PG_PORT="${4:-5432}"

IMAGE="sentient-room:dev"
CONTAINER="sentient-${ROOM_NAME}"
DATA_VOLUME="sentient_${ROOM_NAME}_data"
CONFIG_DIR="$(pwd)/rooms/${ROOM_NAME}"

if [ ! -d "$CONFIG_DIR" ]; then
  echo "❌ Room config not found: $CONFIG_DIR"
  exit 1
fi

echo "▶ Starting room: $ROOM_NAME"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER" \
  -p "${API_PORT}:8080" \
  -p "${MQTT_PORT}:1883" \
  -p "${PG_PORT}:5432" \
  -v "${DATA_VOLUME}:/data" \
  -v "${CONFIG_DIR}:/config" \
  "$IMAGE"

echo "✅ Room '$ROOM_NAME' started"
echo "   API : http://localhost:${API_PORT}"
echo "   MQTT: localhost:${MQTT_PORT}"
echo "   PG  : localhost:${PG_PORT}"