#!/bin/bash
#
# restore-room.sh - Restore a Sentient Engine room from backup
#
# Restores:
#   - Room configuration files
#   - PostgreSQL database (drop + recreate)
#
# Usage: restore-room.sh <room_name> <backup_archive>
#

set -euo pipefail

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_OPS_DIR="${REPO_ROOT}/ops/docker"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

usage() {
    cat <<EOF
Usage: $(basename "$0") <room_name> <backup_archive> [options]

Restore a Sentient Engine room from a backup archive.

Arguments:
  room_name       Name of the room to restore (e.g., pharaohs, clockwork)
  backup_archive  Path to the backup archive (.tar.gz)

Options:
  --allow-root         Allow running as root (not recommended)
  --force              Skip confirmation prompts
  --api-port PORT      API port for starting the room (default: from env or 8080)
  --mqtt-port PORT     MQTT port for starting the room (default: from env or 1883)
  --pg-port PORT       PostgreSQL port for starting the room (default: from env or 5432)
  -h, --help           Show this help message

Example:
  $(basename "$0") pharaohs /backups/sentient-pharaohs-20240115-143022.tar.gz
  $(basename "$0") clockwork backup.tar.gz --force
EOF
}

# Parse arguments
ALLOW_ROOT=false
FORCE=false
API_PORT=""
MQTT_PORT=""
PG_PORT=""
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --allow-root)
            ALLOW_ROOT=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --api-port)
            API_PORT="$2"
            shift 2
            ;;
        --mqtt-port)
            MQTT_PORT="$2"
            shift 2
            ;;
        --pg-port)
            PG_PORT="$2"
            shift 2
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
BACKUP_ARCHIVE="$2"

# Safety check: refuse to run as root unless explicitly allowed
if [[ "$(id -u)" -eq 0 ]] && [[ "$ALLOW_ROOT" != "true" ]]; then
    log_error "Refusing to run as root. Use --allow-root to override."
    exit 1
fi

