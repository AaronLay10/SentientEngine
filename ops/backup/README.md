# Sentient Engine Backup and Restore

This directory contains scripts for backing up and restoring Sentient Engine rooms.

## Overview

Each room in Sentient Engine runs as an isolated Docker container with:
- PostgreSQL database (event store)
- Room configuration files (scene graphs, device definitions)
- MQTT broker state

The backup scripts capture the database and configuration to enable disaster recovery.

## Quick Start

### Backup a Room

```bash
./backup-room.sh pharaohs /backups
```

This creates: `/backups/sentient-pharaohs-20240115-143022.tar.gz`

### Restore a Room

```bash
./restore-room.sh pharaohs /backups/sentient-pharaohs-20240115-143022.tar.gz
```

## backup-room.sh

Creates a timestamped backup archive containing:
- PostgreSQL database dump (custom format)
- Room configuration directory
- Manifest with metadata

### Usage

```bash
./backup-room.sh <room_name> <output_dir> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `room_name` | Name of the room (e.g., `pharaohs`, `clockwork`) |
| `output_dir` | Directory where the backup archive will be created |

### Options

| Option | Description |
|--------|-------------|
| `--allow-root` | Allow running as root (not recommended) |
| `-h, --help` | Show help message |

### Output

Creates an archive named: `sentient-<room_name>-YYYYMMDD-HHMMSS.tar.gz`

Archive structure:
```
sentient-pharaohs-20240115-143022/
├── manifest.json       # Backup metadata
├── config/            # Room configuration files
│   ├── room.yaml
│   ├── devices.yaml
│   └── scene-graph.json
└── db/
    └── database.dump   # PostgreSQL custom format dump
```

### Examples

```bash
# Basic backup
./backup-room.sh pharaohs /backups

# Backup to mounted network storage
./backup-room.sh clockwork /mnt/nfs/sentient-backups

# Running as root (not recommended)
sudo ./backup-room.sh pharaohs /backups --allow-root
```

## restore-room.sh

Restores a room from a backup archive. This is a **destructive operation** that will:
1. Stop the running container
2. Overwrite configuration files
3. Drop and recreate the database
4. Restart the room

### Usage

```bash
./restore-room.sh <room_name> <backup_archive> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `room_name` | Name of the room to restore |
| `backup_archive` | Path to the backup `.tar.gz` file |

### Options

| Option | Description |
|--------|-------------|
| `--allow-root` | Allow running as root |
| `--force` | Skip confirmation prompts |
| `--api-port PORT` | Override API port (default: from env or 8080) |
| `--mqtt-port PORT` | Override MQTT port (default: from env or 1883) |
| `--pg-port PORT` | Override PostgreSQL port (default: from env or 5432) |
| `-h, --help` | Show help message |

### Examples

```bash
# Interactive restore (with confirmation prompts)
./restore-room.sh pharaohs /backups/sentient-pharaohs-20240115-143022.tar.gz

# Non-interactive restore
./restore-room.sh pharaohs /backups/sentient-pharaohs-20240115-143022.tar.gz --force

# Restore with custom ports
./restore-room.sh pharaohs backup.tar.gz --api-port 8081 --mqtt-port 1884 --pg-port 5433
```

### Port Configuration

The restore script reads ports from `/etc/sentient/<room_name>.env` if it exists:
```bash
SENTIENT_API_PORT=8081
SENTIENT_MQTT_PORT=1884
SENTIENT_PG_PORT=5433
```

If no env file exists, defaults are used (8080, 1883, 5432).

## Safety Features

### Root Protection
Both scripts refuse to run as root by default. Use `--allow-root` to override.

### Confirmation Prompts
The restore script shows warnings and requires confirmation before destructive operations. Use `--force` to skip prompts in automated scenarios.

### Room Name Validation
The restore script warns if the backup's room name doesn't match the target room, allowing you to restore a backup to a different room if needed.

### Pre-Restore Backup
Before overwriting configuration, the restore script saves existing config to:
`rooms/<room_name>.pre-restore.<timestamp>/`

## Verification

After restore, verify the room is operational:

```bash
# Check health endpoint
curl http://127.0.0.1:8080/health

# Check ready endpoint (returns 200 when fully operational)
curl http://127.0.0.1:8080/ready

# Check container logs
docker logs sentient-pharaohs

# Query event count
docker exec sentient-pharaohs psql -U sentient -d sentient \
  -c "SELECT COUNT(*) FROM events;"
```

