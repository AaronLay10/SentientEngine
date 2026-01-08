#!/bin/bash
#
# test-alerts.sh - Validate Sentient alerting system
#
# This script simulates failures to verify alerts fire correctly.
# It starts a local webhook receiver and triggers failure conditions.
#
# Usage: ./test-alerts.sh <room_name> [api_port]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_step() { echo -e "${CYAN}[TEST]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $(basename "$0") <room_name> [api_port]

Validate the Sentient alerting system by simulating failures.

Arguments:
  room_name    Name of the room container (e.g., pharaohs)
  api_port     API port for health checks (default: 8080)

Requirements:
  - Room container must be running
  - Python3 must be available (for webhook receiver)

Example:
  $(basename "$0") pharaohs 8081
EOF
}

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

ROOM_NAME="$1"
API_PORT="${2:-8080}"
CONTAINER_NAME="sentient-${ROOM_NAME}"
WEBHOOK_PORT=19999
WEBHOOK_LOG="/tmp/sentient-alert-test-$$.log"
WEBHOOK_PID=""

# Cleanup on exit
cleanup() {
    if [[ -n "$WEBHOOK_PID" ]]; then
        log_info "Stopping webhook receiver (PID $WEBHOOK_PID)..."
        kill "$WEBHOOK_PID" 2>/dev/null || true
        wait "$WEBHOOK_PID" 2>/dev/null || true
    fi
    rm -f "$WEBHOOK_LOG"
}
trap cleanup EXIT

# Check prerequisites
check_prereqs() {
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is required but not found"
        exit 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "Container ${CONTAINER_NAME} is not running"
        exit 1
    fi

    # Check if API is responding
    if ! curl -sf "http://127.0.0.1:${API_PORT}/health" > /dev/null 2>&1; then
        log_error "API not responding on port ${API_PORT}"
        exit 1
    fi

    log_info "Prerequisites OK"
}

