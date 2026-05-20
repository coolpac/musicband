#!/usr/bin/env bash
# Automated Postgres backup for the musicians stack.
# Intended to be run by cron on the target server.
#
# Usage:
#   ./scripts/backup-db.sh             # uses ./backups/ relative to repo
#   BACKUP_DIR=/path ./scripts/backup-db.sh
#   RETENTION_DAYS=30 ./scripts/backup-db.sh
#
# Env (optional):
#   BACKUP_DIR      directory for dumps (default: ./backups, relative to project root)
#   RETENTION_DAYS  delete dumps older than N days (default: 14)
#
# Behavior:
#   - pg_dump in postgres custom format (-F c) to BACKUP_DIR/db_<UTC timestamp>.pgc
#   - Rotates: anything older than RETENTION_DAYS is deleted
#   - Exits non-zero on failure so cron sends mail / monitoring alerts
#   - Skips silently if the postgres container is not running (avoids cron noise
#     during planned downtime; status logged either way)

set -euo pipefail

# Resolve project root from this script's location (works regardless of cwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

log() { printf '[backup-db %s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
err() { printf '[backup-db %s] ERROR: %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }

# Source .env to get POSTGRES_USER / POSTGRES_DB (passwords not needed —
# pg_dump runs inside the container via docker exec)
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    . "$PROJECT_ROOT/.env"
    set +a
fi

PG_USER="${POSTGRES_USER:-musicians}"
PG_DB="${POSTGRES_DB:-musicians_db}"
CONTAINER="${POSTGRES_CONTAINER:-musicians-db}"

# Check the container is running before we try to exec into it
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    log "container ${CONTAINER} is not running — skipping (no backup taken)"
    exit 0
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
DEST="$BACKUP_DIR/db_${STAMP}.pgc"

log "starting dump → $DEST"
if ! docker exec "$CONTAINER" pg_dump -U "$PG_USER" -F c -d "$PG_DB" > "$DEST"; then
    err "pg_dump failed"
    rm -f "$DEST"
    exit 1
fi

SIZE_BYTES="$(stat -c '%s' "$DEST" 2>/dev/null || stat -f '%z' "$DEST" 2>/dev/null || echo 0)"
if [ "$SIZE_BYTES" -lt 1024 ]; then
    err "dump suspiciously small ($SIZE_BYTES bytes) — keeping for inspection but exit code 1"
    exit 1
fi

log "dump ok: ${SIZE_BYTES} bytes"

# Rotate: delete .pgc files older than RETENTION_DAYS
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db_*.pgc' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
log "rotated: deleted $DELETED old dump(s) (>${RETENTION_DAYS} days)"

log "done"
