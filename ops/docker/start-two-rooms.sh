#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

"$SCRIPT_DIR/start-room.sh" pharaohs 8081 1884 5433
"$SCRIPT_DIR/start-room.sh" clockwork 8082 1885 5434