# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Primary Authority

**Read `docs/guide.md` in full before writing any code.** It is the master build prompt and overrides everything else. All 15 build batches must be completed in strict order — never skip or partially implement a batch.

---

## Project: NGTT — Next-Gen Torrent Tracker

Private BitTorrent tracker. One backend process, no microservices, no ORM, no Docker. Runs on a VM with Nginx + PM2.

**Monorepo layout:**
```
/backend   — Fastify API + BullMQ workers + cron jobs
/frontend  — Next.js 14 App Router
/shared    — TypeScript interfaces + constants
```

**Stack:** Node.js 20 LTS, Fastify, MySQL 8.0 (mysql2 — raw SQL only), Redis 7 (ioredis), Socket.io, BullMQ, Next.js 14, Tailwind CSS, shadcn/ui, next-intl, next-themes.

---

## Commands

```bash
# Backend
cd backend
npm install
npm run dev          # ts-node-dev or tsx watch
npm run build        # tsc
npm run lint         # eslint src/
npm run migrate      # apply pending SQL migrations (idempotent)
npm test             # vitest run
npm run test:watch   # vitest (interactive)
npm run test:coverage

# Frontend
cd frontend
npm install
npx shadcn@latest init   # shadcn is a CLI, not an npm package
npm run dev
npm run build
npm run lint

# Process manager (production)
pm2 start ecosystem.config.js
pm2 logs
pm2 reload all
```

Migrations are tracked via a `schema_migrations` table — `npm run migrate` is idempotent and safe to re-run. Never apply SQL files manually in production after the migration runner exists.

---

## Architecture: Request Flow

```
Nginx (reverse proxy + sticky sessions for WebSocket)
  ├── /api/*        → Fastify (PM2 cluster, port 4000)
  │     ├── middleware: authenticate (JWT HS256) → requireStaff → requireAdmin
  │     ├── middleware: @fastify/rate-limit (3 zones: general/auth/announce)
  │     ├── middleware: requireFeature (reads site_settings, 60s cache)
  │     └── /announce/:passkey → lean announce handler (Redis-first, never blocks)
  ├── /             → Next.js (port 3000)
  └── /uploads/*    → static files
```

**Socket.io** requires `@socket.io/redis-adapter` AND Nginx `ip_hash` (sticky sessions) when running PM2 cluster. Without both, `io.emit()` only reaches clients on the same worker.

---

## Backend Patterns

**Database (`/backend/src/lib/db.ts`)** — thin pool wrapper only:
```ts
query<T>(sql, params?)    → T[]
queryOne<T>(sql, params?) → T | null
execute(sql, params?)     → void
```
Always raw SQL. No ORM. Index every FK and every WHERE column.

**Error hierarchy (`/backend/src/lib/errors.ts`)** — throw anywhere, caught once in Fastify error handler:
`AppError` → `NotFoundError` (404) | `UnauthorizedError` (401) | `ForbiddenError` (403) | `ValidationError` (400)

**Queues** — exactly two BullMQ queues:
- `statsQueue` — announce stat writes (fired from announce handler, never awaited)
- `jobsQueue` — everything else: hnr-update, flux-earn, email, etc.

**Flux balance updates** — atomic SQL only, never read-then-write:
```sql
-- RIGHT: check + deduct in one statement
UPDATE users SET flux = flux - ? WHERE id = ? AND flux >= ?
-- then: if affectedRows === 0 → 402 Insufficient Flux

-- WRONG: TOCTOU race allows double-spend
SELECT flux FROM users WHERE id = ?  -- then check in app
UPDATE users SET flux = ? WHERE id = ?
```
Any multi-table operation (purchase + grant + log) must run in a DB transaction.

