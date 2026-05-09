<div align="center">

<h1>⚡ NGTT</h1>
<p><strong>Next-Gen Torrent Tracker</strong></p>
<p><em>A private BitTorrent tracker built for quality, speed, and longevity.</em></p>

<br>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)

</div>

---

## Overview

NGTT sits in the space between classic XBTIT-style simplicity and the modern polish of today's best PHP trackers — without the baggage of either. One backend process. No ORM. No Docker. No microservices. Raw SQL on MySQL 8, a Redis-first announce handler that never blocks, real-time Socket.io shoutbox, and a polished Next.js 14 frontend that ships in six languages.

---

## Features

### Tracker Core
- **Announce & Scrape** — Redis-first peer storage (`HSET` per torrent), O(1) lookups, async stat writes via BullMQ — the response path never waits
- **Ratio Enforcement** — Upload/download tracking with per-group grace periods and download slot limits
- **Hit & Run System** — Seeding time tracking, automated warnings, escalating bans
- **RSS & Torznab Feeds** — Full compatibility with the *arr ecosystem

### Economy
- **Flux (FLX)** — Bonus currency earned through seeding time and quality uploads. Atomic SQL balance updates (no read-then-write races). Built-in store for spending.

### Community
- **Real-time Shoutbox** — Socket.io with Redis adapter; broadcasts correctly across all PM2 cluster workers
- **Forums** — Categories → Topics → Posts with rich text editing
- **Private Messages** — Threaded inbox with read receipts
- **News & Announcements** — Staff-authored, pinnable to the homepage

### Content
- **Torrent Upload** — Metadata auto-fetched from TMDB & MusicBrainz, cover art resized via `sharp`, tech specs via `mediainfo.js`
- **Subtitles** — Upload, sync, community voting, OpenSubtitles integration with user privacy respected
- **Requests** — Community request board with Flux bounty system

### Security & Auth
- **JWT** — HS256, 15-minute access tokens + 7-day refresh tokens with atomic rotation
- **Two-Factor Auth** — TOTP via `otplib` + printable backup codes; secret encrypted at rest (AES-256-GCM)
- **Captcha** — Cloudflare Turnstile + honeypot field on registration and login
- **Rate Limiting** — Three independent zones: general · auth · announce
- **IP Bans** — Permanent or time-limited, checked on every request

### Internationalisation

| Language | Code | RTL |
|---|---|---|
| English | `en` | — |
| Simplified Chinese | `zh-CN` | — |
| Spanish | `es` | — |
| Brazilian Portuguese | `pt-BR` | — |
| Arabic | `ar` | ✓ |
| Bahasa Malaysia | `ms-MY` | — |

### Theming

Seven CSS-variable themes, user-selectable without a page reload:

`void` · `pulse` · `cipher` · `nebula` · `ember` · `lumen` · `sand`

### Staff & Administration
- User groups with colour-coded badges and configurable permissions
- Warning system, ban management, full audit log
- Feature flags — enable or disable entire sections site-wide with no redeploy
- Automatic promotion rules (class upgrades based on ratio, upload, and age)

---

## Architecture

```
Nginx  (reverse proxy · SSL termination · ip_hash for Socket.io sticky sessions)
  ├── /              →  Next.js 14    (PM2 cluster · port 3000)
  ├── /api/*         →  Fastify       (PM2 cluster · port 4000)
  │     ├── authenticate (JWT)  →  requireStaff  →  requireAdmin
  │     ├── @fastify/rate-limit (3 zones)
  │     └── /announce/:passkey  ←  Redis-first · never blocks the response
  ├── /uploads/*     →  static files
  └── /ws            →  Socket.io     (Redis adapter bridges all workers)

BullMQ Workers  (PM2 fork · single instance)
  ├── statsQueue   —  announce stat writes
  └── jobsQueue    —  H&R updates · Flux rewards · email · promotions · pruning
```

