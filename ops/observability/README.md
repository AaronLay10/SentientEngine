# Sentient Engine Observability

This document describes the observability features available in Sentient Engine V7,
including metrics export and alerting.

## Overview

Sentient Engine provides:
- **Prometheus-compatible metrics** via `/metrics` endpoint
- **Alert webhooks** for critical infrastructure events
- **Health and readiness** probes for orchestration

## Metrics Endpoint

### Endpoint

```
GET /metrics
```

Returns metrics in Prometheus text format (no authentication required).

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `sentient_uptime_seconds` | gauge | Seconds since room container started |
| `sentient_rooms_active` | gauge | Room active status (1=active, 0=inactive) |
| `sentient_events_total` | counter | Total events emitted since startup |
| `sentient_mqtt_connected` | gauge | MQTT broker connection status (1=connected, 0=disconnected) |
| `sentient_postgres_connected` | gauge | PostgreSQL connection status (1=connected, 0=disconnected) |
| `sentient_ws_clients` | gauge | Active WebSocket client connections |
| `sentient_backup_last_success_timestamp` | gauge | Unix timestamp of last successful backup (-1 if unknown) |

### Labels

All metrics include these labels:
- `room` - Room name from configuration
- `instance` - Container hostname
- `version` - Sentient Engine version

### Example Output

```
# HELP sentient_uptime_seconds Number of seconds since the room container started
# TYPE sentient_uptime_seconds gauge
sentient_uptime_seconds{room="pharaohs",instance="abc123",version="1.0.0"} 3600.5

# HELP sentient_rooms_active Whether the room is active (1) or not (0)
# TYPE sentient_rooms_active gauge
sentient_rooms_active{room="pharaohs",instance="abc123",version="1.0.0"} 1

# HELP sentient_events_total Total number of events emitted since startup
# TYPE sentient_events_total counter
sentient_events_total{room="pharaohs",instance="abc123",version="1.0.0"} 1542

# HELP sentient_mqtt_connected Whether MQTT broker is connected (1) or not (0)
# TYPE sentient_mqtt_connected gauge
sentient_mqtt_connected{room="pharaohs",instance="abc123",version="1.0.0"} 1

# HELP sentient_postgres_connected Whether PostgreSQL is connected (1) or not (0)
# TYPE sentient_postgres_connected gauge
sentient_postgres_connected{room="pharaohs",instance="abc123",version="1.0.0"} 1

# HELP sentient_ws_clients Number of active WebSocket client connections
# TYPE sentient_ws_clients gauge
sentient_ws_clients{room="pharaohs",instance="abc123",version="1.0.0"} 3

# HELP sentient_backup_last_success_timestamp Unix timestamp of last successful backup (-1 if unknown)
# TYPE sentient_backup_last_success_timestamp gauge
sentient_backup_last_success_timestamp{room="pharaohs",instance="abc123",version="1.0.0"} -1
```

## Prometheus Configuration

### Scrape Config Example

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'sentient'
    scrape_interval: 15s
    static_configs:
      # Single room
      - targets: ['sentient-pharaohs:8080']
        labels:
          environment: 'production'

      # Multiple rooms
      - targets:
          - 'sentient-pharaohs:8081'
          - 'sentient-clockwork:8082'
        labels:
          environment: 'production'

    # Optional: relabel to use room label as instance
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
```

### Docker Network Scraping

If Prometheus runs in the same Docker network:

```yaml
scrape_configs:
  - job_name: 'sentient'
    dns_sd_configs:
      - names:
          - 'tasks.sentient-pharaohs'
          - 'tasks.sentient-clockwork'
        type: 'A'
        port: 8080
```

## Alerting

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTIENT_ALERT_WEBHOOK_URL` | Webhook URL for alerts | (none - alerts logged only) |
| `SENTIENT_MQTT_ALERT_DELAY` | Duration before MQTT disconnect alert | `30s` |
| `SENTIENT_POSTGRES_ALERT_DELAY` | Duration before PostgreSQL disconnect alert | `5s` |

### Alert Events

