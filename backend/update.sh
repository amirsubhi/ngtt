#!/bin/bash
set -euo pipefail

TARGET_TAG="${1:?TARGET_TAG not set}"
PREV_REF="${2:?PREV_REF not set}"
REPO_ROOT="${REPO_ROOT:?REPO_ROOT env var not set}"
REDIS_URL="${REDIS_URL:?REDIS_URL env var not set}"

BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
LOG_FILE="/tmp/ngtt-update-$(date +%s).log"

trap 'finish "failed"' ERR
trap 'log "Interrupted"; finish "failed"; exit 1' SIGTERM SIGINT

log() {
  local ts; ts="$(date '+%H:%M:%S')"
  local msg="$ts $*"
  redis-cli -u "$REDIS_URL" RPUSH update:log "$msg" > /dev/null 2>&1 || true
  echo "$msg" >> "$LOG_FILE"
}

finish() {
  local final_status="$1"
  redis-cli -u "$REDIS_URL" SET update:status "$final_status" EX 1800 > /dev/null 2>&1 || true
  redis-cli -u "$REDIS_URL" DEL update:lock                   > /dev/null 2>&1 || true
}

rollback() {
  log "ERROR: $1"
  log "Rolling back to $PREV_REF..."
  git -C "$REPO_ROOT" checkout "$PREV_REF" >> "$LOG_FILE" 2>&1 || true
  log "Rollback complete. Manual recovery may be required. See $LOG_FILE"
  finish "failed"
  exit 1
}

run_step() {
  local label="$1"; shift
  log "$label"
  if ! "$@" >> "$LOG_FILE" 2>&1; then
    rollback "step failed: $label"
  fi
  log "  done"
}

log "=== NGTT Update: $TARGET_TAG ==="
log "Previous ref: $PREV_REF"
log "Full log: $LOG_FILE"

run_step "Fetching tags..."          git -C "$REPO_ROOT" fetch --tags

# --- Pre-update auto-backup (db + env, inline, no extra lock) ---
AUTO_BACKUP_DIR="$REPO_ROOT/../backups"
AUTO_BACKUP_FILE="$AUTO_BACKUP_DIR/ngtt-backup-$(date +%Y%m%dT%H%M%S).tar.gz"
AUTO_WORK_DIR="$(mktemp -d)"

log "=== Pre-update backup (db + env) ==="
mkdir -p "$AUTO_BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ] && command -v mysqldump > /dev/null 2>&1; then
  DB_USER="$(echo "$DATABASE_URL" | sed -E 's#mysql://([^:]+):.*#\1#')"
  DB_PASS="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^:]+:([^@]+)@.*#\1#')"
  DB_HOST="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^@]+@([^:/]+).*#\1#')"
  DB_PORT="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^@]+@[^:]+:([0-9]+)/.*#\1#')"
  DB_NAME="$(echo "$DATABASE_URL" | sed -E 's#mysql://[^/]+/([^?]+).*#\1#')"
  MYSQL_PWD="$DB_PASS" mysqldump \
    --single-transaction --quick \
    -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" \
    | gzip > "$AUTO_WORK_DIR/db.sql.gz" 2>>"$LOG_FILE"
  log "  db done ($(du -sh "$AUTO_WORK_DIR/db.sql.gz" | cut -f1))"
else
  log "  mysqldump not available — skipping db backup"
fi

mkdir -p "$AUTO_WORK_DIR/env"
[ -f "$REPO_ROOT/backend/.env"        ] && cp "$REPO_ROOT/backend/.env"        "$AUTO_WORK_DIR/env/backend.env"
[ -f "$REPO_ROOT/frontend/.env.local" ] && cp "$REPO_ROOT/frontend/.env.local" "$AUTO_WORK_DIR/env/frontend.env.local"

printf '{"version":"1","created_at":"%s","components":"db,env","ngtt_origin":"RazgrizMY"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$AUTO_WORK_DIR/manifest.json"

tar -czf "$AUTO_BACKUP_FILE" -C "$AUTO_WORK_DIR" . 2>>"$LOG_FILE"
chmod 600 "$AUTO_BACKUP_FILE"
rm -rf "$AUTO_WORK_DIR"
log "Pre-update backup saved: $(basename "$AUTO_BACKUP_FILE")"
log "=== Pre-update backup done ==="
# --- End pre-update backup ---

run_step "Checking out $TARGET_TAG..." git -C "$REPO_ROOT" checkout "$TARGET_TAG"

# Watermark check — ensures this is NGTT code, not an impersonating repo
if ! grep -q "RazgrizMY" "$BACKEND_DIR/src/lib/errors.ts" 2>/dev/null; then
  rollback "Watermark missing in errors.ts — refusing to apply"
fi
log "Watermark verified OK"

run_step "npm ci (backend)..."       npm --prefix "$BACKEND_DIR"  ci
run_step "npm ci (frontend)..."      npm --prefix "$FRONTEND_DIR" ci
run_step "Build backend..."          npm --prefix "$BACKEND_DIR"  run build
run_step "Build frontend..."         npm --prefix "$FRONTEND_DIR" run build
run_step "Run migrations..."         npm --prefix "$BACKEND_DIR"  run migrate
run_step "pm2 reload all..."         pm2 reload all

log "=== Update to $TARGET_TAG complete! ==="
finish "done"