# Validate room name
if [[ ! "$ROOM_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "Invalid room name: $ROOM_NAME (must be alphanumeric with hyphens/underscores)"
    exit 1
fi

# Validate backup archive exists
if [[ ! -f "$BACKUP_ARCHIVE" ]]; then
    log_error "Backup archive does not exist: $BACKUP_ARCHIVE"
    exit 1
fi

# Configuration
CONTAINER_NAME="sentient-${ROOM_NAME}"
ROOM_CONFIG_DIR="${REPO_ROOT}/rooms/${ROOM_NAME}"
WORK_DIR=$(mktemp -d)

# Try to load ports from systemd env file
ENV_FILE="/etc/sentient/${ROOM_NAME}.env"
if [[ -f "$ENV_FILE" ]]; then
    log_info "Loading configuration from $ENV_FILE"
    # shellcheck source=/dev/null
    source "$ENV_FILE" 2>/dev/null || true
    API_PORT="${API_PORT:-${SENTIENT_API_PORT:-8080}}"
    MQTT_PORT="${MQTT_PORT:-${SENTIENT_MQTT_PORT:-1883}}"
    PG_PORT="${PG_PORT:-${SENTIENT_PG_PORT:-5432}}"
else
    API_PORT="${API_PORT:-8080}"
    MQTT_PORT="${MQTT_PORT:-1883}"
    PG_PORT="${PG_PORT:-5432}"
fi

# Cleanup on exit
cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

log_info "Starting restore of room: ${ROOM_NAME}"
log_info "Backup archive: ${BACKUP_ARCHIVE}"

# Validate archive integrity
log_step "Validating archive integrity..."
if ! tar -tzf "$BACKUP_ARCHIVE" > /dev/null 2>&1; then
    log_error "Archive is corrupted or not a valid tar.gz file"
    exit 1
fi
log_info "Archive integrity verified"

# Extract archive
log_step "Extracting backup archive..."
tar -xzf "$BACKUP_ARCHIVE" -C "$WORK_DIR"

# Find the backup directory (should be sentient-<room>-<timestamp>)
BACKUP_DIR=$(find "$WORK_DIR" -maxdepth 1 -type d -name "sentient-*" | head -1)
if [[ -z "$BACKUP_DIR" ]]; then
    log_error "Invalid backup archive structure - no sentient-* directory found"
    exit 1
fi
log_info "Extracted to: ${BACKUP_DIR}"

# Validate manifest exists
if [[ ! -f "${BACKUP_DIR}/manifest.json" ]]; then
    log_error "Invalid backup: manifest.json not found"
    exit 1
fi

# Read manifest
BACKUP_ROOM_NAME=$(grep -o '"room_name"[[:space:]]*:[[:space:]]*"[^"]*"' "${BACKUP_DIR}/manifest.json" | cut -d'"' -f4)
BACKUP_TIMESTAMP=$(grep -o '"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"' "${BACKUP_DIR}/manifest.json" | cut -d'"' -f4)
BACKUP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "${BACKUP_DIR}/manifest.json" | cut -d'"' -f4)

log_info "Backup metadata:"
echo "  Room:      ${BACKUP_ROOM_NAME}"
echo "  Timestamp: ${BACKUP_TIMESTAMP}"
echo "  Version:   ${BACKUP_VERSION}"

# Warn if room names don't match
if [[ "$BACKUP_ROOM_NAME" != "$ROOM_NAME" ]]; then
    log_warn "Room name mismatch!"
    log_warn "  Archive room: ${BACKUP_ROOM_NAME}"
    log_warn "  Target room:  ${ROOM_NAME}"
    if [[ "$FORCE" != "true" ]]; then
        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi
fi

# Check for database backup
HAS_DATABASE_BACKUP=false
if [[ -f "${BACKUP_DIR}/db/database.dump" ]] || [[ -f "${BACKUP_DIR}/db/database.sql" ]]; then
    HAS_DATABASE_BACKUP=true
fi

# Confirmation prompt
if [[ "$FORCE" != "true" ]]; then
    echo ""
    echo -e "${YELLOW}=== WARNING: DESTRUCTIVE OPERATION ===${NC}"
    echo "This will:"
    echo "  1. Stop the room container (if running)"
    echo "  2. Overwrite configuration in: ${ROOM_CONFIG_DIR}"
    if [[ "$HAS_DATABASE_BACKUP" == "true" ]]; then
        echo "  3. Drop and recreate the PostgreSQL database"
    fi
    echo "  4. Restart the room container"
    echo ""
    read -p "Proceed with restore? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
fi

# Step 1: Stop container if running
log_step "Stopping room container..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if [[ -x "${DOCKER_OPS_DIR}/stop-room.sh" ]]; then
        "${DOCKER_OPS_DIR}/stop-room.sh" "$ROOM_NAME"
    else
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi
    log_info "Container stopped"
else
    log_info "Container was not running"
fi

# Step 2: Restore configuration files
log_step "Restoring configuration files..."
if [[ -d "${BACKUP_DIR}/config" ]]; then
    # Create config directory if it doesn't exist
    mkdir -p "$ROOM_CONFIG_DIR"

    # Backup existing config (just in case)
    if [[ -d "$ROOM_CONFIG_DIR" ]] && [[ "$(ls -A "$ROOM_CONFIG_DIR" 2>/dev/null)" ]]; then
        EXISTING_BACKUP="${ROOM_CONFIG_DIR}.pre-restore.$(date +%Y%m%d-%H%M%S)"
        log_info "Backing up existing config to: ${EXISTING_BACKUP}"
        cp -r "$ROOM_CONFIG_DIR" "$EXISTING_BACKUP"
    fi

    # Restore config
    rm -rf "${ROOM_CONFIG_DIR:?}/"*
    cp -r "${BACKUP_DIR}/config/." "$ROOM_CONFIG_DIR/"
    log_info "Configuration restored to: ${ROOM_CONFIG_DIR}"
else
    log_warn "No configuration found in backup"
fi

# Step 3: Start container (needed for database restore)
log_step "Starting room container..."
if [[ -x "${DOCKER_OPS_DIR}/start-room.sh" ]]; then
    "${DOCKER_OPS_DIR}/start-room.sh" "$ROOM_NAME" "$API_PORT" "$MQTT_PORT" "$PG_PORT"
else
    log_error "start-room.sh not found at ${DOCKER_OPS_DIR}/start-room.sh"
    exit 1
fi

# Wait for container to be ready
log_info "Waiting for container to start..."
sleep 3

# Wait for PostgreSQL to be ready
log_step "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! docker exec "$CONTAINER_NAME" pg_isready -U sentient -q 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        log_error "PostgreSQL failed to start after ${MAX_RETRIES} attempts"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
log_info "PostgreSQL is ready"

# Step 4: Restore database
if [[ "$HAS_DATABASE_BACKUP" == "true" ]]; then
    log_step "Restoring database..."

    # Determine backup format
    if [[ -f "${BACKUP_DIR}/db/database.dump" ]]; then
        # Custom format backup - use pg_restore
        log_info "Using pg_restore for custom format backup"

        # Copy dump into container
        docker cp "${BACKUP_DIR}/db/database.dump" "${CONTAINER_NAME}:/tmp/database.dump"

        # Terminate existing connections and drop/recreate database
        log_info "Terminating existing database connections..."
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c \
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sentient' AND pid <> pg_backend_pid();" 2>/dev/null || true
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c "DROP DATABASE IF EXISTS sentient;" 2>/dev/null || true
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c "CREATE DATABASE sentient OWNER sentient;"

        # Restore from dump
        if docker exec "$CONTAINER_NAME" pg_restore -U sentient -d sentient /tmp/database.dump 2>/dev/null; then
            log_info "Database restored successfully"
        else
            # pg_restore may return non-zero for warnings, check if data exists
            if docker exec "$CONTAINER_NAME" psql -U sentient -d sentient -c "SELECT COUNT(*) FROM events;" >/dev/null 2>&1; then
                log_info "Database restored with warnings"
            else
                log_warn "Database restore completed but may have issues"
            fi
        fi

        # Clean up
        docker exec "$CONTAINER_NAME" rm -f /tmp/database.dump

    elif [[ -f "${BACKUP_DIR}/db/database.sql" ]]; then
        # Plain SQL backup
        log_info "Using psql for SQL format backup"

        # Copy SQL file into container
        docker cp "${BACKUP_DIR}/db/database.sql" "${CONTAINER_NAME}:/tmp/database.sql"

        # Terminate existing connections and drop/recreate database
        log_info "Terminating existing database connections..."
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c \
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sentient' AND pid <> pg_backend_pid();" 2>/dev/null || true
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c "DROP DATABASE IF EXISTS sentient;" 2>/dev/null || true
        docker exec "$CONTAINER_NAME" psql -U sentient -d postgres -c "CREATE DATABASE sentient OWNER sentient;"

        # Restore from SQL
        docker exec "$CONTAINER_NAME" psql -U sentient -d sentient -f /tmp/database.sql
        log_info "Database restored successfully"

        # Clean up
        docker exec "$CONTAINER_NAME" rm -f /tmp/database.sql
    fi
else
    log_warn "No database backup found - skipping database restore"
    log_warn "Room will start with empty database"
fi

# Step 5: Restart container to apply restored state
log_step "Restarting room to apply restored state..."
docker restart "$CONTAINER_NAME"
sleep 3

# Wait for PostgreSQL again after restart
log_info "Waiting for services to be ready..."
RETRY_COUNT=0
while ! docker exec "$CONTAINER_NAME" pg_isready -U sentient -q 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        log_error "PostgreSQL failed to start after restart"
        exit 1
    fi
    sleep 1
done

# Step 6: Verify restore
log_step "Verifying restore..."

# Check /ready endpoint
MAX_RETRIES=30
RETRY_COUNT=0
READY_URL="http://127.0.0.1:${API_PORT}/ready"

while true; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$READY_URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        log_info "/ready endpoint returned 200 OK"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        log_warn "Room did not become ready after ${MAX_RETRIES} attempts"
        log_warn "HTTP status: ${HTTP_CODE}"
        log_warn "You may need to check logs: docker logs ${CONTAINER_NAME}"
        break
    fi
    sleep 1
done

# Summary
echo ""
echo -e "${GREEN}=== Restore Complete ===${NC}"
echo "Room:        ${ROOM_NAME}"
echo "Container:   ${CONTAINER_NAME}"
echo "API Port:    ${API_PORT}"
echo "MQTT Port:   ${MQTT_PORT}"
echo "PG Port:     ${PG_PORT}"
echo ""
echo "Verification commands:"
echo "  curl http://127.0.0.1:${API_PORT}/health"
echo "  curl http://127.0.0.1:${API_PORT}/ready"
echo "  docker logs ${CONTAINER_NAME}"