| Event | Severity | Trigger |
|-------|----------|---------|
| `mqtt_disconnected` | warning | MQTT disconnected for > 30s |
| `postgres_unavailable` | critical | PostgreSQL becomes unavailable |
| `container_restart` | warning | Container restart detected (if detectable) |

### Webhook Payload

Alerts are sent as HTTP POST with JSON body:

```json
{
  "alert_id": "pharaohs-mqtt_disconnected-1705329022000",
  "room_name": "pharaohs",
  "event": "mqtt_disconnected",
  "timestamp": "2024-01-15T14:30:22Z",
  "severity": "warning",
  "message": "MQTT broker disconnected",
  "details": {
    "disconnected_since": "2024-01-15T14:29:52Z",
    "disconnected_seconds": 30
  }
}
```

### Alert ID

Each alert includes a unique `alert_id` for:
- **Deduplication**: Receivers can track which alerts have been processed
- **Correlation**: Recovery alerts include `related_alert_id` to link back to the original alert
- **Log searching**: Search logs using the alert_id to find related events

Format: `{room_name}-{event_type}-{unix_timestamp_millis}`

### Recovery Alerts

When a service recovers, an info-level alert is sent with `related_alert_id`:

```json
{
  "alert_id": "pharaohs-mqtt_disconnected-1705329300000",
  "room_name": "pharaohs",
  "event": "mqtt_disconnected",
  "timestamp": "2024-01-15T14:35:00Z",
  "severity": "info",
  "message": "MQTT connection restored",
  "details": {
    "recovered_at": "2024-01-15T14:35:00Z",
    "related_alert_id": "pharaohs-mqtt_disconnected-1705329022000"
  }
}
```

Use `related_alert_id` to correlate recovery alerts with the original alert.

### Webhook Integration Examples

#### Slack (via Incoming Webhook)

Set `SENTIENT_ALERT_WEBHOOK_URL` to your Slack webhook URL. You may need a proxy
to transform the payload to Slack's format:

```bash
SENTIENT_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/XXX
```

#### PagerDuty

Use PagerDuty's Events API v2 with a transformer:

```bash
SENTIENT_ALERT_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
```

#### Custom Webhook Receiver

Create a simple receiver that forwards to your alerting system:

```python
from flask import Flask, request
import json

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    alert = request.json
    print(f"[{alert['severity'].upper()}] {alert['room_name']}: {alert['event']}")
    print(f"  Message: {alert['message']}")
    print(f"  Details: {json.dumps(alert.get('details', {}))}")
    return 'OK', 200

if __name__ == '__main__':
    app.run(port=9000)
```

## Recommended Alert Thresholds

### Prometheus Alerting Rules

```yaml
groups:
  - name: sentient
    rules:
      # Room not active
      - alert: SentientRoomDown
        expr: sentient_rooms_active == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Sentient room {{ $labels.room }} is down"
          description: "Room has been inactive for more than 1 minute"

      # MQTT disconnected
      - alert: SentientMQTTDisconnected
        expr: sentient_mqtt_connected == 0
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "MQTT disconnected for room {{ $labels.room }}"

      # PostgreSQL disconnected
      - alert: SentientPostgresDisconnected
        expr: sentient_postgres_connected == 0
        for: 10s
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL disconnected for room {{ $labels.room }}"

      # No WebSocket clients (potential UI issue)
      - alert: SentientNoClients
        expr: sentient_ws_clients == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "No WebSocket clients for room {{ $labels.room }}"

      # High event rate (potential spam/loop)
      - alert: SentientHighEventRate
        expr: rate(sentient_events_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High event rate for room {{ $labels.room }}"
          description: "Event rate is {{ $value }} events/second"

      # Backup overdue
      - alert: SentientBackupOverdue
        expr: time() - sentient_backup_last_success_timestamp > 86400 * 2
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Backup overdue for room {{ $labels.room }}"
          description: "No successful backup in over 48 hours"
```

## Grafana Dashboard

### Example Queries

**Uptime by Room:**
```promql
sentient_uptime_seconds
```

**Event Rate:**
```promql
rate(sentient_events_total[5m])
```

**Connection Status:**
```promql
sentient_mqtt_connected + sentient_postgres_connected
```

**WebSocket Clients Over Time:**
```promql
sentient_ws_clients
```

