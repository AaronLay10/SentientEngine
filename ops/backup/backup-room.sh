#!/bin/bash
#
# backup-room.sh - Backup a Sentient Engine room
#
# Creates a timestamped archive containing:
#   - PostgreSQL database dump
#   - Room configuration files
#   - Manifest with metadata
#
# Usage: backup-room.sh <room_name> <output_dir>
#

set -euo pipefail

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

usage() {
    cat <<EOF
Usage: $(basename "$0") <room_name> <output_dir>

Backup a Sentient Engine room to a timestamped archive.

Arguments:
  room_name    Name of the room to back up (e.g., pharaohs, clockwork)
  output_dir   Directory where the backup archive will be created

Options:
  --allow-root    Allow running as root (not recommended)
  -h, --help      Show this help message

Output:
  Creates: sentient-<room_name>-YYYYMMDD-HHMMSS.tar.gz

Example:
  $(basename "$0") pharaohs /backups
  $(basename "$0") clockwork /mnt/backup-storage
EOF
}

# Parse arguments
ALLOW_ROOT=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --allow-root)
            ALLOW_ROOT=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

set -- "${POSITIONAL_ARGS[@]}"

# Validate arguments
if [[ $# -ne 2 ]]; then
    log_error "Missing required arguments"
    usage
    exit 1
fi

ROOM_NAME="$1"
OUTPUT_DIR="$2"

# Safety check: refuse to run as root unless explicitly allowed
if [[ "$(id -u)" -eq 0 ]] && [[ "$ALLOW_ROOT" != "true" ]]; then
    log_error "Refusing to run as root. Use --allow-root to override."
    exit 1
fi

# Validate room name (alphanumeric and hyphens only)
if [[ ! "$ROOM_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "Invalid room name: $ROOM_NAME (must be alphanumeric with hyphens/underscores)"
    exit 1
fi

# Validate output directory exists and is writable
if [[ ! -d "$OUTPUT_DIR" ]]; then
    log_error "Output directory does not exist: $OUTPUT_DIR"
    exit 1
fi

if [[ ! -w "$OUTPUT_DIR" ]]; then
    log_error "Output directory is not writable: $OUTPUT_DIR"
    exit 1
fi

# Configuration
CONTAINER_NAME="sentient-${ROOM_NAME}"
ROOM_CONFIG_DIR="${REPO_ROOT}/rooms/${ROOM_NAME}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="sentient-${ROOM_NAME}-${TIMESTAMP}"
WORK_DIR=$(mktemp -d)

# Cleanup on exit
cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

log_info "Starting backup of room: ${ROOM_NAME}"
log_info "Output directory: ${OUTPUT_DIR}"

# Check if container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_warn "Container ${CONTAINER_NAME} exists but is not running"
        log_warn "Database backup will be skipped - only config files will be backed up"
        CONTAINER_RUNNING=false
    else
        log_error "Container ${CONTAINER_NAME} does not exist"
        log_error "Cannot back up a room that has never been started"
        exit 1
    fi
else
    CONTAINER_RUNNING=true
fi

# Check if room config directory exists
if [[ ! -d "$ROOM_CONFIG_DIR" ]]; then
    log_error "Room configuration directory does not exist: $ROOM_CONFIG_DIR"
    exit 1
fi

# Create backup directory structure
mkdir -p "${WORK_DIR}/${BACKUP_NAME}/config"
mkdir -p "${WORK_DIR}/${BACKUP_NAME}/db"

# Get version from room.yaml if it exists
VERSION="unknown"
if [[ -f "${ROOM_CONFIG_DIR}/room.yaml" ]]; then
    VERSION=$(grep -E '^revision:' "${ROOM_CONFIG_DIR}/room.yaml" | awk '{print $2}' || echo "unknown")
fi

# Get git commit
GIT_COMMIT="unknown"
if command -v git &> /dev/null && [[ -d "${REPO_ROOT}/.git" ]]; then
    GIT_COMMIT=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
fi

# Backup PostgreSQL database
if [[ "$CONTAINER_RUNNING" == "true" ]]; then
    log_info "Dumping PostgreSQL database..."

    # Use pg_dump inside the container
    if docker exec "$CONTAINER_NAME" pg_dump -U sentient -d sentient --format=custom \
        -f /tmp/db_backup.dump 2>/dev/null; then

        # Copy dump out of container
        docker cp "${CONTAINER_NAME}:/tmp/db_backup.dump" "${WORK_DIR}/${BACKUP_NAME}/db/database.dump"

        # Clean up inside container
        docker exec "$CONTAINER_NAME" rm -f /tmp/db_backup.dump

        log_info "Database dump completed"
    else
        log_warn "pg_dump failed - attempting plain SQL backup"
        if docker exec "$CONTAINER_NAME" pg_dump -U sentient -d sentient \
            > "${WORK_DIR}/${BACKUP_NAME}/db/database.sql" 2>/dev/null; then
            log_info "Plain SQL backup completed"
        else
            log_error "Database backup failed"
            exit 1
        fi
    fi
else
    log_warn "Skipping database backup - container not running"
    echo "NO_DATABASE_BACKUP" > "${WORK_DIR}/${BACKUP_NAME}/db/NO_DATABASE.txt"
fi

# Backup room configuration
log_info "Backing up room configuration..."
cp -r "${ROOM_CONFIG_DIR}/." "${WORK_DIR}/${BACKUP_NAME}/config/"
log_info "Configuration backup completed"

# Create manifest
log_info "Creating manifest..."
cat > "${WORK_DIR}/${BACKUP_NAME}/manifest.json" <<EOF
{
  "room_name": "${ROOM_NAME}",
  "version": "${VERSION}",
  "git_commit": "${GIT_COMMIT}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_type": "full",
  "container_running": ${CONTAINER_RUNNING},
  "contents": {
    "database": $(if [[ "$CONTAINER_RUNNING" == "true" ]]; then echo "true"; else echo "false"; fi),
    "config": true
  },
  "created_by": "backup-room.sh",
  "sentient_version": "v7"
}
EOF
log_info "Manifest created"

# Create archive
log_info "Creating archive..."
ARCHIVE_PATH="${OUTPUT_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "$ARCHIVE_PATH" -C "${WORK_DIR}" "${BACKUP_NAME}"
log_info "Archive created: ${ARCHIVE_PATH}"

# Calculate and display archive info
ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
ARCHIVE_CHECKSUM=$(sha256sum "$ARCHIVE_PATH" | cut -d' ' -f1)

log_info "Backup completed successfully"
echo ""
echo "=== Backup Summary ==="
echo "Room:      ${ROOM_NAME}"
echo "Archive:   ${ARCHIVE_PATH}"
echo "Size:      ${ARCHIVE_SIZE}"
echo "SHA256:    ${ARCHIVE_CHECKSUM}"
echo "Timestamp: ${TIMESTAMP}"
echo ""
echo "To verify: tar -tzf ${ARCHIVE_PATH}"
echo "To restore: $(dirname "$0")/restore-room.sh ${ROOM_NAME} ${ARCHIVE_PATH}"
