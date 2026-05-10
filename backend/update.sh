#!/bin/bash
set -euo pipefail

TARGET_TAG="${1:?TARGET_TAG not set}"
PREV_REF="${2:?PREV_REF not set}"
REPO_ROOT="${REPO_ROOT:?REPO_ROOT env var not set}"
REDIS_URL="${REDIS_URL:?REDIS_URL env var not set}"

BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
LOG_FILE="/tmp/ngtt-update-$(date +%s).log"

log() {
  local msg="$(date '+%H:%M:%S') $*"
  redis-cli -u "$REDIS_URL" RPUSH update:log "$msg" > /dev/null 2>&1 || true
  echo "$msg" >> "$LOG_FILE"
}

finish() {
  local final_status="$1"
  redis-cli -u "$REDIS_URL" SET update:status "$final_status" > /dev/null 2>&1 || true
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
