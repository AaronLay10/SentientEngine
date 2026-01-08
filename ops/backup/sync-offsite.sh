#!/bin/bash
#
# sync-offsite.sh - Sync Sentient backups to an offsite location
#
# Uses rsync to efficiently sync backup archives to a remote target.
# Supports SSH-based remote targets and local paths.
#
# Usage: sync-offsite.sh <source_dir> <target> [options]
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
log_step() { echo -e "${CYAN}[SYNC]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $(basename "$0") <source_dir> <target> [options]

Sync Sentient backup archives to an offsite location using rsync.

Arguments:
  source_dir    Local directory containing backup archives
  target        Rsync target - can be:
                  - Local path: /mnt/offsite-storage
                  - SSH target: user@host:/path/to/backups
                  - Rsync URL:  rsync://server/module

Options:
  --dry-run         Show what would be transferred (no actual sync)
  --delete          Delete files on target that don't exist in source
  --bwlimit=KBPS    Limit bandwidth (e.g., --bwlimit=1000 for 1MB/s)
  --ssh-key=PATH    SSH private key for authentication
  --ssh-port=PORT   SSH port (default: 22)
  --include=PATTERN Include only files matching pattern (default: *.tar.gz)
  --exclude=PATTERN Exclude files matching pattern
  --quiet           Suppress progress output
  -h, --help        Show this help message

Environment Variables:
  SENTIENT_OFFSITE_TARGET   Default target if not specified
  SENTIENT_OFFSITE_SSH_KEY  Default SSH key path
  SENTIENT_OFFSITE_BWLIMIT  Default bandwidth limit

Examples:
  # Sync to SSH remote
  $(basename "$0") /backups/sentient user@backup-server:/backups/sentient

  # Sync with bandwidth limit (500 KB/s)
  $(basename "$0") /backups/sentient user@host:/backups --bwlimit=500

  # Dry run to see what would be synced
  $(basename "$0") /backups/sentient /mnt/nas/backups --dry-run

  # Sync and delete old files from target
  $(basename "$0") /backups/sentient rsync://server/backups --delete

  # Use environment variables
  export SENTIENT_OFFSITE_TARGET=user@backup:/backups
  $(basename "$0") /backups/sentient
EOF
}

# Defaults
DRY_RUN=false
DELETE_EXTRA=false
BWLIMIT=""
SSH_KEY=""
SSH_PORT="22"
INCLUDE_PATTERN="*.tar.gz"
EXCLUDE_PATTERN=""
QUIET=false
POSITIONAL_ARGS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --delete)
            DELETE_EXTRA=true
            shift
            ;;
        --bwlimit=*)
            BWLIMIT="${1#*=}"
            shift
            ;;
        --ssh-key=*)
            SSH_KEY="${1#*=}"
            shift
            ;;
        --ssh-port=*)
            SSH_PORT="${1#*=}"
            shift
            ;;
        --include=*)
            INCLUDE_PATTERN="${1#*=}"
            shift
            ;;
        --exclude=*)
            EXCLUDE_PATTERN="${1#*=}"
            shift
            ;;
        --quiet)
            QUIET=true
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

# Apply environment variable defaults
BWLIMIT="${BWLIMIT:-${SENTIENT_OFFSITE_BWLIMIT:-}}"
SSH_KEY="${SSH_KEY:-${SENTIENT_OFFSITE_SSH_KEY:-}}"

# Validate arguments
if [[ $# -lt 1 ]]; then
    log_error "Missing source directory"
    usage
    exit 1
fi

SOURCE_DIR="$1"

# Use positional arg or environment variable for target
if [[ $# -ge 2 ]]; then
    TARGET="$2"
elif [[ -n "${SENTIENT_OFFSITE_TARGET:-}" ]]; then
    TARGET="$SENTIENT_OFFSITE_TARGET"
else
    log_error "Missing target - specify as argument or set SENTIENT_OFFSITE_TARGET"
    usage
    exit 1
fi

# Validate source directory
if [[ ! -d "$SOURCE_DIR" ]]; then
    log_error "Source directory does not exist: $SOURCE_DIR"
    exit 1
fi

# Check rsync is available
if ! command -v rsync &> /dev/null; then
    log_error "rsync is required but not installed"
    exit 1
fi

# Build rsync command
RSYNC_OPTS=(-av --progress)

# Add include/exclude patterns
RSYNC_OPTS+=(--include="$INCLUDE_PATTERN")
if [[ -n "$EXCLUDE_PATTERN" ]]; then
    RSYNC_OPTS+=(--exclude="$EXCLUDE_PATTERN")
fi
RSYNC_OPTS+=(--exclude="*")  # Exclude everything not explicitly included

# Optional flags
if [[ "$DRY_RUN" == "true" ]]; then
    RSYNC_OPTS+=(--dry-run)
fi

if [[ "$DELETE_EXTRA" == "true" ]]; then
    RSYNC_OPTS+=(--delete)
fi

if [[ -n "$BWLIMIT" ]]; then
    RSYNC_OPTS+=(--bwlimit="$BWLIMIT")
fi

if [[ "$QUIET" == "true" ]]; then
    RSYNC_OPTS=(--archive --quiet)
fi

# SSH options for remote targets
if [[ "$TARGET" == *@* ]] || [[ "$TARGET" == *:* ]]; then
    SSH_OPTS="-p $SSH_PORT"
    if [[ -n "$SSH_KEY" ]]; then
        if [[ ! -f "$SSH_KEY" ]]; then
            log_error "SSH key not found: $SSH_KEY"
            exit 1
        fi
        SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
    fi
    RSYNC_OPTS+=(-e "ssh $SSH_OPTS")
fi

# Ensure source path ends with /
SOURCE_DIR="${SOURCE_DIR%/}/"

log_step "=== Sentient Offsite Backup Sync ==="
log_info "Source: $SOURCE_DIR"
log_info "Target: $TARGET"
log_info "Pattern: $INCLUDE_PATTERN"
[[ "$DRY_RUN" == "true" ]] && log_warn "DRY RUN - no files will be transferred"
[[ "$DELETE_EXTRA" == "true" ]] && log_warn "DELETE enabled - files not in source will be removed from target"
[[ -n "$BWLIMIT" ]] && log_info "Bandwidth limit: ${BWLIMIT} KB/s"
echo ""

# Count files to sync
FILE_COUNT=$(find "$SOURCE_DIR" -name "$INCLUDE_PATTERN" -type f 2>/dev/null | wc -l)
if [[ "$FILE_COUNT" -eq 0 ]]; then
    log_warn "No files matching '$INCLUDE_PATTERN' found in $SOURCE_DIR"
    exit 0
fi

log_info "Found $FILE_COUNT backup archive(s) to sync"
echo ""

# Run rsync
log_step "Starting rsync..."
SYNC_START=$(date +%s)

if rsync "${RSYNC_OPTS[@]}" "$SOURCE_DIR" "$TARGET"; then
    SYNC_END=$(date +%s)
    SYNC_DURATION=$((SYNC_END - SYNC_START))

    echo ""
    log_info "Sync completed successfully"
    log_info "Duration: ${SYNC_DURATION}s"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "This was a dry run - no files were actually transferred"
    fi
else
    log_error "Rsync failed with exit code $?"
    exit 1
fi

echo ""
log_step "=== Sync Summary ==="
echo "Source:   $SOURCE_DIR"
echo "Target:   $TARGET"
echo "Files:    $FILE_COUNT archive(s)"
echo "Duration: ${SYNC_DURATION}s"
[[ "$DRY_RUN" == "true" ]] && echo "Mode:     DRY RUN"
echo ""
