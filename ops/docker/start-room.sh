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

# TLS configuration (optional)
# When TLS is enabled:
#   - Internal HTTP port: 8080 (for redirects)
#   - Internal HTTPS port: 8523 (8080 + 443)
TLS_ARGS=""
PORT_ARGS="-p ${API_PORT}:8080"
HTTPS_PORT=$((API_PORT + 443))
INTERNAL_HTTPS_PORT=8523  # 8080 + 443

if [ -n "${SENTIENT_TLS_CERT:-}" ] && [ -n "${SENTIENT_TLS_KEY:-}" ]; then
  # Mount cert and key files (may be in different directories)
  CERT_FILE=$(basename "$SENTIENT_TLS_CERT")
  KEY_FILE=$(basename "$SENTIENT_TLS_KEY")
  TLS_ARGS="-e SENTIENT_TLS_CERT=/certs/${CERT_FILE} -e SENTIENT_TLS_KEY=/certs/${KEY_FILE}"
  TLS_ARGS="$TLS_ARGS -v ${SENTIENT_TLS_CERT}:/certs/${CERT_FILE}:ro"
  TLS_ARGS="$TLS_ARGS -v ${SENTIENT_TLS_KEY}:/certs/${KEY_FILE}:ro"
  # Expose both HTTP (redirect) and HTTPS ports
  PORT_ARGS="-p ${API_PORT}:8080 -p ${HTTPS_PORT}:${INTERNAL_HTTPS_PORT}"
fi

docker run -d \
  --name "$CONTAINER" \
  $PORT_ARGS \
  -p "${MQTT_PORT}:1883" \
  -p "${PG_PORT}:5432" \
  -v "${DATA_VOLUME}:/data" \
  -v "${CONFIG_DIR}:/config" \
  $ENV_ARGS \
  $TLS_ARGS \
  "$IMAGE"

echo "✅ Room '$ROOM_NAME' started"
if [ -n "${SENTIENT_TLS_CERT:-}" ]; then
  echo "   API : https://localhost:${HTTPS_PORT} (HTTPS)"
  echo "         http://localhost:${API_PORT} (redirects to HTTPS)"
else
  echo "   API : http://localhost:${API_PORT}"
fi
echo "   MQTT: localhost:${MQTT_PORT}"
echo "   PG  : localhost:${PG_PORT}"