**Redis peer storage** — HSET per torrent, never one key per peer:
```ts
// RIGHT
redis.hset(`peers:${infoHash}`, peerId, JSON.stringify(data))
redis.expire(`peers:${infoHash}`, 2700)
redis.hdel(`peers:${infoHash}`, peerId)          // on stopped
redis.hgetall(`peers:${infoHash}`)               // to list

// WRONG — redis.keys() is O(N) and blocks Redis
redis.set(`peers:${infoHash}:${peerId}`, ...)
redis.keys(`peers:${infoHash}:*`)
```

---

## Frontend Patterns

All pages live under `/app/[locale]/` (next-intl locale segment). Themes are CSS custom properties on `[data-theme]` — seven themes defined in one file (`/styles/themes.css`): `void` (default), `pulse`, `cipher`, `nebula`, `ember`, `lumen`, `sand`. All i18n in six JSON files under `/messages/`: `en`, `zh-CN`, `es`, `pt-BR`, `ar` (RTL), `ms-MY`.

---

## Non-Obvious Constraints

| Rule | Why |
|------|-----|
| JWT uses **HS256** (shared secret) | Env vars are string secrets — RS256 requires PEM key pair |
| `torrents` table **cannot be partitioned** | It has a FULLTEXT index; MySQL 8 forbids FULLTEXT on partitioned tables |
| `bcrypt cost 12` — do not lower | Industry baseline as of 2026 (PHP 8.4 default); review ~2027 |
| `speakeasy` is abandoned (2018) | Use `otplib` + `qrcode` for TOTP 2FA |
| `bencode` npm package is stale (3 yr) | Use `bencodec` |
| `mediainfo-client` does not exist on npm | Use `mediainfo.js` (WebAssembly) |
| `parse-torrent` v11 may be ESM-only | Verify import works with your tsconfig before committing |
| `personal_freeleech.expires_at` needs an index | Expiry queries on this column run on every announce |
| `torrents.slug` and `forum_topics.slug` must be UNIQUE | Schema declares NOT NULL but omits UNIQUE — add it |
| `torrents.status` is an ENUM, not a boolean | `status ENUM('pending','approved','rejected','takedown','dmca_pending')` — never use `is_approved` |
| Account deletion anonymizes, not cascade-deletes | Forum posts/audit logs set `user_id=NULL`; torrents not auto-deleted |
| TMDB responses must be cached in Redis by `tmdb_id` | Avoid TMDB rate limits |
| Refresh token cookie: `SameSite=Strict; HttpOnly; Secure` | CSRF protection |
| CORS pinned to `FRONTEND_URL` env var | Never wildcard in production |
| `change-group` endpoint must guard against self-demotion | Admin cannot demote themselves |

Full errata with longer explanations in `docs/guide.md` → **ERRATA & CONSTRAINTS** section (E1–E13).

---

## Naming Conventions

- Currency: always `flux` / `FLX` — never "bon", "bonus", "points", "BON"
- Site name: always `NGTT`
- Files: one file, one purpose, under 200 lines (split if larger)
- Imports: explicit only — no barrel files (`index.ts` re-exports)

---

## Coding Rules (from Engineering Philosophy)

1. No class where a function works
2. No abstraction for single-use code
3. Early returns — no deep nesting
4. Named constants — no magic numbers
5. Zod on every request body, no exceptions
6. Never await slow work in the HTTP response path — queue it
7. Raw mysql2 queries only — no ORM
8. Comments explain WHY not WHAT
9. When in doubt — do less, do it well

---

## Behavioral Guidelines

**Think before coding.** State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If something is unclear, ask before implementing.

**Simplicity first.** Minimum code that solves the problem. If you write 200 lines and it could be 50, rewrite it. Ask: "Would a senior engineer say this is overcomplicated?"

**Surgical changes.** Touch only what the task requires. Match existing style. Don't refactor adjacent code that isn't broken. Remove imports/vars YOUR changes made unused — don't remove pre-existing dead code unless asked.

**Goal-driven execution.** For multi-step tasks, state a brief plan with verifiable checks before starting. Every changed line should trace directly to the user's request.