### Dashboard JSON

A basic Grafana dashboard can be created with these panels:

1. **Stat Panel**: Room Status (sentient_rooms_active)
2. **Gauge Panel**: Uptime (sentient_uptime_seconds / 3600 for hours)
3. **Graph Panel**: Events Over Time (rate(sentient_events_total[5m]))
4. **Stat Panels**: MQTT/Postgres Status (sentient_mqtt_connected, sentient_postgres_connected)
5. **Graph Panel**: WebSocket Clients (sentient_ws_clients)

## Testing Observability

### Verify Metrics Endpoint

```bash
# Basic check
curl -s http://localhost:8080/metrics

# Check specific metric
curl -s http://localhost:8080/metrics | grep sentient_uptime

# Validate Prometheus format
curl -s http://localhost:8080/metrics | promtool check metrics
```

### Test Alert Webhook

```bash
# Start a simple webhook receiver
python3 -c "
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = self.rfile.read(length)
        print('Received alert:', json.dumps(json.loads(body), indent=2))
        self.send_response(200)
        self.end_headers()

HTTPServer(('', 9000), Handler).serve_forever()
" &

# Set webhook URL and restart room
export SENTIENT_ALERT_WEBHOOK_URL=http://localhost:9000/alert
```

### Simulate Disconnection

```bash
# Stop MQTT broker temporarily (will trigger alert after 30s)
docker exec sentient-pharaohs pkill mosquitto

# Wait and check for alert
sleep 35

# Restart broker (will trigger recovery alert)
docker exec sentient-pharaohs /usr/sbin/mosquitto -d -c /etc/mosquitto/mosquitto.conf
```

## Security Considerations

- The `/metrics` endpoint is unauthenticated (assumes LAN-only access)
- No secrets are exposed in metrics or alert payloads
- Alert webhook failures are logged but never block or crash the system
- Consider network policies to restrict `/metrics` access in production

---

## Operator Runbook

This section provides step-by-step guidance for responding to alerts.

### Alert: mqtt_disconnected

**Severity:** Warning

**Meaning:** The MQTT broker inside the room container has been unreachable for longer than the configured delay (default 30s). Device communication is impaired.

**Immediate Impact:**
- Physical devices cannot send inputs to the orchestrator
- Device commands from the orchestrator will not be delivered
- Game progression may stall if waiting for device inputs

**Diagnostic Steps:**

```bash
# 1. Check container health
curl http://<room-ip>:<port>/ready
# Look for: "mqtt":{"status":"not_ready"}

# 2. Check if mosquitto is running inside container
docker exec sentient-<room> ps aux | grep mosquitto

# 3. Check mosquitto logs
docker logs sentient-<room> 2>&1 | grep -i mosquitto | tail -20

# 4. Check if port 1883 is listening inside container
docker exec sentient-<room> netstat -tlnp | grep 1883
```

**Likely Causes:**
1. Mosquitto process crashed
2. Mosquitto configuration error
3. Resource exhaustion (memory/CPU)
4. s6-overlay supervisor issue

**Resolution Steps:**

```bash
# Option 1: Restart mosquitto service
docker exec sentient-<room> /usr/sbin/mosquitto -d -c /etc/mosquitto/mosquitto.conf

# Option 2: Restart the entire container
docker restart sentient-<room>

# Option 3: Full room restart via ops scripts
./ops/docker/stop-room.sh <room>
./ops/docker/start-room.sh <room> <api_port> <mqtt_port> <pg_port>
```

**Verification:**
```bash
# Confirm MQTT reconnected
curl -s http://<room-ip>:<port>/metrics | grep sentient_mqtt_connected
# Should show: sentient_mqtt_connected{...} 1

# Confirm ready status
curl http://<room-ip>:<port>/ready
# Should show: "mqtt":{"status":"ok"}
```

---

### Alert: postgres_unavailable

**Severity:** Critical

**Meaning:** The PostgreSQL database inside the room container is unreachable. Event persistence and state recovery are impaired.

**Immediate Impact:**
- Events are NOT being persisted to database
- State cannot be recovered after restart
- Historical event queries will fail
- The room can still operate (events buffered in memory) but data may be lost

