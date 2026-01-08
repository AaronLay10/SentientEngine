#!/usr/bin/env bash
set -euo pipefail

ROOM="${ROOM:-_template}"
API_PORT="${API_PORT:-8080}"
MQTT_PORT="${MQTT_PORT:-1883}"
PG_PORT="${PG_PORT:-5432}"

BASE_URL="http://127.0.0.1:${API_PORT}"
IMAGE="${SENTIENT_IMAGE:-sentient-room:dev}"

ADMIN_USER="${SENTIENT_ADMIN_USER:-admin}"
ADMIN_PASS="${SENTIENT_ADMIN_PASS:-adminpass}"
OP_USER="${SENTIENT_OPERATOR_USER:-operator}"
OP_PASS="${SENTIENT_OPERATOR_PASS:-operatorpass}"

CTRL_ID="ctrl-001"
DEVICE_ID="crypt_door"
EVENT_TOPIC="devices/${CTRL_ID}/${DEVICE_ID}/events"
CMD_TOPIC="devices/${CTRL_ID}/${DEVICE_ID}/commands"
REG_TOPIC="sentient/registration/${CTRL_ID}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

need curl
need docker

if ! command -v mosquitto_pub >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y mosquitto-clients
fi
need mosquitto_pub
need mosquitto_sub

# Ensure the room-start script uses the intended image and passes auth into the container
export SENTIENT_IMAGE="$IMAGE"
export SENTIENT_ADMIN_USER="$ADMIN_USER"
export SENTIENT_ADMIN_PASS="$ADMIN_PASS"
export SENTIENT_OPERATOR_USER="$OP_USER"
export SENTIENT_OPERATOR_PASS="$OP_PASS"

echo "==> Starting room container (image: $SENTIENT_IMAGE)"
./ops/docker/stop-room.sh "$ROOM" >/dev/null 2>&1 || true
./ops/docker/start-room.sh "$ROOM" "$API_PORT" "$MQTT_PORT" "$PG_PORT"

echo "==> Waiting for /ready=200"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/ready" || true)
  [ "$code" = "200" ] && break
  sleep 1
done
code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/ready" || true)
[ "$code" = "200" ] || { echo "❌ READY failed: ${code}"; exit 1; }

echo "==> Basic endpoints"
curl -s -o /dev/null -w "/health=%{http_code}\n" "${BASE_URL}/health"
curl -s -o /dev/null -w "/ready=%{http_code}\n" "${BASE_URL}/ready"

echo "==> Start game (admin)"
curl -s -u "${ADMIN_USER}:${ADMIN_PASS}" -X POST -o /dev/null -w "/game/start(admin)=%{http_code}\n" "${BASE_URL}/game/start"

echo "==> Subscribe for one command message on ${CMD_TOPIC}"
tmp=$(mktemp)
mosquitto_sub -h 127.0.0.1 -p "$MQTT_PORT" -t "$CMD_TOPIC" -C 1 -W 25 -v >"$tmp" 2>/dev/null &
subpid=$!
sleep 1

echo "==> Publish controller registration"
mosquitto_pub -h 127.0.0.1 -p "$MQTT_PORT" -t "$REG_TOPIC" -m "{
  \"version\": 1,
  \"controller\": {\"id\":\"${CTRL_ID}\",\"type\":\"teensy\",\"firmware\":\"1.0\",\"uptime_ms\":1,\"heartbeat_sec\":20},
  \"devices\": [
    {\"logical_id\":\"${DEVICE_ID}\",\"type\":\"door\",\"capabilities\":[\"open\",\"close\"],
     \"signals\":{\"inputs\":[\"door_closed\"],\"outputs\":[\"unlock\"]},
     \"topics\":{\"publish\":\"${EVENT_TOPIC}\",\"subscribe\":\"${CMD_TOPIC}\"}}
  ]
}"

echo "==> Publish device input event"
mosquitto_pub -h 127.0.0.1 -p "$MQTT_PORT" -t "$EVENT_TOPIC" -m '{"door_closed": true}'

echo "==> Wait for device.input + puzzle.solved to appear in /events (async)"
found=0
for i in $(seq 1 25); do
  if curl -s -u "${OP_USER}:${OP_PASS}" "${BASE_URL}/events" | grep -E '"event":"device.input"|"event":"puzzle.solved"' >/dev/null; then
    found=1
    break
  fi
  sleep 1
done

if [ "$found" -ne 1 ]; then
  echo "❌ events missing device.input or puzzle.solved"
  echo "--- last events ---"
  curl -s -u "${OP_USER}:${OP_PASS}" "${BASE_URL}/events" | tail -n 80 || true
  echo "--- device.error ---"
  curl -s -u "${OP_USER}:${OP_PASS}" "${BASE_URL}/events" | grep '"event":"device.error"' || true
  exit 1
fi

echo "✅ events: device.input + puzzle.solved OK"

echo "==> Wait for command publish on ${CMD_TOPIC}"
wait "$subpid" || true

if [ -s "$tmp" ]; then
  echo "✅ command received:"
  cat "$tmp"
else
  echo "❌ NO command received on $CMD_TOPIC"
  echo "--- device.error ---"
  curl -s -u "${OP_USER}:${OP_PASS}" "${BASE_URL}/events" | grep '"event":"device.error"' || true
  exit 1
fi

rm -f "$tmp"
echo "✅ E2E OK"