## Scheduling Backups

### Using systemd Timer (Recommended)

Create a timer unit for nightly backups:

**1. Create the service unit** (`/etc/systemd/system/sentient-backup@.service`):
```ini
[Unit]
Description=Backup Sentient room %i
After=sentient-room@%i.service

[Service]
Type=oneshot
User=techadmin
WorkingDirectory=/home/techadmin/sentient-engine
ExecStart=/home/techadmin/sentient-engine/ops/backup/backup-room.sh %i /backups/sentient
StandardOutput=journal
StandardError=journal
```

**2. Create the timer unit** (`/etc/systemd/system/sentient-backup@.timer`):
```ini
[Unit]
Description=Nightly backup for Sentient room %i

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

**3. Enable for a room**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sentient-backup@pharaohs.timer
```

**4. Check status**:
```bash
systemctl list-timers sentient-backup@*
journalctl -u sentient-backup@pharaohs.service
```

### Using Cron

Add to crontab (`crontab -e`):

```cron
# Backup pharaohs room at 2:00 AM daily
0 2 * * * /home/techadmin/sentient-engine/ops/backup/backup-room.sh pharaohs /backups/sentient >> /var/log/sentient-backup.log 2>&1

# Backup clockwork room at 2:30 AM daily
30 2 * * * /home/techadmin/sentient-engine/ops/backup/backup-room.sh clockwork /backups/sentient >> /var/log/sentient-backup.log 2>&1
```

## Retention Strategy

### Recommended Retention

| Period | Retention | Example |
|--------|-----------|---------|
| Daily | 7 days | Keep last 7 daily backups |
| Weekly | 4 weeks | Keep last 4 weekly backups (Sundays) |
| Monthly | 3 months | Keep last 3 monthly backups |

### Cleanup Script Example

Create `/home/techadmin/sentient-engine/ops/backup/cleanup-backups.sh`:

```bash
#!/bin/bash
BACKUP_DIR="${1:-/backups/sentient}"
DAYS_TO_KEEP="${2:-7}"

find "$BACKUP_DIR" -name "sentient-*.tar.gz" -mtime +$DAYS_TO_KEEP -delete
echo "Cleaned up backups older than $DAYS_TO_KEEP days"
```

Add to cron to run weekly:
```cron
0 3 * * 0 /home/techadmin/sentient-engine/ops/backup/cleanup-backups.sh /backups/sentient 7
```

### Storage Considerations

- **Local disk**: Fast, but vulnerable to same disk failure
- **Network storage (NFS/SMB)**: Protects against local disk failure
- **Cloud storage**: Upload after backup using `aws s3 cp`, `gsutil cp`, or similar

Example cloud upload in cron:
```cron
0 3 * * * aws s3 sync /backups/sentient s3://my-bucket/sentient-backups/ --exclude "*" --include "*.tar.gz"
```

## Offsite Backup Sync

The `sync-offsite.sh` script provides rsync-based synchronization of backup archives to offsite locations. This is optional but recommended for disaster recovery.

### sync-offsite.sh

Efficiently syncs backup archives to remote storage using rsync.

### Usage

```bash
./sync-offsite.sh <source_dir> <target> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `source_dir` | Local directory containing backup archives |
| `target` | Rsync target (local path, SSH, or rsync URL) |

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview what would be transferred |
| `--delete` | Remove files from target not in source |
| `--bwlimit=KBPS` | Limit bandwidth (KB/s) |
| `--ssh-key=PATH` | SSH private key for auth |
| `--ssh-port=PORT` | SSH port (default: 22) |
| `--include=PATTERN` | File pattern (default: `*.tar.gz`) |
| `--quiet` | Suppress progress output |

### Environment Variables

Configure defaults via environment variables:

```bash
export SENTIENT_OFFSITE_TARGET=user@backup-server:/backups/sentient
export SENTIENT_OFFSITE_SSH_KEY=/home/techadmin/.ssh/backup_key
export SENTIENT_OFFSITE_BWLIMIT=1000  # 1 MB/s
```

### Examples

```bash
# Sync to SSH remote
./sync-offsite.sh /backups/sentient user@backup-server:/backups/sentient

