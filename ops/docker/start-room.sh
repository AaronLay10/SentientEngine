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

# Build env args for auth (only if set)
ENV_ARGS=""
[ -n "${SENTIENT_ADMIN_USER:-}" ] && ENV_ARGS="$ENV_ARGS -e SENTIENT_ADMIN_USER=$SENTIENT_ADMIN_USER"
[ -n "${SENTIENT_ADMIN_PASS:-}" ] && ENV_ARGS="$ENV_ARGS -e SENTIENT_ADMIN_PASS=$SENTIENT_ADMIN_PASS"
[ -n "${SENTIENT_OPERATOR_USER:-}" ] && ENV_ARGS="$ENV_ARGS -e SENTIENT_OPERATOR_USER=$SENTIENT_OPERATOR_USER"
[ -n "${SENTIENT_OPERATOR_PASS:-}" ] && ENV_ARGS="$ENV_ARGS -e SENTIENT_OPERATOR_PASS=$SENTIENT_OPERATOR_PASS"

docker run -d \
  --name "$CONTAINER" \
  -p "${API_PORT}:8080" \
  -p "${MQTT_PORT}:1883" \
  -p "${PG_PORT}:5432" \
  -v "${DATA_VOLUME}:/data" \
  -v "${CONFIG_DIR}:/config" \
  $ENV_ARGS \
  "$IMAGE"

echo "✅ Room '$ROOM_NAME' started"
echo "   API : http://localhost:${API_PORT}"
echo "   MQTT: localhost:${MQTT_PORT}"
echo "   PG  : localhost:${PG_PORT}"