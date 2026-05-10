#!/bin/bash
set -euo pipefail

COMPONENTS="${1:?COMPONENTS not set}"
BACKUP_DIR="${2:?BACKUP_DIR not set}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL env var not set}"
UPLOAD_PATH="${UPLOAD_PATH:?UPLOAD_PATH env var not set}"
REPO_ROOT="${REPO_ROOT:?REPO_ROOT env var not set}"
REDIS_URL="${REDIS_URL:?REDIS_URL env var not set}"
RETENTION=7

TIMESTAMP="$(date +%Y%m%dT%H%M%S)"
ARCHIVE_NAME="ngtt-backup-${TIMESTAMP}.tar.gz"
WORK_DIR="$(mktemp -d)"

trap 'finish "failed"; rm -rf "$WORK_DIR"' ERR
trap 'log "Interrupted"; finish "failed"; rm -rf "$WORK_DIR"; exit 1' SIGTERM SIGINT

log() {
  local ts; ts="$(date '+%H:%M:%S')"
  local msg="$ts $*"
  redis-cli -u "$REDIS_URL" RPUSH backup:log "$msg" > /dev/null 2>&1 || true
  echo "$msg"
}

finish() {
  local final_status="$1"
  redis-cli -u "$REDIS_URL" SET backup:status "$final_status" EX 1800 > /dev/null 2>&1 || true
  redis-cli -u "$REDIS_URL" DEL backup:lock                          > /dev/null 2>&1 || true
}

# Parse which components to include
HAS_DB=false; HAS_UPLOADS=false; HAS_ENV=false
IFS=',' read -ra COMP_LIST <<< "$COMPONENTS"
for c in "${COMP_LIST[@]}"; do
  case "$c" in
    db)      HAS_DB=true ;;
    uploads) HAS_UPLOADS=true ;;
    env)     HAS_ENV=true ;;
  esac
done

log "=== NGTT Backup: $ARCHIVE_NAME ==="
log "Components: $COMPONENTS"

mkdir -p "$BACKUP_DIR"

# Disk space check — refuse if less than 1.5× estimated need
AVAIL_KB=$(df -k "$BACKUP_DIR" | awk 'NR==2 {print $4}')
NEEDED_KB=0
if $HAS_DB;      then NEEDED_KB=$((NEEDED_KB + 204800)); fi   # 200 MB estimate
if $HAS_UPLOADS; then
  UPLOADS_KB=$(du -sk "$UPLOAD_PATH" 2>/dev/null | awk '{print $1}' || echo 0)
  NEEDED_KB=$((NEEDED_KB + UPLOADS_KB))
fi
NEEDED_KB=$((NEEDED_KB * 3 / 2))
if [ "$AVAIL_KB" -lt "$NEEDED_KB" ]; then
  log "ERROR: Insufficient disk space (available: ${AVAIL_KB}K, estimated needed: ${NEEDED_KB}K)"
  finish "failed"
  exit 1
fi

# Database backup
if $HAS_DB; then
  log "Dumping database..."
  DB_USER="$(echo "$DATABASE_URL" | sed -E 's#mysql://([^:]+):.*#\1#')"
  DB_PASS="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^:]+:([^@]+)@.*#\1#')"
  DB_HOST="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^@]+@([^:/]+).*#\1#')"
  DB_PORT="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^@]+@[^:]+:([0-9]+)/.*#\1#')"
  DB_NAME="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^/]+/([^?]+).*#\1#')"
  # MYSQL_PWD avoids the password appearing in the process list
  MYSQL_PWD="$DB_PASS" mysqldump \
    --single-transaction --quick --routines --triggers \
    -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" \
    | gzip > "$WORK_DIR/db.sql.gz"
  log "  done ($(du -sh "$WORK_DIR/db.sql.gz" | cut -f1))"
fi

# Uploads backup
if $HAS_UPLOADS; then
  log "Archiving uploads..."
  tar -C "$(dirname "$UPLOAD_PATH")" -cf "$WORK_DIR/uploads.tar" "$(basename "$UPLOAD_PATH")"
  log "  done ($(du -sh "$WORK_DIR/uploads.tar" | cut -f1))"
fi

# .env backup
if $HAS_ENV; then
  log "Copying .env files..."
  mkdir -p "$WORK_DIR/env"
  [ -f "$REPO_ROOT/backend/.env"        ] && cp "$REPO_ROOT/backend/.env"        "$WORK_DIR/env/backend.env"
  [ -f "$REPO_ROOT/frontend/.env.local" ] && cp "$REPO_ROOT/frontend/.env.local" "$WORK_DIR/env/frontend.env.local"
  log "  done"
fi

# Write manifest
printf '{"version":"1","created_at":"%s","components":"%s","ngtt_origin":"RazgrizMY"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMPONENTS" \
  > "$WORK_DIR/manifest.json"

log "Building archive..."
tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$WORK_DIR" .
chmod 600 "$BACKUP_DIR/$ARCHIVE_NAME"
rm -rf "$WORK_DIR"
log "  done ($(du -sh "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1))"

# Retention: delete oldest files beyond the limit
log "Applying retention (keep last $RETENTION)..."
ls -t "$BACKUP_DIR"/ngtt-backup-*.tar.gz 2>/dev/null \
  | tail -n +"$((RETENTION + 1))" \
  | xargs -r rm -f
log "  done"

log "=== Backup complete: $ARCHIVE_NAME ==="
finish "done"