**Diagnostic Steps:**

```bash
# 1. Check container health
curl http://<room-ip>:<port>/ready
# Look for: "postgres":{"status":"not_ready"} or {"status":"unavailable"}

# 2. Check if postgres is running
docker exec sentient-<room> ps aux | grep postgres

# 3. Check postgres logs
docker logs sentient-<room> 2>&1 | grep -iE "(postgres|FATAL|ERROR)" | tail -20

# 4. Test database connectivity
docker exec sentient-<room> pg_isready -U sentient

# 5. Check disk space (postgres may fail if disk full)
docker exec sentient-<room> df -h /data
```

**Likely Causes:**
1. PostgreSQL process crashed
2. Disk full (/data volume)
3. Database corruption
4. OOM killer terminated postgres
5. Configuration error

**Resolution Steps:**

```bash
# Option 1: Check and restart postgres
docker exec sentient-<room> pg_isready -U sentient
# If not ready, restart container

# Option 2: Restart container
docker restart sentient-<room>

# Option 3: Check disk space and clean up if needed
docker exec sentient-<room> du -sh /data/*
# If disk full, consider increasing volume size or cleaning old data

# Option 4: Full restart with volume inspection
docker stop sentient-<room>
docker run --rm -v sentient_<room>_data:/data alpine ls -la /data/db/
# Check for corruption indicators, then restart
./ops/docker/start-room.sh <room> <ports...>
```

**Verification:**
```bash
# Confirm postgres connected
curl -s http://<room-ip>:<port>/metrics | grep sentient_postgres_connected
# Should show: sentient_postgres_connected{...} 1

# Confirm database is queryable
docker exec sentient-<room> psql -U sentient -d sentient -c "SELECT COUNT(*) FROM events;"
```

**Data Recovery:**
If postgres corruption is suspected:
```bash
# 1. Stop container
docker stop sentient-<room>

# 2. Restore from backup
./ops/backup/restore-room.sh <room> /path/to/backup.tar.gz
```

---

### Alert De-duplication

The alerting system prevents spam:
- Only ONE alert is sent when a condition triggers
- Alert is NOT re-sent while the condition persists
- A recovery alert (severity: info) is sent when the condition clears

Example sequence:
1. MQTT disconnects at T+0
2. Alert fires at T+30s (after delay)
3. MQTT stays down for 5 minutes - no additional alerts
4. MQTT reconnects at T+5:30
5. Recovery alert fires immediately

---

### Testing Alerts

Use the provided test script to validate alerting:

```bash
./ops/observability/test-alerts.sh <room_name> [api_port]

# Example:
./ops/observability/test-alerts.sh pharaohs 8081
```

Or manually test with a webhook receiver:

```bash
# Terminal 1: Start webhook receiver
python3 << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers['Content-Length']))
        print(json.dumps(json.loads(body), indent=2))
        self.send_response(200)
        self.end_headers()

HTTPServer(('0.0.0.0', 9000), Handler).serve_forever()
EOF

# Terminal 2: Start room with webhook
docker run -d --name sentient-test \
    -e SENTIENT_ALERT_WEBHOOK_URL=http://host.docker.internal:9000/alert \
    -e SENTIENT_MQTT_ALERT_DELAY=10s \
    ...

# Terminal 3: Trigger alert
docker exec sentient-test mv /usr/sbin/mosquitto /usr/sbin/mosquitto.disabled
docker exec sentient-test pkill mosquitto
# Wait 15s, check Terminal 1 for alert
```

---

### Escalation Path

If alerts persist after following the runbook:

1. **Collect diagnostics:**
   ```bash
   docker logs sentient-<room> > room-logs.txt 2>&1
   docker inspect sentient-<room> > room-inspect.json
   curl -s http://<ip>:<port>/metrics > room-metrics.txt
   curl -s http://<ip>:<port>/events > room-events.json
   ```

2. **Check system resources:**
   ```bash
   docker stats sentient-<room> --no-stream
   df -h
   free -m
   ```

3. **Review recent changes:**
   - Configuration updates
   - Docker image updates
   - System updates

4. **Contact support** with collected diagnostics