# Start webhook receiver
start_webhook_receiver() {
    log_info "Starting webhook receiver on port ${WEBHOOK_PORT}..."

    python3 - "$WEBHOOK_PORT" "$WEBHOOK_LOG" << 'PYEOF' &
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

port = int(sys.argv[1])
log_file = sys.argv[2]

class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')

        try:
            data = json.loads(body)
            with open(log_file, 'a') as f:
                f.write(json.dumps(data) + '\n')
            print(f"[WEBHOOK] Received: {data.get('event', 'unknown')} severity={data.get('severity', 'unknown')}")
        except json.JSONDecodeError:
            print(f"[WEBHOOK] Invalid JSON: {body[:100]}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

print(f"Webhook receiver listening on port {port}")
HTTPServer(('0.0.0.0', port), WebhookHandler).serve_forever()
PYEOF

    WEBHOOK_PID=$!
    sleep 1

    if ! kill -0 "$WEBHOOK_PID" 2>/dev/null; then
        log_error "Failed to start webhook receiver"
        exit 1
    fi

    log_info "Webhook receiver started (PID $WEBHOOK_PID)"
}

# Wait for alert in log
wait_for_alert() {
    local event_type="$1"
    local timeout="${2:-60}"
    local start_time=$(date +%s)

    log_info "Waiting for ${event_type} alert (timeout: ${timeout}s)..."

    while true; do
        if [[ -f "$WEBHOOK_LOG" ]] && grep -q "\"event\":\"${event_type}\"" "$WEBHOOK_LOG"; then
            local alert=$(grep "\"event\":\"${event_type}\"" "$WEBHOOK_LOG" | tail -1)
            log_info "Alert received: $(echo "$alert" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"{d[\"event\"]} severity={d[\"severity\"]} msg={d.get(\"message\",\"\")}")')"
            return 0
        fi

        local elapsed=$(($(date +%s) - start_time))
        if [[ $elapsed -ge $timeout ]]; then
            log_error "Timeout waiting for ${event_type} alert"
            return 1
        fi

        sleep 1
    done
}

# Check metrics endpoint
check_metrics() {
    local metric="$1"
    local expected="$2"

    local value=$(curl -sf "http://127.0.0.1:${API_PORT}/metrics" 2>/dev/null | grep "^${metric}{" | sed 's/.*} //')

    if [[ "$value" == "$expected" ]]; then
        log_info "Metric ${metric}=${value} (expected ${expected}) OK"
        return 0
    else
        log_warn "Metric ${metric}=${value} (expected ${expected})"
        return 1
    fi
}

# Test MQTT disconnect alert
test_mqtt_disconnect() {
    log_step "=== Testing MQTT Disconnect Alert ==="

    # Clear log
    > "$WEBHOOK_LOG"

    # Check initial state
    check_metrics "sentient_mqtt_connected" "1" || true

    # Stop mosquitto
    log_info "Stopping mosquitto in container..."
    docker exec "$CONTAINER_NAME" pkill mosquitto 2>/dev/null || true

    # Wait for alert (MQTT has 30s default delay, but we set shorter for testing)
    # The alert monitor runs every 10s, so wait up to 45s
    if wait_for_alert "mqtt_disconnected" 45; then
        log_info "MQTT disconnect alert: PASS"
    else
        log_error "MQTT disconnect alert: FAIL"
        return 1
    fi

    # Check metrics updated
    sleep 2
    check_metrics "sentient_mqtt_connected" "0" || true

    # Verify alert payload (including alert_id)
    local alert=$(grep "mqtt_disconnected" "$WEBHOOK_LOG" | grep -v "restored" | tail -1)
    if echo "$alert" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["alert_id"], "missing alert_id"; assert d["room_name"]; assert d["timestamp"]; assert d["severity"]=="warning"'; then
        log_info "Alert payload validation: PASS"
        local alert_id=$(echo "$alert" | python3 -c 'import sys,json; print(json.load(sys.stdin)["alert_id"])')
        log_info "Alert ID: ${alert_id}"
    else
        log_error "Alert payload validation: FAIL"
        return 1
    fi

    # Restart mosquitto
    log_info "Restarting mosquitto..."
    docker exec "$CONTAINER_NAME" /usr/sbin/mosquitto -d -c /etc/mosquitto/mosquitto.conf 2>/dev/null || true
    sleep 5

    # Check for recovery alert (should include related_alert_id for correlation)
    if grep -q "MQTT connection restored" "$WEBHOOK_LOG"; then
        log_info "MQTT recovery alert: PASS"
        local recovery=$(grep "MQTT connection restored" "$WEBHOOK_LOG" | tail -1)
        if echo "$recovery" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("details",{}).get("related_alert_id"), "missing related_alert_id"' 2>/dev/null; then
            local related_id=$(echo "$recovery" | python3 -c 'import sys,json; print(json.load(sys.stdin)["details"]["related_alert_id"])')
            log_info "Recovery alert correlates to: ${related_id}"
        else
            log_warn "Recovery alert missing related_alert_id (correlation feature)"
        fi
    else
        log_warn "MQTT recovery alert not received (may need more time)"
    fi

    log_info "MQTT disconnect test complete"
}

# Test Postgres unavailable alert
test_postgres_unavailable() {
    log_step "=== Testing PostgreSQL Unavailable Alert ==="

    # Clear log
    > "$WEBHOOK_LOG"

    # Check initial state
    check_metrics "sentient_postgres_connected" "1" || true

    # Stop postgres (this is tricky - we can't easily stop it without affecting the app)
    # Instead, we'll test by checking that the alert system is wired up correctly
    log_warn "Postgres failure simulation requires stopping the database,"
    log_warn "which would affect the running application."
    log_warn "Skipping destructive postgres test - verify manually if needed."

    log_info "PostgreSQL test: SKIPPED (non-destructive)"
}

# Verify no duplicate alerts
test_no_duplicate_alerts() {
    log_step "=== Testing Alert De-duplication ==="

    # Count alerts in log (exclude recovery alerts with "restored")
    local mqtt_alerts=$(grep "mqtt_disconnected" "$WEBHOOK_LOG" 2>/dev/null | grep -v "restored" | wc -l || echo "0")

    if [[ "$mqtt_alerts" -le 2 ]]; then
        log_info "De-duplication check: PASS (${mqtt_alerts} MQTT alerts, expected <=2)"
    else
        log_error "De-duplication check: FAIL (${mqtt_alerts} MQTT alerts, expected <=2)"
        return 1
    fi
}

# Main test sequence
main() {
    echo ""
    echo "=========================================="
    echo " Sentient Alert System Validation"
    echo "=========================================="
    echo " Room: ${ROOM_NAME}"
    echo " Container: ${CONTAINER_NAME}"
    echo " API Port: ${API_PORT}"
    echo "=========================================="
    echo ""

    check_prereqs
    start_webhook_receiver

    # Note: For full testing, the container needs SENTIENT_ALERT_WEBHOOK_URL set
    log_warn "For alerts to be sent to webhook, container must have:"
    log_warn "  SENTIENT_ALERT_WEBHOOK_URL=http://host.docker.internal:${WEBHOOK_PORT}/webhook"
    log_warn ""
    log_warn "If alerts are not received, they will be logged to container stdout."
    log_warn "Check with: docker logs ${CONTAINER_NAME} | grep ALERT"
    echo ""

    # Run tests
    test_mqtt_disconnect || true
    test_postgres_unavailable || true
    test_no_duplicate_alerts || true

    echo ""
    echo "=========================================="
    echo " Test Summary"
    echo "=========================================="

    if [[ -f "$WEBHOOK_LOG" ]]; then
        local total_alerts=$(wc -l < "$WEBHOOK_LOG")
        log_info "Total alerts received: ${total_alerts}"

        if [[ $total_alerts -gt 0 ]]; then
            echo ""
            echo "Alerts received:"
            cat "$WEBHOOK_LOG" | python3 -c '
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        print(f"  - {d[\"event\"]} (severity={d[\"severity\"]}) at {d[\"timestamp\"]}")
    except:
        pass
'
        fi
    else
        log_warn "No alerts received (check container has webhook URL configured)"
    fi

    echo ""
    log_info "Alert test complete. Check container logs for any logged alerts:"
    echo "  docker logs ${CONTAINER_NAME} 2>&1 | grep -i alert"
}

main "$@"
