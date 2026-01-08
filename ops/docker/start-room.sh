#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./start-room.sh <room_name> <api_port> <mqtt_port> <pg_port>
#
# Environment variables:
#   SENTIENT_IMAGE          - Docker image (default: sentient-room:dev)
#   SENTIENT_ADMIN_USER_FILE, SENTIENT_ADMIN_PASS_FILE     - Auth files
#   SENTIENT_OPERATOR_USER_FILE, SENTIENT_OPERATOR_PASS_FILE
#   SENTIENT_TLS_CERT_FILE, SENTIENT_TLS_KEY_FILE          - TLS files

ROOM_NAME="${1:-_template}"
API_PORT="${2:-8080}"
MQTT_PORT="${3:-1883}"
PG_PORT="${4:-5432}"

IMAGE="${SENTIENT_IMAGE:-sentient-room:dev}"
CONTAINER="sentient-${ROOM_NAME}"
DATA_VOLUME="sentient_${ROOM_NAME}_data"
CONFIG_DIR="$(pwd)/rooms/${ROOM_NAME}"

if [ ! -d "$CONFIG_DIR" ]; then
  echo "Error: Room config not found: $CONFIG_DIR"
  exit 1
fi

echo "Starting room: $ROOM_NAME (image: $IMAGE)"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Build env args for auth using *_FILE pattern (mount files, set env vars)
ENV_ARGS=""
VOLUME_ARGS=""

# Auth secrets via *_FILE pattern
if [ -n "${SENTIENT_ADMIN_USER_FILE:-}" ] && [ -f "$SENTIENT_ADMIN_USER_FILE" ]; then
  VOLUME_ARGS="$VOLUME_ARGS -v $(dirname "$SENTIENT_ADMIN_USER_FILE"):/run/secrets/auth:ro"
  ENV_ARGS="$ENV_ARGS -e SENTIENT_ADMIN_USER_FILE=/run/secrets/auth/$(basename "$SENTIENT_ADMIN_USER_FILE")"
  ENV_ARGS="$ENV_ARGS -e SENTIENT_ADMIN_PASS_FILE=/run/secrets/auth/$(basename "${SENTIENT_ADMIN_PASS_FILE:-}")"
  ENV_ARGS="$ENV_ARGS -e SENTIENT_OPERATOR_USER_FILE=/run/secrets/auth/$(basename "${SENTIENT_OPERATOR_USER_FILE:-}")"
  ENV_ARGS="$ENV_ARGS -e SENTIENT_OPERATOR_PASS_FILE=/run/secrets/auth/$(basename "${SENTIENT_OPERATOR_PASS_FILE:-}")"
fi

# TLS configuration (file paths, not *_FILE pattern)
# SENTIENT_TLS_CERT_FILE and SENTIENT_TLS_KEY_FILE are host paths to mount
TLS_ARGS=""
PORT_ARGS="-p ${API_PORT}:8080"
HTTPS_PORT=$((API_PORT + 443))
INTERNAL_HTTPS_PORT=8523  # 8080 + 443

if [ -n "${SENTIENT_TLS_CERT_FILE:-}" ] && [ -n "${SENTIENT_TLS_KEY_FILE:-}" ]; then
  CERT_DIR=$(dirname "$SENTIENT_TLS_CERT_FILE")
  CERT_FILE=$(basename "$SENTIENT_TLS_CERT_FILE")
  KEY_FILE=$(basename "$SENTIENT_TLS_KEY_FILE")
  # Mount cert directory and set env vars to container paths (not _FILE variant)
  TLS_ARGS="-e SENTIENT_TLS_CERT=/certs/${CERT_FILE} -e SENTIENT_TLS_KEY=/certs/${KEY_FILE}"
  TLS_ARGS="$TLS_ARGS -v ${CERT_DIR}:/certs:ro"
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
  $VOLUME_ARGS \
  $TLS_ARGS \
  "$IMAGE"

echo "Room '$ROOM_NAME' started"
if [ -n "${SENTIENT_TLS_CERT_FILE:-}" ]; then
  echo "   API : https://localhost:${HTTPS_PORT} (HTTPS)"
  echo "         http://localhost:${API_PORT} (redirects to HTTPS)"
else
  echo "   API : http://localhost:${API_PORT}"
fi
echo "   MQTT: localhost:${MQTT_PORT}"
echo "   PG  : localhost:${PG_PORT}"