**No ORM. No microservices. No Docker.** Every query is raw `mysql2`. Every FK and every `WHERE` column is indexed. Redis peer data lives in `HSET peers:{infoHash}` hashes — never per-peer keys with `KEYS` (which blocks Redis).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Backend framework | Fastify + TypeScript |
| Frontend framework | Next.js 14 App Router + TypeScript |
| UI library | Tailwind CSS + shadcn/ui |
| Database | MySQL 8.0 — raw `mysql2` (no ORM) |
| Cache & queue | Redis 7 + ioredis + BullMQ |
| Real-time | Socket.io + `@socket.io/redis-adapter` |
| Auth | JWT HS256 + bcrypt (cost factor 12) |
| 2FA | otplib + qrcode |
| Encryption | AES-256-GCM for stored secrets |
| i18n | next-intl (6 locales) |
| Theming | next-themes + CSS custom properties |
| Validation | Zod on every request body |
| Email | Nodemailer (SMTP) |
| Images | sharp (resize · WebP conversion) |
| Processes | PM2 cluster + Nginx |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS |
| MySQL | 8.0 |
| Redis | 7 |
| Nginx | any recent |
| PM2 | `npm i -g pm2` |

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/amirsubhi/ngtt.git
cd ngtt

# 2. Backend
cd backend
cp .env.example .env          # fill in the required values
npm install
npm run migrate               # applies all SQL migrations (idempotent)
npm run dev                   # starts Fastify with live reload

# 3. Frontend  (new terminal)
cd frontend
cp .env.example .env.local    # fill in the required values
npm install
npm run dev                   # starts Next.js dev server
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |

---

## Environment Variables

<details>
<summary><strong>Backend — <code>backend/.env</code></strong></summary>

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-domain.com

# Database & cache
DATABASE_URL=mysql://user:password@127.0.0.1:3306/ngtt
REDIS_URL=redis://127.0.0.1:6379

# JWT  (generate each with: openssl rand -hex 64)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# File storage
UPLOAD_PATH=/var/www/ngtt/uploads
UPLOAD_URL=https://your-domain.com/uploads

# Email (SMTP)
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=noreply@your-domain.com
SMTP_PASS=
SMTP_FROM=NGTT <noreply@your-domain.com>

# External APIs
TURNSTILE_SECRET_KEY=
TMDB_API_KEY=
MUSICBRAINZ_UA=NGTT/1.0 (admin@your-domain.com)

# Encryption key  (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=

# Tracker intervals (seconds)
ANNOUNCE_INTERVAL=1800
MIN_ANNOUNCE_INTERVAL=900
```

</details>

<details>
<summary><strong>Frontend — <code>frontend/.env.local</code></strong></summary>

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=wss://your-domain.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_SITE_NAME=NGTT
```

</details>

---

## Production Deployment

```bash
# Build both applications
cd backend  && npm run build
cd frontend && npm run build

# Start all processes via PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# Zero-downtime reload
pm2 reload all

# View logs
pm2 logs
```

Nginx must use `ip_hash` for Socket.io sticky sessions across cluster workers — see `nginx.conf` for the full configuration.

---

## Project Structure

```
ngtt/
├── backend/
│   ├── src/
│   │   ├── announce/          # Announce + scrape handlers (Redis-first)
│   │   ├── routes/            # All API routes  (one file = one purpose)
│   │   ├── jobs/              # BullMQ workers + cron jobs
│   │   ├── lib/               # db · redis · logger · errors · encrypt
│   │   └── middleware/        # auth · rate-limit · feature flags · lastSeen
│   └── migrations/            # Numbered SQL files, applied by npm run migrate
├── frontend/
│   ├── app/[locale]/          # Next.js App Router pages (all under locale segment)
│   ├── components/            # Shared UI components
│   ├── messages/              # i18n JSON  (en · zh-CN · es · pt-BR · ar · ms-MY)
│   └── styles/                # Global CSS + 7 theme definitions
├── shared/
│   ├── types/                 # Shared TypeScript interfaces
│   └── constants/             # Shared constants
├── ecosystem.config.js        # PM2 process configuration
└── nginx.conf                 # Nginx reverse proxy + SSL template
```

---

## License

MIT © 2026 [amirsubhi](https://github.com/amirsubhi)
