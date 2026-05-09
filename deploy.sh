#!/usr/bin/env bash
# Server-side deploy script — called by GitHub Actions via SSH.
# The deploy key in authorized_keys is pinned to this script only.
# Never run manually in production; use: pm2 reload all (for config changes only).
set -euo pipefail

APP=/var/www/ngtt
LOG=/var/log/ngtt/deploy.log

exec >> "$LOG" 2>&1
echo "=== Deploy started at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

cd "$APP"

# Pull latest code
git pull --ff-only origin main

# Backend — install (prod only), build, migrate
cd "$APP/backend"
npm ci --omit=dev
npm run build
npm run migrate

# Frontend — install (prod only), build
cd "$APP/frontend"
npm ci --omit=dev
npm run build

# Zero-downtime reload
cd "$APP"
pm2 reload ecosystem.config.js --update-env

echo "=== Deploy finished at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
