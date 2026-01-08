#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./stop-room.sh <room_name>

ROOM_NAME="${1:-template}"
CONTAINER="sentient-${ROOM_NAME}"

echo "⏹ Stopping room: $ROOM_NAME"

docker stop "$CONTAINER" >/dev/null 2>&1 || true
docker rm "$CONTAINER" >/dev/null 2>&1 || true

echo "✅ Room '$ROOM_NAME' stopped"