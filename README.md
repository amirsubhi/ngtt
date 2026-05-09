# NGTT — Next-Gen Torrent Tracker

A private BitTorrent tracker built for quality, speed, and longevity.

**Stack:** Node.js 20, Fastify, MySQL 8, Redis 7, Socket.io, BullMQ, Next.js 14, Tailwind CSS

**Features:** Announce/scrape, ratio tracking, H&R enforcement, Flux currency, forums, shoutbox, news, subtitles, 2FA, 7 themes, 6 languages (with Arabic RTL), RSS/Torznab feeds, invite system, staff/admin panels.

## Quick Links

- [Installation Guide](docs/INSTALL.md) — server setup, env vars, first-run checklist
- [Build Guide](docs/guide.md) — full architecture and feature specifications

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

See [docs/INSTALL.md](docs/INSTALL.md) for production deployment.
