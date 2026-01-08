# Sentient Engine systemd Integration

Manage Sentient room containers via systemd for automatic startup on boot.

## Prerequisites

1. Docker installed and running
2. User has access to Docker (`docker.service` enabled)
3. Room configuration exists in `rooms/<room_name>/`
4. For private GHCR images: `docker login ghcr.io` completed

## Installation

### 1. Install the systemd unit template

```bash
sudo cp /home/techadmin/sentient-engine/ops/systemd/sentient-room@.service \
        /etc/systemd/system/

sudo systemctl daemon-reload
```

### 2. Create environment directory

```bash
sudo mkdir -p /etc/sentient
sudo chmod 750 /etc/sentient
```

### 3. Create room environment file

For each room, create `/etc/sentient/<room_name>.env`:

```bash
sudo cp /home/techadmin/sentient-engine/ops/systemd/pharaohs.env.example \
        /etc/sentient/pharaohs.env

sudo chmod 640 /etc/sentient/pharaohs.env
sudo nano /etc/sentient/pharaohs.env
```

## Environment File Configuration

Each room requires an env file at `/etc/sentient/<room_name>.env`.

### Required Variables

```bash
# Docker image to use
SENTIENT_IMAGE=ghcr.io/your-org/sentient-room:v1.0.0

# Port configuration (must be unique per room)
SENTIENT_API_PORT=8080
SENTIENT_MQTT_PORT=1883
SENTIENT_PG_PORT=5432
```

### Optional: Authentication (using *_FILE pattern)

```bash
# Path to files containing credentials
SENTIENT_ADMIN_USER_FILE=/etc/sentient/secrets/admin_user
SENTIENT_ADMIN_PASS_FILE=/etc/sentient/secrets/admin_pass
SENTIENT_OPERATOR_USER_FILE=/etc/sentient/secrets/operator_user
SENTIENT_OPERATOR_PASS_FILE=/etc/sentient/secrets/operator_pass
```

### Optional: TLS Configuration

```bash
# Paths to TLS certificate and key
SENTIENT_TLS_CERT_FILE=/etc/sentient/certs/server.crt
SENTIENT_TLS_KEY_FILE=/etc/sentient/certs/server.key
```

When TLS is enabled, HTTPS is exposed on `API_PORT + 443` (e.g., 8080 + 443 = 8523).

## Managing Rooms

### Enable a room (auto-start on boot)

```bash
sudo systemctl enable sentient-room@pharaohs
```

### Start a room

```bash
sudo systemctl start sentient-room@pharaohs
```

### Stop a room

```bash
sudo systemctl stop sentient-room@pharaohs
```

### Check status

```bash
sudo systemctl status sentient-room@pharaohs
```

### View logs

```bash
sudo journalctl -u sentient-room@pharaohs -f
```

### Disable auto-start

```bash
sudo systemctl disable sentient-room@pharaohs
```

## Multi-Room Setup

Each room must use unique ports. Example configuration:

| Room | API Port | MQTT Port | PG Port |
|------|----------|-----------|---------|
| pharaohs | 8080 | 1883 | 5432 |
| pyramid | 8081 | 1884 | 5433 |
| sphinx | 8082 | 1885 | 5434 |

Create env files for each:
- `/etc/sentient/pharaohs.env`
- `/etc/sentient/pyramid.env`
- `/etc/sentient/sphinx.env`

Enable and start:

```bash
sudo systemctl enable --now sentient-room@pharaohs
sudo systemctl enable --now sentient-room@pyramid
sudo systemctl enable --now sentient-room@sphinx
```

## Updating Images

### 1. Pull the new image

```bash
docker pull ghcr.io/your-org/sentient-room:v1.1.0
```

### 2. Update the env file

```bash
sudo nano /etc/sentient/pharaohs.env
# Change: SENTIENT_IMAGE=ghcr.io/your-org/sentient-room:v1.1.0
```

### 3. Restart the room

```bash
sudo systemctl restart sentient-room@pharaohs
```

## Private GHCR Images

For private GitHub Container Registry images, authenticate Docker before starting services:

```bash
# Login to GHCR (run as root or the user running Docker)
echo $GITHUB_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

The systemd unit assumes authentication is already configured. Docker stores credentials in `~/.docker/config.json`.

For system-wide auth (recommended for systemd):

```bash
sudo mkdir -p /root/.docker
sudo docker login ghcr.io
```

## Verification

After setup and reboot:

```bash
# Check service status
sudo systemctl status sentient-room@pharaohs

# Verify container is running
docker ps | grep sentient-pharaohs

# Test API readiness
curl http://localhost:8080/ready
# Expected: HTTP 200
```

## Troubleshooting

### Service fails to start

```bash
# Check logs
sudo journalctl -u sentient-room@pharaohs -n 50

# Verify env file exists and is readable
sudo cat /etc/sentient/pharaohs.env

# Verify room config exists
ls -la /home/techadmin/sentient-engine/rooms/pharaohs/
```

### Docker pull fails

```bash
# Check Docker login status
docker pull ghcr.io/your-org/sentient-room:v1.0.0

# Re-authenticate if needed
sudo docker login ghcr.io
```

### Port conflicts

```bash
# Check what's using a port
sudo ss -tlnp | grep 8080

# Ensure unique ports per room in env files
```