# Sync with bandwidth limit (500 KB/s)
./sync-offsite.sh /backups/sentient user@host:/backups --bwlimit=500

# Dry run to preview
./sync-offsite.sh /backups/sentient /mnt/nas/backups --dry-run

# Sync and remove old files from target
./sync-offsite.sh /backups/sentient rsync://server/backups --delete

# Use environment variable for target
export SENTIENT_OFFSITE_TARGET=user@backup:/backups
./sync-offsite.sh /backups/sentient
```

### Automated Offsite Sync

Add to cron after nightly backups:

```cron
# Sync to offsite after backup completes (3:00 AM)
0 3 * * * /home/techadmin/sentient-engine/ops/backup/sync-offsite.sh /backups/sentient user@offsite:/backups --quiet >> /var/log/sentient-offsite.log 2>&1
```

Or use a systemd timer:

**Service** (`/etc/systemd/system/sentient-offsite-sync.service`):
```ini
[Unit]
Description=Sync Sentient backups to offsite storage
After=sentient-backup@pharaohs.service

[Service]
Type=oneshot
User=techadmin
Environment=SENTIENT_OFFSITE_TARGET=user@backup:/backups/sentient
ExecStart=/home/techadmin/sentient-engine/ops/backup/sync-offsite.sh /backups/sentient
StandardOutput=journal
StandardError=journal
```

**Timer** (`/etc/systemd/system/sentient-offsite-sync.timer`):
```ini
[Unit]
Description=Daily offsite backup sync

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Offsite Target Examples

| Target Type | Example |
|-------------|---------|
| SSH | `user@host:/path/to/backups` |
| SSH with port | `user@host:/path` with `--ssh-port=2222` |
| Local/NFS mount | `/mnt/offsite-nas/backups` |
| Rsync daemon | `rsync://server/module` |

### Bandwidth Management

For WAN connections, limit bandwidth to avoid saturating the link:

```bash
# 1 MB/s limit
./sync-offsite.sh /backups/sentient user@host:/backups --bwlimit=1000

# 500 KB/s limit for slow connections
./sync-offsite.sh /backups/sentient user@host:/backups --bwlimit=500
```

## Troubleshooting

### Backup fails with "Container does not exist"

The room must have been started at least once to create the Docker volume:
```bash
./ops/docker/start-room.sh pharaohs 8080 1883 5432
```

### Backup fails with "pg_dump failed"

Check if PostgreSQL is running inside the container:
```bash
docker exec sentient-pharaohs pg_isready -U sentient
docker logs sentient-pharaohs 2>&1 | grep -i postgres
```

### Restore hangs waiting for PostgreSQL

The container may have failed to start. Check logs:
```bash
docker logs sentient-pharaohs
```

### Restore fails with port conflict

Another container or service is using the port. Either:
- Stop the conflicting service
- Use different ports: `--api-port 8081 --mqtt-port 1884 --pg-port 5433`

### Archive appears corrupted

Verify archive integrity:
```bash
tar -tzf backup.tar.gz > /dev/null && echo "OK" || echo "CORRUPTED"
```

Check SHA256 if you saved it during backup:
```bash
sha256sum backup.tar.gz
```

## Disaster Recovery Procedure

### Complete Room Recovery

1. **Assess the situation**: Identify what was lost (disk, corruption, config)

2. **Locate latest backup**:
   ```bash
   ls -lt /backups/sentient/sentient-pharaohs-*.tar.gz | head -5
   ```

3. **Stop any partially running containers**:
   ```bash
   docker stop sentient-pharaohs 2>/dev/null || true
   docker rm sentient-pharaohs 2>/dev/null || true
   ```

4. **Remove corrupted volume** (if needed):
   ```bash
   docker volume rm sentient_pharaohs_data 2>/dev/null || true
   ```

5. **Restore from backup**:
   ```bash
   ./restore-room.sh pharaohs /backups/sentient/sentient-pharaohs-20240115-143022.tar.gz
   ```

6. **Verify**:
   ```bash
   curl http://127.0.0.1:8080/ready
   ```

### Recovery to Different Host

1. Copy backup archive to new host
2. Clone the repository
3. Build the Docker image (if not using registry)
4. Run restore:
   ```bash
   ./restore-room.sh pharaohs backup.tar.gz --api-port 8080 --mqtt-port 1883 --pg-port 5432
   ```
