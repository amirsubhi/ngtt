╔═══════════════════════════════════════════════════════════════════╗
║           NGTT — NEXT-GEN TORRENT TRACKER                        ║
║           MASTER BUILD PROMPT FOR CLAUDE CODE                     ║
╚═══════════════════════════════════════════════════════════════════╝

READ THIS ENTIRE DOCUMENT BEFORE WRITING A SINGLE LINE OF CODE.
Build in strict batches. Complete each batch fully, confirm what
was built, then proceed to the next. Never skip ahead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — PROJECT VISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NGTT (Next-Gen Torrent Tracker) is a modern private BitTorrent
tracker platform built from the ground up with a clean JavaScript
stack. It exists in the space between the familiar simplicity of
classic XBTIT-style trackers and the modern polish that the best
PHP trackers of the current generation have established.

NGTT is not trying to be everything. It is trying to be exactly
enough — fast to deploy, easy to operate, and genuinely enjoyable
to use.

THE INSPIRATION:

XBTIT showed us that simplicity wins. Operators ran communities
of thousands on modest hardware with a codebase anyone could
understand. The shoutbox, the table-based browse, the direct
tracker integration — everything was immediate and functional.
Users knew where everything was. It worked.

The generation of modern PHP trackers proved that tracker software
could feel like a genuine web product — rich media cards,
real-time chat, bonus economies, polished admin panels. They set
the bar. They inspired thousands of operators. NGTT learned from
everything they built and everything they taught the community.

The elite content trackers — the ones you need an invite to reach
— showed us that what users actually care about is never feature
count. It is content quality, fast search, reliable seeding and
community trust. Strip everything back to what matters. Do those
things exceptionally well.

Modern SaaS products — Vercel, Linear, Supabase, Spotify — showed
us that dark interfaces, clean typography, CSS variable theming
and real-time updates are not luxuries. They are the baseline
expectation for any web product built today.

NGTT stands on the shoulders of all of them.

DESIGN PHILOSOPHY:

Familiar first.     Users from classic trackers feel at home
                    within minutes. Core patterns preserved.

Progressive.        Every advanced feature is a toggle. Launch
                    lean. Unlock as the community grows.

Performance.        The announce handler is sacred. Redis-first.
                    Async writes. Never block the response.

Honest economy.     Flux rewards real contribution — seeding time,
                    quality uploads, subtitle contributions.
                    Not engagement farming. Not pay-to-win.

Built for the world. Six languages. Malaysian Malay first-class.
                    Full RTL for Arabic. Torznab for the arr
                    ecosystem. OpenSubtitles with user privacy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — ENGINEERING PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE CORE PRINCIPLE: Fast. Simple. Stable. In that order. Always.

Every decision is measured against:
  1. Is it fast enough?
  2. Is it simple enough?
  3. Is it stable enough?

If the answer to any is no — redesign before building.

GOLDEN RULES — follow on every file:

  1.  If a junior dev cannot read it in 5 minutes, simplify it
  2.  No class where a function works
  3.  No abstraction for code used in only one place
  4.  Comments explain WHY not WHAT
  5.  Early returns, never deep nesting
  6.  Named constants, never magic numbers
  7.  Explicit imports, never barrel files
  8.  Raw SQL with mysql2, never ORM
  9.  Zod on every request body, no exceptions
  10. Every async operation has error handling
  11. Never block the HTTP response — queue slow work
  12. Keep each file under 200 lines — split if larger
  13. One file, one purpose
  14. Build working first — optimize only if slow
  15. When in doubt — do less, do it well

CODE PATTERNS:

// Database — thin wrapper only
import mysql from 'mysql2/promise';
const pool = mysql.createPool({ uri: process.env.DATABASE_URL,
  connectionLimit: 20, waitForConnections: true });
export async function query<T>(sql: string, p?: any[]): Promise<T[]>
  { const [rows] = await pool.execute(sql, p); return rows as T[]; }
export async function queryOne<T>(sql: string, p?: any[])
  : Promise<T | null>
  { const rows = await query<T>(sql, p); return rows[0] ?? null; }
export async function execute(sql: string, p?: any[]): Promise<void>
  { await pool.execute(sql, p); }

// Error hierarchy — throw anywhere, caught once
export class AppError extends Error {
  constructor(public message: string,
    public statusCode = 500, public code = 'INTERNAL_ERROR')
  { super(message); }
}
export class NotFoundError extends AppError {
  constructor(m='Not found') { super(m, 404, 'NOT_FOUND'); } }
export class UnauthorizedError extends AppError {
  constructor(m='Unauthorized') { super(m, 401, 'UNAUTHORIZED'); } }
export class ForbiddenError extends AppError {
  constructor(m='Forbidden') { super(m, 403, 'FORBIDDEN'); } }
export class ValidationError extends AppError {
  constructor(m='Invalid input') { super(m, 400, 'VALIDATION'); } }

// Flat announce pattern — readable top to bottom
fastify.get('/announce/:passkey', async (req, reply) => {
  const user = await getUserByPasskey(req.params.passkey);
  if (!user) return bencode({ 'failure reason': 'Invalid passkey' });
  if (user.is_banned) return bencode({ 'failure reason': 'Banned' });
  // continues flat...
});

WHAT WE ARE NOT BUILDING:
  No ORM (Prisma, Sequelize, TypeORM)
  No state management library (Redux, Zustand)
  No microservices — one backend process
  No GraphQL — REST only
  No Docker — runs directly on VM
  No message broker — BullMQ is enough
  No separate search service — MySQL FULLTEXT at launch
  No barrel files — explicit imports only
  No factory patterns or DI containers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — TECH STACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend:    Next.js 14 (App Router), TypeScript, Tailwind CSS,
             shadcn/ui, next-intl, next-themes
Backend:     Fastify, TypeScript, Node.js 20 LTS
Database:    MySQL 8.0 (mysql2 — no ORM)
Cache:       Redis 7 (ioredis)
Realtime:    Socket.io
Queue:       BullMQ (Redis-backed, 2 queues only)
Auth:        JWT (RS256, 15min access + 7d refresh)
Captcha:     Cloudflare Turnstile + honeypot field
Bencode:     bencode (npm)
Torrent:     parse-torrent (npm)
MediaInfo:   mediainfo-client (npm) — wraps mediainfo CLI
Metadata:    TMDB API + MusicBrainz API
Images:      sharp (resize covers + screenshots)
Email:       Nodemailer (SMTP)
Validation:  Zod (every request body)
Encryption:  AES-256-GCM (sensitive stored keys)
Passwords:   bcrypt cost factor 12
SSL:         Let's Encrypt via certbot
Server:      Nginx (reverse proxy + static files)
Process:     PM2 (cluster mode)

PACKAGES — no more, no less:
  mysql2, ioredis, bullmq, fastify, socket.io,
  next, next-intl, next-themes, tailwindcss,
  @shadcn/ui, zod, bcrypt, jsonwebtoken,
  bencode, parse-torrent, mediainfo-client,
  nodemailer, sharp, crypto (built-in)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — MONOREPO STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/ngtt
  /backend
    /src
      /announce        announce + scrape handlers
      /auth            login, register, JWT, passkey
      /torrents        upload, browse, download, detail
      /users           profile, preferences, classes
      /forum           categories, topics, posts
      /flux            economy, store, transactions
      /hnr             hit and run tracking
      /shoutbox        realtime chat
      /subtitles       upload, sync, voting
      /staff           moderation, bans, warnings
      /admin           settings, feature flags
      /jobs            BullMQ workers + cron scripts
      /lib             db, redis, mail, storage, errors
      /middleware      auth, rate limit, feature flags
    /migrations        numbered SQL migration files
    package.json
    tsconfig.json

  /frontend
    /app/[locale]      all pages under locale segment
      /browse
      /torrent/[id]
      /upload
      /forum
      /requests
      /messages
      /bonus
      /invites
      /settings
      /user/[username]
      /helpdesk
      /staff
      /admin
    /components        shared UI components
    /lib               API client, hooks, utils
    /messages          i18n JSON files (6 locales)
    /styles            global CSS + theme variables
    package.json
    tsconfig.json

  /shared
    /types             shared TypeScript interfaces
    /constants         shared constants
    package.json

  .env.example
  ecosystem.config.js  PM2 config
  nginx.conf
  README.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# /backend/.env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://ngtt.com

DATABASE_URL=mysql://ngtt_user:password@127.0.0.1:3306/ngtt
REDIS_URL=redis://127.0.0.1:6379

JWT_ACCESS_SECRET=long_random_secret_min_64_chars
JWT_REFRESH_SECRET=different_long_random_secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

UPLOAD_PATH=/var/www/ngtt/uploads
UPLOAD_URL=https://ngtt.com/uploads

SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=noreply@ngtt.com
SMTP_PASS=smtp_password
SMTP_FROM=NGTT <noreply@ngtt.com>

TURNSTILE_SECRET_KEY=your_turnstile_secret
TMDB_API_KEY=your_tmdb_key
MUSICBRAINZ_UA=NGTT/1.0 (admin@ngtt.com)

ENCRYPTION_KEY=64_char_hex_for_aes256
ANNOUNCE_INTERVAL=1800
MIN_ANNOUNCE_INTERVAL=900

# /frontend/.env
NEXT_PUBLIC_API_URL=https://ngtt.com/api
NEXT_PUBLIC_WS_URL=wss://ngtt.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
NEXT_PUBLIC_SITE_NAME=NGTT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — DATABASE SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create numbered migration files in /backend/migrations/
Run in order. Every table needs created_at. Index every
foreign key and every column used in WHERE clauses.

-- 001_users.sql
CREATE TABLE user_groups (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  slug          VARCHAR(50) NOT NULL UNIQUE,
  color         VARCHAR(7)  DEFAULT '#6366f1',
  min_ratio     DECIMAL(5,2) DEFAULT 0,
  min_upload    BIGINT      DEFAULT 0,
  min_age_days  INT         DEFAULT 0,
  max_invites   INT         DEFAULT 0,
  can_upload    BOOLEAN     DEFAULT TRUE,
  can_download  BOOLEAN     DEFAULT TRUE,
  download_slots INT        DEFAULT -1,
  is_staff      BOOLEAN     DEFAULT FALSE,
  display_order INT         DEFAULT 0,
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_groups (name,slug,color,max_invites,is_staff)
VALUES
  ('Newbie',        'newbie',     '#94a3b8', 0,  FALSE),
  ('Member',        'member',     '#6366f1', 3,  FALSE),
  ('Power User',    'power-user', '#8b5cf6', 5,  FALSE),
  ('VIP',           'vip',        '#f59e0b', 10, FALSE),
  ('Uploader',      'uploader',   '#10b981', 5,  FALSE),
  ('Moderator',     'moderator',  '#f97316', 10, TRUE),
  ('Administrator', 'admin',      '#ef4444', -1, TRUE),
  ('Banned',        'banned',     '#374151', 0,  FALSE);

CREATE TABLE users (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  username              VARCHAR(50)  NOT NULL UNIQUE,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  passkey               VARCHAR(32)  NOT NULL UNIQUE,
  rss_key               VARCHAR(32)  NOT NULL UNIQUE,
  api_key               VARCHAR(64)  UNIQUE,
  api_enabled           BOOLEAN      DEFAULT FALSE,
  group_id              INT          NOT NULL DEFAULT 1,
  invited_by            INT          NULL,
  invite_tokens         INT          DEFAULT 0,
  uploaded              BIGINT       DEFAULT 0,
  downloaded            BIGINT       DEFAULT 0,
  flux                  DECIMAL(10,2) DEFAULT 0,
  is_banned             BOOLEAN      DEFAULT FALSE,
  ban_reason            TEXT         NULL,
  warned                BOOLEAN      DEFAULT FALSE,
  warning_expires_at    TIMESTAMP    NULL,
  failed_login_count    INT          DEFAULT 0,
  locked_until          TIMESTAMP    NULL,
  email_verified        BOOLEAN      DEFAULT FALSE,
  email_verify_token    VARCHAR(64)  NULL,
  email_verify_expires  TIMESTAMP    NULL,
  password_reset_token  VARCHAR(64)  NULL,
  password_reset_expires TIMESTAMP  NULL,
  two_factor_enabled    BOOLEAN      DEFAULT FALSE,
  two_factor_secret     VARCHAR(32)  NULL,
  birth_date            DATE         NULL,
  show_birthday         BOOLEAN      DEFAULT TRUE,
  locale                VARCHAR(10)  DEFAULT 'en',
  theme                 ENUM('void','pulse','cipher','nebula',
                             'ember','lumen','sand')
                                     DEFAULT 'void',
  avatar_url            VARCHAR(500) NULL,
  about_me              TEXT         NULL,
  last_seen_at          TIMESTAMP    NULL,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id)   REFERENCES user_groups(id),
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_passkey    (passkey),
  INDEX idx_email      (email),
  INDEX idx_group      (group_id),
  INDEX idx_last_seen  (last_seen_at)
);

CREATE TABLE user_preferences (
  user_id               INT PRIMARY KEY,
  browse_view           ENUM('table','card') DEFAULT 'table',
  torrents_per_page     INT          DEFAULT 50,
  profile_private       BOOLEAN      DEFAULT FALSE,
  show_online_status    BOOLEAN      DEFAULT TRUE,
  hide_download_history BOOLEAN      DEFAULT FALSE,
  notify_hnr_warning    BOOLEAN      DEFAULT TRUE,
  notify_ratio_low      BOOLEAN      DEFAULT TRUE,
  notify_request_filled BOOLEAN      DEFAULT TRUE,
  notify_forum_reply    BOOLEAN      DEFAULT TRUE,
  notify_pm_received    BOOLEAN      DEFAULT TRUE,
  notify_promotion      BOOLEAN      DEFAULT TRUE,
  notify_new_torrent    BOOLEAN      DEFAULT FALSE,
  email_hnr_warning     BOOLEAN      DEFAULT TRUE,
  email_pm_received     BOOLEAN      DEFAULT TRUE,
  email_staff_message   BOOLEAN      DEFAULT TRUE,
  forum_signature       TEXT         NULL,
  watched_categories    JSON         DEFAULT ('[]'),
  os_api_key_enc        TEXT         NULL,
  os_username           VARCHAR(100) NULL,
  os_enabled            BOOLEAN      DEFAULT FALSE,
  os_auto_sync          BOOLEAN      DEFAULT FALSE,
  os_preferred_langs    JSON         DEFAULT ('[]'),
  os_verified           BOOLEAN      DEFAULT FALSE,
  updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE username_history (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  old_username  VARCHAR(50)  NOT NULL,
  changed_by    INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id)
);

CREATE TABLE refresh_tokens (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  token_hash    VARCHAR(255) NOT NULL UNIQUE,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token  (token_hash),
  INDEX idx_user   (user_id)
);

CREATE TABLE login_attempts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  ip_address    VARCHAR(45)  NOT NULL,
  username_tried VARCHAR(50) NULL,
  attempted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip  (ip_address),
  INDEX idx_at  (attempted_at)
);

CREATE TABLE ip_bans (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  ip_address    VARCHAR(50)  NOT NULL,
  reason        TEXT         NULL,
  banned_by     INT          NULL,
  expires_at    TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_ip  (ip_address)
);

-- 002_invites.sql
CREATE TABLE invites (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  sender_id     INT          NOT NULL,
  receiver_email VARCHAR(255) NOT NULL,
  token         VARCHAR(32)  NOT NULL UNIQUE,
  used          BOOLEAN      DEFAULT FALSE,
  used_by       INT          NULL,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by)   REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_token    (token),
  INDEX idx_sender   (sender_id)
);

-- 003_torrents.sql
CREATE TABLE categories (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  icon          VARCHAR(50)  NULL,
  display_order INT          DEFAULT 0,
  is_active     BOOLEAN      DEFAULT TRUE
);

INSERT INTO categories (name, slug, icon, display_order) VALUES
  ('Movies',       'movies',       '🎬', 1),
  ('TV Shows',     'tv',           '📺', 2),
  ('Music',        'music',        '🎵', 3),
  ('Games',        'games',        '🎮', 4),
  ('Software',     'software',     '💿', 5),
  ('Books',        'books',        '📚', 6),
  ('Anime',        'anime',        '⛩️', 7),
  ('Other',        'other',        '📦', 8);

CREATE TABLE tags (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(50)  NOT NULL UNIQUE,
  slug          VARCHAR(50)  NOT NULL UNIQUE,
  color         VARCHAR(7)   DEFAULT '#6366f1',
  usage_count   INT          DEFAULT 0,
  created_by    INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE torrents (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  info_hash     VARCHAR(40)  NOT NULL UNIQUE,
  name          VARCHAR(500) NOT NULL,
  slug          VARCHAR(600) NOT NULL,
  description   TEXT         NULL,
  category_id   INT          NOT NULL,
  uploader_id   INT          NOT NULL,
  size          BIGINT       NOT NULL DEFAULT 0,
  num_files     INT          DEFAULT 1,
  is_freeleech  BOOLEAN      DEFAULT FALSE,
  is_featured   BOOLEAN      DEFAULT FALSE,
  featured_by   INT          NULL,
  is_approved   BOOLEAN      DEFAULT FALSE,
  approved_by   INT          NULL,
  approved_at   TIMESTAMP    NULL,
  is_internal   BOOLEAN      DEFAULT FALSE,
  tmdb_id       INT          NULL,
  imdb_id       VARCHAR(12)  NULL,
  musicbrainz_id VARCHAR(36) NULL,
  poster_url    VARCHAR(500) NULL,
  release_year  INT          NULL,
  download_count INT         DEFAULT 0,
  thank_count   INT          DEFAULT 0,
  view_count    INT          DEFAULT 0,
  nfo_content   TEXT         NULL,
  magnet_enabled BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (featured_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_info_hash   (info_hash),
  INDEX idx_category    (category_id),
  INDEX idx_uploader    (uploader_id),
  INDEX idx_approved    (is_approved),
  INDEX idx_created     (created_at),
  INDEX idx_freeleech   (is_freeleech),
  FULLTEXT INDEX ft_name (name)
);

CREATE TABLE torrent_files (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  path          VARCHAR(1000) NOT NULL,
  size          BIGINT       NOT NULL,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_torrent (torrent_id)
);

CREATE TABLE torrent_mediainfo (
  torrent_id    INT PRIMARY KEY,
  video_codec   VARCHAR(50)  NULL,
  resolution    VARCHAR(20)  NULL,
  video_bitrate INT          NULL,
  hdr           ENUM('none','HDR10','HDR10+','DV','HLG') DEFAULT 'none',
  frame_rate    VARCHAR(10)  NULL,
  audio_codec   VARCHAR(50)  NULL,
  audio_channels VARCHAR(10) NULL,
  audio_langs   JSON         NULL,
  container     VARCHAR(20)  NULL,
  source        ENUM('BluRay','BluRay Remux','UHD BluRay',
                     'WEB-DL','WEBRip','HDTV','DVD','Other')
                             DEFAULT 'Other',
  duration_mins INT          NULL,
  raw_output    TEXT         NULL,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE TABLE torrent_screenshots (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  uploaded_by   INT          NOT NULL,
  url           VARCHAR(500) NOT NULL,
  display_order INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_torrent (torrent_id)
);

CREATE TABLE torrent_tags (
  torrent_id    INT NOT NULL,
  tag_id        INT NOT NULL,
  added_by      INT NULL,
  PRIMARY KEY (torrent_id, tag_id),
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)     REFERENCES tags(id)     ON DELETE CASCADE,
  FOREIGN KEY (added_by)   REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE torrent_bookmarks (
  user_id       INT NOT NULL,
  torrent_id    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, torrent_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);

CREATE TABLE torrent_thanks (
  user_id       INT NOT NULL,
  torrent_id    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, torrent_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE TABLE torrent_snatches (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  torrent_id    INT          NOT NULL,
  completed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_torrent (torrent_id),
  UNIQUE KEY uq_snatch (user_id, torrent_id)
);

CREATE TABLE reseed_requests (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  requested_by  INT          NOT NULL,
  notified_at   TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)   REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id)    ON DELETE CASCADE,
  UNIQUE KEY uq_reseed (torrent_id, requested_by)
);

-- 004_announce.sql
CREATE TABLE announce_stats (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  torrent_id    INT          NOT NULL,
  uploaded_delta BIGINT      DEFAULT 0,
  downloaded_delta BIGINT    DEFAULT 0,
  is_freeleech  BOOLEAN      DEFAULT FALSE,
  event         VARCHAR(20)  NULL,
  peer_id       VARCHAR(40)  NULL,
  ip_address    VARCHAR(45)  NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_torrent (torrent_id),
  INDEX idx_created (created_at)
);

CREATE TABLE banned_clients (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  peer_id_prefix VARCHAR(8)  NOT NULL UNIQUE,
  client_name   VARCHAR(100) NOT NULL,
  reason        TEXT         NULL,
  added_by      INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 005_hnr.sql
CREATE TABLE hit_and_runs (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  user_id           INT          NOT NULL,
  torrent_id        INT          NOT NULL,
  downloaded_at     TIMESTAMP    NOT NULL,
  seed_deadline_at  TIMESTAMP    NOT NULL,
  seeded_time_mins  INT          DEFAULT 0,
  status            ENUM('active','resolved','pardoned','expired')
                                 DEFAULT 'active',
  pardoned_by       INT          NULL,
  pardon_reason     TEXT         NULL,
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (pardoned_by)REFERENCES users(id)    ON DELETE SET NULL,
  UNIQUE KEY uq_hnr (user_id, torrent_id),
  INDEX idx_user   (user_id),
  INDEX idx_status (status),
  INDEX idx_deadline (seed_deadline_at)
);

-- 006_flux.sql
CREATE TABLE flux_transactions (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  type          ENUM('earn','spend') NOT NULL,
  source        VARCHAR(100) NOT NULL,
  description   VARCHAR(255) NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_created (created_at)
);

CREATE TABLE flux_store_items (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  description   TEXT         NULL,
  cost          DECIMAL(10,2) NOT NULL,
  type          ENUM('invite_token','freeleech_token',
                     'upload_credit','username_change') NOT NULL,
  value         INT          DEFAULT 1,
  is_active     BOOLEAN      DEFAULT TRUE,
  display_order INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO flux_store_items
  (name, description, cost, type, value, display_order) VALUES
  ('Invite Token',      '1 invite to send to a friend',    500,  'invite_token',    1, 1),
  ('Freeleech Token',   'Personal 24h freeleech on 1 torrent', 200, 'freeleech_token', 1, 2),
  ('Upload Credit',     'Add 5GB to your upload stats',    300,  'upload_credit',   5368709120, 3),
  ('Username Change',   'Change your username once',       500,  'username_change', 1, 4);

CREATE TABLE personal_freeleech (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  torrent_id    INT          NULL,
  expires_at    TIMESTAMP    NOT NULL,
  used          BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE SET NULL,
  INDEX idx_user (user_id)
);

-- 007_requests.sql
CREATE TABLE torrent_requests (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT         NULL,
  category_id   INT          NULL,
  bounty_flux   DECIMAL(10,2) DEFAULT 0,
  is_filled     BOOLEAN      DEFAULT FALSE,
  filled_by     INT          NULL,
  filled_torrent_id INT      NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)            REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (category_id)        REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (filled_by)          REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (filled_torrent_id)  REFERENCES torrents(id) ON DELETE SET NULL,
  INDEX idx_user     (user_id),
  INDEX idx_filled   (is_filled)
);

-- 008_subtitles.sql
CREATE TABLE subtitles (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  uploaded_by   INT          NULL,
  language      VARCHAR(10)  NOT NULL,
  language_label VARCHAR(50) NOT NULL,
  format        ENUM('srt','ass','ssa','vtt','sub','idx','sup') NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INT          NOT NULL,
  is_approved   BOOLEAN      DEFAULT TRUE,
  approved_by   INT          NULL,
  download_count INT         DEFAULT 0,
  is_machine_translated BOOLEAN DEFAULT FALSE,
  source        ENUM('manual','opensubtitles_sync') DEFAULT 'manual',
  synced_by     INT          NULL,
  os_subtitle_id VARCHAR(50) NULL,
  notes         TEXT         NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (synced_by)   REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_torrent  (torrent_id),
  INDEX idx_language (language)
);

CREATE TABLE subtitle_votes (
  subtitle_id   INT NOT NULL,
  user_id       INT NOT NULL,
  vote          ENUM('up','down') NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subtitle_id, user_id),
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);

-- 009_forum.sql
CREATE TABLE forum_categories (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT         NULL,
  display_order INT          DEFAULT 0,
  is_staff_only BOOLEAN      DEFAULT FALSE,
  topic_count   INT          DEFAULT 0,
  post_count    INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forum_topics (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  category_id   INT          NOT NULL,
  user_id       INT          NOT NULL,
  title         VARCHAR(500) NOT NULL,
  slug          VARCHAR(600) NOT NULL,
  is_pinned     BOOLEAN      DEFAULT FALSE,
  is_locked     BOOLEAN      DEFAULT FALSE,
  views         INT          DEFAULT 0,
  reply_count   INT          DEFAULT 0,
  last_reply_at TIMESTAMP    NULL,
  last_reply_by INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id)  REFERENCES forum_categories(id),
  FOREIGN KEY (user_id)      REFERENCES users(id),
  FOREIGN KEY (last_reply_by)REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_category (category_id),
  INDEX idx_created  (created_at)
);

CREATE TABLE forum_posts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  topic_id      INT          NOT NULL,
  user_id       INT          NOT NULL,
  body          TEXT         NOT NULL,
  edited_at     TIMESTAMP    NULL,
  edited_by     INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id)  REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_topic   (topic_id),
  INDEX idx_created (created_at)
);

-- 010_messages.sql
CREATE TABLE messages (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  sender_id           INT          NOT NULL,
  receiver_id         INT          NOT NULL,
  subject             VARCHAR(255) NOT NULL,
  body                TEXT         NOT NULL,
  is_read             BOOLEAN      DEFAULT FALSE,
  deleted_by_sender   BOOLEAN      DEFAULT FALSE,
  deleted_by_receiver BOOLEAN      DEFAULT FALSE,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_receiver (receiver_id),
  INDEX idx_sender   (sender_id)
);

-- 011_notifications.sql
CREATE TABLE notifications (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  type          VARCHAR(50)  NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT         NULL,
  url           VARCHAR(500) NULL,
  is_read       BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_read    (is_read),
  INDEX idx_created (created_at)
);

-- 012_shoutbox.sql
CREATE TABLE shoutbox_archive (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  username      VARCHAR(50)  NOT NULL,
  group_color   VARCHAR(7)   DEFAULT '#6366f1',
  content       TEXT         NOT NULL,
  is_system     BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created (created_at)
);

-- 013_staff.sql
CREATE TABLE user_warnings (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  issued_by     INT          NOT NULL,
  reason        TEXT         NOT NULL,
  type          ENUM('warning','shoutbox_ban','download_ban',
                     'upload_ban','temp_suspension','permanent_ban')
                             DEFAULT 'warning',
  expires_at    TIMESTAMP    NULL,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id),
  INDEX idx_user   (user_id),
  INDEX idx_active (is_active)
);

CREATE TABLE audit_logs (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NULL,
  action        VARCHAR(100) NOT NULL,
  target_type   VARCHAR(50)  NULL,
  target_id     INT          NULL,
  metadata      JSON         NULL,
  ip_address    VARCHAR(45)  NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user    (user_id),
  INDEX idx_created (created_at)
);

CREATE TABLE reports (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  reporter_id   INT          NOT NULL,
  target_type   ENUM('torrent','post','user') NOT NULL,
  target_id     INT          NOT NULL,
  reason        TEXT         NOT NULL,
  status        ENUM('pending','resolved','dismissed')
                             DEFAULT 'pending',
  resolved_by   INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
);

CREATE TABLE dmca_notices (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NULL,
  claimant_name VARCHAR(255) NOT NULL,
  claimant_email VARCHAR(255) NOT NULL,
  description   TEXT         NOT NULL,
  status        ENUM('pending','actioned','dismissed')
                             DEFAULT 'pending',
  actioned_by   INT          NULL,
  actioned_at   TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE SET NULL,
  FOREIGN KEY (actioned_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_status (status)
);

CREATE TABLE helpdesk_tickets (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  category      ENUM('ratio','hnr','account','bug','other')
                             DEFAULT 'other',
  status        ENUM('open','in_progress','resolved','closed')
                             DEFAULT 'open',
  priority      ENUM('low','medium','high') DEFAULT 'low',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
);

CREATE TABLE helpdesk_replies (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id     INT          NOT NULL,
  user_id       INT          NOT NULL,
  body          TEXT         NOT NULL,
  is_staff      BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES helpdesk_tickets(id)
                           ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  INDEX idx_ticket (ticket_id)
);

-- 014_news.sql
CREATE TABLE news (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(300) NOT NULL UNIQUE,
  body          TEXT         NOT NULL,
  author_id     INT          NOT NULL,
  is_pinned     BOOLEAN      DEFAULT FALSE,
  published_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_published (published_at)
);

CREATE TABLE custom_pages (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(300) NOT NULL UNIQUE,
  body          TEXT         NOT NULL,
  show_in_nav   BOOLEAN      DEFAULT FALSE,
  display_order INT          DEFAULT 0,
  is_published  BOOLEAN      DEFAULT TRUE,
  created_by    INT          NULL,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO custom_pages (title, slug, body, show_in_nav,
  display_order, is_published) VALUES
  ('Rules', 'rules', 'Site rules go here.', TRUE, 1, TRUE),
  ('FAQ',   'faq',   'FAQ content goes here.', TRUE, 2, TRUE);

-- 015_site_settings.sql
CREATE TABLE site_settings (
  `key`         VARCHAR(100) PRIMARY KEY,
  value         TEXT         NOT NULL,
  type          ENUM('bool','int','string','json') DEFAULT 'string',
  `group`       VARCHAR(50)  DEFAULT 'general',
  label         VARCHAR(255) NOT NULL,
  description   TEXT         NULL,
  updated_by    INT          NULL,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO site_settings (`key`,value,type,`group`,label) VALUES
-- SITE
('site_name',            'NGTT',   'string','general','Site Name'),
('site_description',     'Next-Gen Torrent Tracker',
                                   'string','general','Site Description'),
('maintenance_mode',     'false',  'bool',  'general','Maintenance Mode'),
('default_theme',        'void',   'string','general','Default Theme'),
('default_locale',       'en',     'string','general','Default Language'),

-- REGISTRATION
('registration_open',    'true',   'bool',  'registration','Open Registration'),
('invite_system_enabled','true',   'bool',  'registration','Invite System'),
('email_domain_blacklist','["mailinator.com","10minutemail.com","tempmail.com","guerrillamail.com"]',
                                   'json',  'registration','Blocked Email Domains'),

-- CAPTCHA
('captcha_provider',     'turnstile','string','security','Captcha Provider'),
('captcha_on_register',  'true',   'bool',  'security','Captcha on Register'),
('captcha_on_login',     'false',  'bool',  'security','Captcha on Login'),
('captcha_on_login_after_fails','true','bool','security','Captcha After Failed Logins'),
('captcha_fail_threshold','3',     'int',   'security','Show Captcha After X Fails'),
('turnstile_site_key',   '',       'string','security','Turnstile Site Key'),
('turnstile_secret_key', '',       'string','security','Turnstile Secret Key'),

-- SECURITY
('max_login_attempts',   '5',      'int',   'security','Max Login Attempts'),
('lockout_minutes',      '15',     'int',   'security','Lockout Duration (mins)'),
('client_whitelist_enabled','true','bool',  'security','Client Whitelist'),
('cheat_detection_enabled','true', 'bool',  'security','Cheat Detection'),
('two_factor_available', 'true',   'bool',  'security','2FA Available'),
('two_factor_required_staff','true','bool', 'security','2FA Required for Staff'),

-- TRACKER
('announce_interval',    '1800',   'int',   'tracker','Announce Interval (secs)'),
('min_announce_interval','900',    'int',   'tracker','Min Announce Interval'),
('ratio_grace_days',     '30',     'int',   'tracker','Ratio Grace Period (days)'),
('hnr_enabled',          'true',   'bool',  'tracker','H&R System'),
('hnr_grace_hours',      '72',     'int',   'tracker','H&R Grace Period (hours)'),
('hnr_min_ratio',        '1.0',    'string','tracker','H&R Minimum Ratio'),
('hnr_warn_threshold',   '3',      'int',   'tracker','H&R Warn After X'),
('hnr_ban_threshold',    '5',      'int',   'tracker','H&R Ban After X'),
('magnet_links_enabled', 'true',   'bool',  'tracker','Magnet Links'),
('magnet_show_warning',  'true',   'bool',  'tracker','Magnet Passkey Warning'),

-- FEATURES
('forum_enabled',        'true',   'bool',  'features','Forum'),
('shoutbox_enabled',     'true',   'bool',  'features','Shoutbox'),
('shoutbox_announce_uploads','true','bool', 'features','Shoutbox Upload Announce'),
('requests_enabled',     'true',   'bool',  'features','Torrent Requests'),
('subtitles_enabled',    'true',   'bool',  'features','Subtitles'),
('subtitle_moderation',  'false',  'bool',  'features','Subtitle Moderation'),
('subtitle_max_size_mb', '2',      'int',   'features','Max Subtitle Size (MB)'),
('pm_enabled',           'true',   'bool',  'features','Private Messages'),
('api_enabled',          'true',   'bool',  'features','Public API / Torznab'),
('rss_enabled',          'true',   'bool',  'features','RSS Feeds'),
('helpdesk_enabled',     'true',   'bool',  'features','Helpdesk Tickets'),
('dmca_enabled',         'true',   'bool',  'features','DMCA Form'),
('reseed_enabled',       'true',   'bool',  'features','Reseed Requests'),
('nfo_enabled',          'true',   'bool',  'features','NFO Upload/Viewer'),

-- ECONOMY
('flux_enabled',         'true',   'bool',  'economy','Flux System'),
('flux_per_torrent_hour','1.0',    'string','economy','Flux per Seeded Torrent/Hour'),
('flux_per_upload',      '50',     'int',   'economy','Flux for Approved Upload'),
('flux_per_thank',       '5',      'int',   'economy','Flux per Thank Received'),
('flux_per_subtitle',    '20',     'int',   'economy','Flux for Approved Subtitle'),
('flux_birthday_reward', '100',    'int',   'economy','Birthday Flux Reward'),
('global_freeleech',     'false',  'bool',  'economy','Global Freeleech'),

-- COMMUNITY
('welcome_pm_enabled',   'true',   'bool',  'community','Welcome PM'),
('welcome_pm_subject',   'Welcome to NGTT!',
                                   'string','community','Welcome PM Subject'),
('welcome_pm_body',      'Welcome! Please read the rules.',
                                   'string','community','Welcome PM Body'),
('birthdays_enabled',    'true',   'bool',  'community','Birthday Rewards'),
('shoutbox_max_messages','200',    'int',   'community','Shoutbox History'),

-- INACTIVITY
('inactivity_warn_days', '150',    'int',   'pruning','Inactivity Warning Days'),
('inactivity_prune_days','180',    'int',   'pruning','Inactivity Disable Days'),
('inactivity_delete_days','210',   'int',   'pruning','Inactivity Delete Days'),
('prune_exempt_classes', '["vip","uploader","moderator","admin"]',
                                   'json',  'pruning','Prune Exempt Groups');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — THEMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All 7 themes use CSS custom properties on [data-theme] attribute.
Define in /frontend/styles/themes.css
Apply on <html data-theme="..."> in root layout.
next-themes handles system preference + persistence.

[data-theme="void"]     /* DEFAULT — Vercel inspired */
  --bg-base: #0a0a0a    --bg-surface: #111111
  --bg-elevated: #1a1a1a --accent: #3b82f6
  --accent-hover: #2563eb --text-primary: #ededed
  --text-muted: #737373  --text-subtle: #404040
  --border: #222222      --border-focus: #3b82f6
  --success: #22c55e     --danger: #ef4444
  --warning: #f59e0b

[data-theme="pulse"]    /* Spotify inspired */
  --bg-base: #121212    --bg-surface: #181818
  --bg-elevated: #242424 --accent: #06b6d4
  --accent-hover: #0891b2 --text-primary: #ffffff
  --text-muted: #a3a3a3  --text-subtle: #525252
  --border: #2a2a2a      --border-focus: #06b6d4
  --success: #22c55e     --danger: #f43f5e
  --warning: #fb923c

[data-theme="cipher"]   /* Supabase inspired */
  --bg-base: #0f1117    --bg-surface: #161b22
  --bg-elevated: #1c2128 --accent: #10b981
  --accent-hover: #059669 --text-primary: #e6edf3
  --text-muted: #7d8590  --text-subtle: #3d444d
  --border: #21262d      --border-focus: #10b981
  --success: #3fb950     --danger: #f85149
  --warning: #d29922

[data-theme="nebula"]   /* Sentry inspired */
  --bg-base: #0d0d1a    --bg-surface: #13131f
  --bg-elevated: #1a1a2e --accent: #8b5cf6
  --accent-hover: #7c3aed --text-primary: #e2e0ff
  --text-muted: #8b7fa8  --text-subtle: #3d3558
  --border: #1f1b33      --border-focus: #8b5cf6
  --success: #34d399     --danger: #f87171
  --warning: #fbbf24

[data-theme="ember"]    /* Raycast inspired, warm dark */
  --bg-base: #111009    --bg-surface: #1a1710
  --bg-elevated: #232018 --accent: #f97316
  --accent-hover: #ea6a0a --text-primary: #faf0e6
  --text-muted: #a89880  --text-subtle: #4a3f32
  --border: #2a2418      --border-focus: #f97316
  --success: #4ade80     --danger: #f43f5e
  --warning: #fbbf24

[data-theme="lumen"]    /* Linear inspired, cool light */
  --bg-base: #f8fafc    --bg-surface: #ffffff
  --bg-elevated: #f1f5f9 --accent: #6366f1
  --accent-hover: #4f46e5 --text-primary: #0f172a
  --text-muted: #64748b  --text-subtle: #94a3b8
  --border: #e2e8f0      --border-focus: #6366f1
  --success: #16a34a     --danger: #dc2626
  --warning: #d97706

[data-theme="sand"]     /* Notion inspired, warm light */
  --bg-base: #faf8f3    --bg-surface: #f3f0e8
  --bg-elevated: #ede9dc --accent: #d97706
  --accent-hover: #b45309 --text-primary: #1c1917
  --text-muted: #78716c  --text-subtle: #a8a29e
  --border: #e7e2d5      --border-focus: #d97706
  --success: #15803d     --danger: #b91c1c
  --warning: #b45309

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — MULTILINGUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Library:    next-intl
Locales:    en (default), zh-CN, es, pt-BR, ar, ms-MY
RTL:        ar only — dir="rtl" on <html>
Structure:  /app/[locale]/ for all pages
Storage:    users.locale column + NEXT_LOCALE cookie

Translation files in /frontend/messages/:
  en.json, zh-CN.json, es.json,
  pt-BR.json, ar.json, ms-MY.json

Keys: nav, browse, torrent, user, auth, flux,
      hnr, forum, shoutbox, staff, common,
      settings, requests, subtitles, helpdesk

Language switcher component in navbar with flag + label.
User locale saved on login, applied on every page load.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9 — NGINX + PM2 + DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NGINX — /etc/nginx/sites-available/ngtt:

server {
  listen 443 ssl;
  server_name ngtt.com www.ngtt.com;
  ssl_certificate /etc/letsencrypt/live/ngtt.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ngtt.com/privkey.pem;

  # Static Next.js assets
  location /_next/static/ {
    alias /var/www/ngtt/frontend/.next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Uploaded files served directly
  location /uploads/ {
    alias /var/www/ngtt/uploads/;
    expires 7d;
  }

  # Next.js app
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # API
  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Announce — direct, no caching, no buffering
  location /announce/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_request_buffering off;
  }

  # Scrape
  location /scrape/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # WebSocket for shoutbox
  location /ws/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
  }
}
server {
  listen 80;
  server_name ngtt.com www.ngtt.com;
  return 301 https://$host$request_uri;
}

PM2 — ecosystem.config.js:
module.exports = { apps: [
  { name: 'ngtt-frontend', cwd: '/var/www/ngtt/frontend',
    script: 'node_modules/.bin/next', args: 'start',
    instances: 2, exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3000 } },
  { name: 'ngtt-backend', cwd: '/var/www/ngtt/backend',
    script: 'dist/server.js', instances: 2,
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 4000 } },
  { name: 'ngtt-worker', cwd: '/var/www/ngtt/backend',
    script: 'dist/worker.js', instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' } }
]};

CRON — /etc/cron.d/ngtt:
0  * * * * node /var/www/ngtt/backend/dist/jobs/flux-earn.js
30 * * * * node /var/www/ngtt/backend/dist/jobs/hnr-check.js
0  3 * * * node /var/www/ngtt/backend/dist/jobs/prune-users.js
0  0 * * * node /var/www/ngtt/backend/dist/jobs/birthdays.js
*/15 * * * * node /var/www/ngtt/backend/dist/jobs/peer-cleanup.js
0  0,12 * * * certbot renew --quiet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10 — BUILD BATCHES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complete each batch fully before starting the next.
After each batch, list what was built and confirm ready
to proceed. Do not mix batches.

═══════════════════════════════════════════════════════
BATCH 1 — PROJECT FOUNDATION
═══════════════════════════════════════════════════════

1a. Create monorepo folder structure exactly as defined
    in Section 4. Initialize package.json in each folder.
    Set up TypeScript (strict mode) in all three packages.
    Configure path aliases.

1b. Write all migration files (001 through 015) exactly
    as defined in Section 6. Create a migration runner
    script that executes them in order.
    Run migrations against a local MySQL instance.
    Confirm all tables created with correct indexes.

1c. Create /backend/lib/db.ts — the four functions only:
    query, queryOne, execute, and the pool.
    No more, no less.

1d. Create /backend/lib/redis.ts — connect to Redis,
    export the client. Add simple helpers:
    get, set, setEx, del, lPush, lTrim, lRange, mGet,
    keys, incr.

1e. Create /backend/lib/errors.ts — the error hierarchy
    exactly as defined in Section 2.

1f. Create /backend/lib/config.ts — validate all required
    environment variables at startup. Exit with clear
    message if any are missing.

1g. Create /backend/lib/storage.ts — local disk file
    operations: saveFile, deleteFile, getFileUrl.
    Upload base from UPLOAD_PATH env variable.

1h. Create /backend/lib/mail.ts — Nodemailer setup.
    Functions: sendMail(to, subject, html).
    Use SMTP env variables. Log on success and failure.

1i. Create /backend/lib/encrypt.ts — AES-256-GCM
    encrypt and decrypt functions for storing sensitive
    values like OpenSubtitles API keys.

1j. Create /backend/middleware/auth.ts:
    authenticate — verifies JWT access token, attaches
    user to request.
    requireStaff — checks user group is_staff.
    requireAdmin — checks user is admin group.

1k. Create /backend/middleware/featureFlag.ts:
    requireFeature(flag) — checks site_settings,
    returns 403 if disabled.
    Cache settings in memory Map with 60s TTL.

1l. Create /backend/middleware/rateLimiter.ts:
    Using Fastify rate limit plugin or manual Redis
    counter. Three zones: general (100/min),
    auth (10/min), announce (10/min per IP).

1m. Set up Fastify server in /backend/src/server.ts.
    Register: cors, helmet, error handler, all routes.
    Global error handler uses AppError hierarchy.

1n. Create /frontend basic Next.js 14 App Router setup.
    Configure next-intl middleware.
    Configure next-themes provider.
    Add all 7 themes to /frontend/styles/themes.css.
    Apply [data-theme] on <html> in root layout.
    Create skeleton layout with navbar placeholder.

1o. Create /shared/types — core TypeScript interfaces:
    User, Torrent, Category, Tag, FluxTransaction,
    Notification, ForumPost, Message, Subtitle.

BATCH 1 COMPLETE WHEN:
  ✓ Migrations run successfully, all tables exist
  ✓ Fastify starts without errors
  ✓ Next.js starts without errors
  ✓ DB connection works
  ✓ Redis connection works
  ✓ All 7 themes render correctly on a test page
  ✓ Environment validation exits cleanly on missing vars

═══════════════════════════════════════════════════════
BATCH 2 — AUTHENTICATION
═══════════════════════════════════════════════════════

2a. Registration endpoint POST /api/auth/register:
    - Honeypot field check (reject if filled)
    - Time check (reject if < 3 seconds since page load)
    - Turnstile verification (if captcha_on_register=true)
    - Email domain blacklist check
    - Check registration_open OR valid invite token
    - Validate: username unique, email unique,
      password min 8 chars (Zod)
    - Hash password with bcrypt cost 12
    - Generate passkey (32 char random hex)
    - Generate rss_key (32 char random hex)
    - Create user record (group_id=1 Newbie)
    - Create user_preferences record
    - Send email verification email
    - If invite token: mark as used, set invited_by
    - If welcome_pm_enabled: queue welcome PM job
    - Return: success message (not JWT — verify email first)

2b. Email verification GET /api/auth/verify-email/:token:
    - Find user by email_verify_token
    - Check not expired
    - Set email_verified=true, clear token
    - Return: success, user can now login

2c. Login endpoint POST /api/auth/login:
    - Check login_attempts table for IP lockout
    - If captcha_on_login=true OR
      (captcha_on_login_after_fails=true AND
       fail count >= captcha_fail_threshold):
      verify Turnstile token
    - Find user by username or email
    - Check email_verified=true
    - Check not banned (is_banned=false)
    - Check not locked (locked_until < NOW)
    - Verify bcrypt password
    - On fail: increment failed_login_count,
      check against max_login_attempts,
      if exceeded: set locked_until = NOW + lockout_minutes,
      log to login_attempts table
    - On success: clear failed_login_count,
      generate JWT access token (15min, RS256),
      generate refresh token (7d), store hash in DB,
      set NEXT_LOCALE cookie from user.locale,
      return tokens + user object

2d. Refresh token POST /api/auth/refresh:
    - Verify refresh token from httpOnly cookie
    - Check in refresh_tokens table, not expired
    - Issue new access token
    - Rotate refresh token (delete old, create new)

2e. Logout POST /api/auth/logout:
    - Delete refresh token from DB
    - Clear cookie

2f. Password reset flow:
    POST /api/auth/forgot-password:
      - Find user by email
      - Generate reset token (64 char hex)
      - Store hashed in password_reset_token
      - Set password_reset_expires = NOW + 1 hour
      - Send reset email
      - Rate limit: max 3 per hour per IP
    POST /api/auth/reset-password:
      - Verify token, check not expired
      - Hash new password
      - Update user, clear token fields
      - Invalidate all refresh tokens for user

2g. Passkey rotation POST /api/auth/rotate-passkey:
    - Requires authentication
    - Generate new 32 char hex passkey
    - Update users.passkey
    - Return new passkey

2h. 2FA setup (if two_factor_available=true):
    POST /api/auth/2fa/setup:
      - Generate TOTP secret (speakeasy)
      - Return QR code URI + backup codes
      - Store secret temporarily (not saved until verified)
    POST /api/auth/2fa/verify:
      - Verify TOTP code
      - Save secret to users.two_factor_secret
      - Set two_factor_enabled=true
      - Return hashed backup codes
    POST /api/auth/2fa/disable:
      - Verify current TOTP code
      - Clear secret, set two_factor_enabled=false

2i. Invite token management:
    GET  /api/invites — my invites list
    POST /api/invites — create invite (costs 1 token)
    GET  /api/auth/validate-invite/:token — check valid

2j. Frontend pages:
    /[locale]/login       — login form
    /[locale]/register    — open registration
    /[locale]/register/[token] — invite registration
    /[locale]/verify-email — verify email prompt
    /[locale]/forgot-password
    /[locale]/reset-password

    All forms use Zod validation client-side.
    Turnstile widget shown conditionally based on
    site settings fetched from /api/settings/public.

BATCH 2 COMPLETE WHEN:
  ✓ Can register with open signup
  ✓ Email verification works
  ✓ Can login and receive JWT
  ✓ Login lockout triggers after X failed attempts
  ✓ Password reset flow works end to end
  ✓ Invite-based registration works
  ✓ Passkey rotation works
  ✓ 2FA setup and verification works
  ✓ All auth pages render with theme + i18n

═══════════════════════════════════════════════════════
BATCH 3 — ANNOUNCE HANDLER
═══════════════════════════════════════════════════════

This is the most critical batch. The tracker's heartbeat.
Keep it flat. Keep it fast. No abstraction layers.

3a. Create two BullMQ queues in /backend/lib/queues.ts:
    statsQueue — high frequency stat writes
    jobsQueue  — all other background work
    Both backed by Redis. Export both queues.

3b. Create BullMQ worker in /backend/src/worker.ts:
    Stats worker (concurrency 5):
      'write-stats' → writeAnnounceStats(data)
    Jobs worker (concurrency 3):
      'hnr-update'     → updateHnr(data)
      'flux-earn'      → earnFlux(data)
      'send-email'     → sendEmail(data)
      'send-notif'     → createNotification(data)
      'parse-mediainfo'→ parseMediaInfo(data)
      'shoutbox-archive'→ archiveShoutboxMsg(data)
      'welcome-pm'     → sendWelcomePm(data)

3c. Announce handler GET /announce/:passkey:
    Exact flow — no deviations:

    1. Parse query params (info_hash, peer_id, port,
       uploaded, downloaded, left, event, numwant,
       compact, no_peer_id, ip)
    2. getUserByPasskey(passkey) from Redis cache first,
       fallback to MySQL. Cache for 5 min.
       → if not found: return bencode failure
    3. Check user.is_banned
       → if banned: return bencode failure
    4. Check user shoutbox_ban is separate
       (does not affect announce)
    5. getTorrentByHash(info_hash) from MySQL
       → if not found or not approved: bencode failure
    6. isClientBanned(peer_id.slice(0,8)) from Redis
       cached blacklist
       → if banned: bencode failure
    7. Speed sanity check:
       delta_up = uploaded - last_uploaded (from Redis)
       time_since = seconds since last announce
       speed_bps = delta_up / time_since
       if speed_bps > 1_000_000_000 (1Gbps):
         queue job 'flag-cheat' with evidence
         (do NOT block announce — just flag)
    8. Determine effective download credit:
       if global_freeleech=true OR torrent.is_freeleech=true
       OR personal freeleech active for this user+torrent:
         effective_download = 0
       else:
         effective_download = downloaded delta
    9. Update peer in Redis:
       key: peers:{info_hash}:{peer_id}
       value: JSON { ip, port, uploaded, downloaded,
                    left, seeder: left==='0',
                    user_id, updated_at }
       TTL: 2700 seconds (45 min)
    10. Handle event='stopped': remove peer from Redis
    11. Queue stats write (never await):
        statsQueue.add('write-stats', {
          user_id, torrent_id,
          uploaded_delta, downloaded_delta: effective_download,
          is_freeleech: effective_download === 0,
          event, peer_id, ip: req.ip })
    12. If left==='0' (download complete):
        Queue hnr update:
        jobsQueue.add('hnr-update',
          { user_id, torrent_id })
        Upsert torrent_snatches
    13. Get peers from Redis:
        keys = await redis.keys('peers:{info_hash}:*')
        filter out stopped peers, return up to numwant
    14. Count seeders/leechers from peer data
    15. Return bencode({
          interval: announce_interval setting,
          'min interval': min_announce_interval,
          complete: seeder_count,
          incomplete: leecher_count,
          peers: compact ? compactPeers(peers) : peers
        })

3d. Scrape handler GET /scrape/:passkey:
    - Validate passkey (same as announce)
    - Parse info_hash params (multiple allowed)
    - For each hash: get seeder/leecher counts from Redis
    - Return bencode({ files: { [hash]: {
        complete, incomplete, downloaded } } })

3e. Compact peer encoding:
    Each peer = 6 bytes (4 IP + 2 port)
    Concatenate all peers into single Buffer

3f. Redis peer helpers:
    updatePeer(infoHash, peerId, data)
    removePeer(infoHash, peerId)
    getPeers(infoHash, limit): PeerData[]
    getSeederCount(infoHash): number
    getLeecherCount(infoHash): number

3g. writeAnnounceStats worker job:
    UPDATE users SET
      uploaded = uploaded + ?,
      downloaded = downloaded + ?
    WHERE id = ?

    INSERT INTO announce_stats ...

3h. Peer cleanup cron job
    /backend/src/jobs/peer-cleanup.ts:
    Redis keys with peers: prefix older than 2700s
    are auto-expired by Redis TTL — no manual cleanup
    needed. This job just logs peer counts for monitoring.

BATCH 3 COMPLETE WHEN:
  ✓ qBittorrent/Transmission can announce successfully
  ✓ Peers appear in Redis after announce
  ✓ Ratio updates in MySQL after stats job runs
  ✓ Freeleech torrents: download not counted
  ✓ Stopped event removes peer
  ✓ Scrape returns correct counts
  ✓ Announce response is valid bencode

═══════════════════════════════════════════════════════
BATCH 4 — TORRENT SYSTEM
═══════════════════════════════════════════════════════

4a. Upload endpoint POST /api/torrents/upload:
    Requires: authenticate, requireFeature('upload_enabled')
    - Accept multipart form: .torrent file + fields
    - Parse .torrent with parse-torrent
    - Validate: file is valid torrent, not duplicate
      info_hash (check torrents table)
    - Extract: info_hash, name, size, file list
    - Validate fields with Zod:
      name, description, category_id, tags[]
      optional: tmdb_id, imdb_id, nfo_content
    - Save .torrent file to /uploads/torrents/
    - Insert torrent record (is_approved=false initially
      unless uploader is Uploader/Staff group)
    - Insert torrent_files records
    - If nfo_content provided: save in torrent record
    - Queue job 'parse-mediainfo' if video category
    - Award flux_per_upload if auto-approved
    - If is_approved=true: queue shoutbox announce
    - Return: torrent id + approval status

4b. MediaInfo parser job:
    /backend/src/jobs/parse-mediainfo.ts
    - Run mediainfo CLI on largest file in torrent
    - Parse output for: codec, resolution, audio,
      HDR, source, container, duration
    - Upsert torrent_mediainfo record

4c. TMDB metadata fetch (on upload if tmdb_id provided):
    GET https://api.themoviedb.org/3/movie/{id}
    Extract: title, year, genres, poster_path, overview
    Store poster URL in torrent.poster_url
    Graceful fallback if API fails or key not set

4d. Browse endpoint GET /api/torrents:
    Query params (all optional):
      q (search name FULLTEXT)
      category_id, tag (slug)
      freeleech (bool)
      resolution, codec, source (mediainfo filters)
      uploader (username)
      new_since_visit (bool — filter by user.last_seen_at)
      sort (created_at, name, size, seeders, leechers)
      order (asc, desc)
      page, limit (default 50, max 100)
    Returns: torrents array with seeder/leecher counts
    from Redis, heat class calculated server-side:
      0 peers = dead, <5 = cold, <25 = warm,
      <100 = hot, 100+ = burning

4e. Torrent detail GET /api/torrents/:id:
    Returns full torrent + mediainfo + screenshots
    + nfo_content + tags + peer list (from Redis)
    + user's bookmark/thank status
    + active subtitle count by language
    + reseed request status

4f. Download .torrent GET /api/torrents/:id/download:
    Requires authenticate
    - Read .torrent file from disk
    - Rewrite announce URL with user's passkey:
      https://ngtt.com/announce/{passkey}
    - Set magnet_enabled check for the site
    - Increment download_count
    - Record in torrent_snatches
    - Return modified .torrent file as download

4g. Magnet link GET /api/torrents/:id/magnet:
    Requires authenticate
    Check magnet_links_enabled setting
    Generate: magnet:?xt=urn:btih:{hash}
              &dn={encoded name}
              &tr={encoded announce URL with passkey}
              &xl={size}
    Return magnet string (never cached — per user)

4h. Screenshot upload POST /api/torrents/:id/screenshots:
    Max 5 per torrent
    Max 2MB per image
    Allowed: jpg, png, webp
    Resize to max 1920px width with sharp
    Save to /uploads/screenshots/
    Insert torrent_screenshots record

4i. Thank endpoint POST /api/torrents/:id/thank:
    Requires authenticate, one per user per torrent
    Upsert torrent_thanks
    Increment torrents.thank_count
    Award flux_per_thank to uploader
    Send notification to uploader

4j. Bookmark toggle POST /api/torrents/:id/bookmark:
    Upsert or delete torrent_bookmarks
    Return new bookmark status

4k. Frontend pages:
    /[locale]/browse    — table/card view toggle,
                          filters sidebar, heat colours,
                          "New since last visit" filter,
                          freeleech badge on rows
    /[locale]/torrent/[id] — full detail page:
                          poster, metadata, mediainfo,
                          file tree, NFO tab,
                          screenshots gallery,
                          subtitles section,
                          peers table with heat,
                          comments (forum posts),
                          thank + bookmark buttons,
                          download + magnet buttons
                          (magnet shows passkey warning)
    /[locale]/upload   — upload form with TMDB lookup,
                          tag selector, NFO textarea,
                          screenshot uploader

4l. Update user.last_seen_at on every authenticated
    request (debounced — only if > 5 min since last update)

BATCH 4 COMPLETE WHEN:
  ✓ Can upload a .torrent file
  ✓ Browse page shows torrents with heat colours
  ✓ Table view and card view both work
  ✓ Search and filters work
  ✓ Download serves modified .torrent with passkey
  ✓ Magnet link generated correctly
  ✓ Screenshots upload and display
  ✓ Thank + bookmark work
  ✓ NFO displays in monospace with ASCII preserved
  ✓ "New since last visit" filter works

═══════════════════════════════════════════════════════
BATCH 5 — USER SYSTEM
═══════════════════════════════════════════════════════

5a. User profile GET /api/users/:username:
    Returns: username, group, uploaded, downloaded,
    ratio (uploaded/downloaded), flux balance,
    join date, last seen (if show_online_status),
    avatar, about_me, active H&R count,
    warning count, upload count, thank count received
    Respect profile_private setting

5b. User settings GET+PUT /api/users/me/settings:
    All user_preferences fields
    Theme preference
    Locale preference
    Email + notification toggles

5c. Username change POST /api/users/me/username:
    Cost: 500 FLX (flux_store_items: username_change)
    Check: once per 90 days (last change in username_history)
    Validate: new username unique, valid format
    Save old username to username_history
    Deduct 500 FLX

5d. Avatar upload POST /api/users/me/avatar:
    Max 1MB, square crop with sharp
    Save to /uploads/avatars/
    Update users.avatar_url

5e. User stats page: uploads list, snatches list
    (if not hide_download_history), bookmarks

5f. User class auto-promotion cron:
    /backend/src/jobs/promote-users.ts (runs daily)
    For each user in Member class:
      Check min_ratio, min_upload, min_age_days
      for Power User group — auto-promote if met
    Log promotions, send notification to user

5g. OpenSubtitles integration:
    POST /api/users/me/integrations/opensubtitles/verify:
      Verify API key against OS API
      Save encrypted key to user_preferences.os_api_key_enc
      Save username, set os_verified=true
    GET /api/users/me/integrations/opensubtitles/quota:
      Return remaining downloads for today
    DELETE /api/users/me/integrations/opensubtitles:
      Clear all OS fields

5h. Frontend pages:
    /[locale]/user/[username]    — public profile
    /[locale]/settings           — tabs:
      Appearance (theme, language, browse view)
      Privacy (profile, download history, online status)
      Notifications (per-event toggles, email toggles)
      Security (2FA setup, passkey rotation, API key)
      Integrations (OpenSubtitles)
      Danger Zone (username change)

BATCH 5 COMPLETE WHEN:
  ✓ Profile page shows correct stats + ratio
  ✓ All settings save and persist
  ✓ Theme change applies instantly across all pages
  ✓ Language switch works correctly including RTL Arabic
  ✓ Username change costs FLX, enforces 90 day limit
  ✓ OS API key saves encrypted, verifies correctly

═══════════════════════════════════════════════════════
BATCH 6 — FLUX ECONOMY
═══════════════════════════════════════════════════════

6a. Flux earning cron job (runs every hour):
    /backend/src/jobs/flux-earn.ts
    For each active seeder (peer in Redis with seeder=true):
      Award flux_per_torrent_hour FLX to user
      Insert flux_transaction (earn, 'seeding')
      UPDATE users SET flux = flux + ? WHERE id = ?
    Batch these updates — one query per user not per torrent

6b. Flux store GET /api/flux/store:
    Returns all active flux_store_items

6c. Purchase endpoint POST /api/flux/purchase/:itemId:
    Requires authenticate
    Check user.flux >= item.cost
    Deduct flux from user
    Record flux_transaction (spend)
    Execute item effect:
      invite_token:    users.invite_tokens += 1
      freeleech_token: insert personal_freeleech
                       (24h, torrent_id=null — applies
                       to next download)
      upload_credit:   users.uploaded += item.value
      username_change: set flag (redeemed in username change)
    Return updated flux balance

6d. Flux balance GET /api/users/me/flux:
    Returns current balance + recent transactions (last 20)

6e. Birthday flux cron (runs daily at midnight):
    /backend/src/jobs/birthdays.ts
    SELECT users WHERE DATE(birth_date) = TODAY
      AND show_birthday = true
    Award flux_birthday_reward FLX to each
    Queue shoutbox system message:
      "🎂 Happy Birthday to: username1, username2!"
    Send birthday notification to user

6f. Frontend:
    /[locale]/bonus — Flux store page
    Shows FLX balance prominently
    Store items as cards with cost + description
    Purchase button with confirmation dialog
    Transaction history (last 20)

BATCH 6 COMPLETE WHEN:
  ✓ Flux earned hourly for active seeders
  ✓ Store items purchasable
  ✓ Invite token purchase adds to user invite_tokens
  ✓ Freeleech token purchase creates personal_freeleech
  ✓ Upload credit adds to user.uploaded
  ✓ Birthday cron awards FLX and shouts

═══════════════════════════════════════════════════════
BATCH 7 — COMMUNITY
═══════════════════════════════════════════════════════

7a. SHOUTBOX (requireFeature shoutbox_enabled):
    Socket.io server on /ws namespace

    On connect:
      Verify JWT token passed in handshake auth
      If no valid token: disconnect
      Send last 200 messages from Redis lRange

    On 'message' event:
      Check user not banned (is_banned or shoutbox_ban)
      Sanitize content — strip all HTML except
        [b], [i], [url] BBCode (convert to HTML)
      Max 500 chars
      Build message object:
        { id, user_id, username, group_color,
          content, created_at, is_system: false }
      lPush to Redis 'shoutbox' key
      lTrim to 0..199 (keep last 200)
      io.emit('message', message) — broadcast all
      Queue 'shoutbox-archive' job to MySQL

    System announce (called from torrent approval):
      Build system message:
        "[NEW] {name} | {category} | {size}"
        with torrent URL link
      Emit to all connected clients as is_system:true

    PM alert:
      When PM sent to user who is connected:
        Emit 'pm-alert' event to that user's socket only
        Message: "You have a new PM from {sender}"

    On 'disconnect': nothing needed (Redis TTL handles peers)

    Frontend shoutbox component:
      Collapsible sidebar on browse page
      Fixed bottom panel option (user preference)
      @username mention highlighting
      System messages styled differently
      Max height with scroll, newest at bottom
      Input with [b] [i] [url] toolbar buttons
      Shoutbox ban shows "You are banned from shoutbox"

7b. FORUM (requireFeature forum_enabled):
    GET  /api/forum/categories
    GET  /api/forum/categories/:slug/topics?page=
    GET  /api/forum/topics/:id?page=
    POST /api/forum/categories/:slug/topics (new topic)
    POST /api/forum/topics/:id/posts (new reply)
    PUT  /api/forum/posts/:id (edit — own post only)
    Staff only: pin, lock, delete topic/post

    Posts support Markdown (use marked or remark)
    Strip dangerous HTML from markdown output
    Forum signature from user_preferences.forum_signature
    Increment topic.views on each view
    Update topic.reply_count, last_reply_at, last_reply_by
    Send notification to topic author on reply

7c. PRIVATE MESSAGES (requireFeature pm_enabled):
    GET  /api/messages?folder=inbox|sent
    GET  /api/messages/:id
    POST /api/messages (send)
    DELETE /api/messages/:id
    POST /api/messages/mark-read

    On send: create notification for receiver
             emit 'pm-alert' if receiver connected to WS

7d. NOTIFICATIONS:
    GET  /api/notifications?page=
    POST /api/notifications/mark-read
    POST /api/notifications/mark-all-read

    Unread count in navbar badge
    Real-time count update via Socket.io 'notif-count' event

7e. NEWS (staff only to create):
    GET  /api/news (list, paginated)
    GET  /api/news/:slug
    POST /api/news (staff only)
    PUT  /api/news/:id (staff only)

7f. CUSTOM PAGES:
    GET /api/pages/:slug — public
    POST/PUT /api/admin/pages — admin only
    /rules and /faq seeded in migrations

7g. Frontend pages:
    /[locale]/forum
    /[locale]/forum/[category]
    /[locale]/forum/[category]/[topic]
    /[locale]/messages
    /[locale]/messages/[id]
    /[locale]/notifications

BATCH 7 COMPLETE WHEN:
  ✓ Shoutbox connects via WebSocket
  ✓ Messages appear in real-time for all connected users
  ✓ New torrent approval triggers shoutbox announce
  ✓ PM alert emits to connected recipient
  ✓ Forum categories, topics, posts all work
  ✓ Markdown renders in forum posts
  ✓ Private messages send and receive
  ✓ Notification bell shows unread count

═══════════════════════════════════════════════════════
BATCH 8 — HIT & RUN SYSTEM
═══════════════════════════════════════════════════════

8a. H&R record creation (in announce worker job):
    'hnr-update' job:
    When left===0 (download complete):
      UPSERT hit_and_runs:
        user_id, torrent_id
        downloaded_at = NOW (if new record)
        seed_deadline_at = downloaded_at + hnr_grace_hours
        seeded_time_mins = 0 (if new)
        status = 'active'
      If record exists and status='active':
        Check if user is currently seeding this torrent
        (peer exists in Redis with seeder=true)
        If seeding: seeded_time_mins += 30 (announce interval)
        If seeded_time_mins >= grace_hours * 60: status='resolved'

8b. H&R check cron (runs every 30 min):
    /backend/src/jobs/hnr-check.ts
    SELECT active H&Rs where seed_deadline_at < NOW
      AND status = 'active'
    For each:
      Set status = 'expired'
      Increment user's expired H&R count
      Check against hnr_warn_threshold:
        if count >= threshold: issue warning
        Create user_warning (type: warning)
        Send notification + email
      Check against hnr_ban_threshold:
        if count >= threshold: set is_banned=true
        Send ban notification + email

8c. H&R APIs:
    GET /api/users/me/hnr — my H&R list
    GET /api/staff/hnr    — all H&Rs (staff only)
    POST /api/staff/hnr/:id/pardon — pardon with reason

8d. H&R display on user profile:
    Active: ⚠️  Resolved: ✅  Expired: ❌
    With torrent name, deadline, seeded time

8e. H&R paused for freeleech:
    When creating H&R record:
    If torrent.is_freeleech=true OR global_freeleech=true:
      Do not create H&R record at all

BATCH 8 COMPLETE WHEN:
  ✓ H&R created when torrent download completes
  ✓ H&R resolved when user seeds >= grace period
  ✓ H&R expired when deadline passes without seeding
  ✓ Warning issued at threshold
  ✓ Freeleech torrents do not generate H&Rs
  ✓ Staff can pardon H&Rs
  ✓ H&R list shows on user profile

═══════════════════════════════════════════════════════
BATCH 9 — SUBTITLES
═══════════════════════════════════════════════════════

9a. Upload subtitle POST /api/torrents/:id/subtitles:
    Requires authenticate
    Check subtitles_enabled feature flag
    Validate: allowed format, max subtitle_max_size_mb
    Validate: language from supported list
    Save file to /uploads/subtitles/
    Insert subtitle record
    If subtitle_moderation=true: is_approved=false
    Else: is_approved=true
    If approved: award flux_per_subtitle to uploader

9b. List subtitles GET /api/torrents/:id/subtitles:
    Returns subtitles grouped by language
    Include: format, download_count, vote sum,
             source badge, machine_translated flag

9c. Download subtitle GET /api/subtitles/:id/download:
    Requires authenticate
    Increment download_count
    Serve file from disk

9d. Vote POST /api/subtitles/:id/vote:
    body: { vote: 'up' | 'down' }
    Upsert subtitle_votes (one per user per subtitle)

9e. Report POST /api/subtitles/:id/report:
    Stores reason, notifies staff

9f. OpenSubtitles auto-sync
    POST /api/torrents/:id/subtitles/sync:
    Requires authenticate + os_enabled + os_verified
    Check: not synced in last 24h for this torrent
           (track in Redis key 'os-sync:{user_id}:{torrent_id}')
    Get user's OS API key (decrypt from user_preferences)
    Search OS API by imdb_id (fallback to torrent name)
    For each result in os_preferred_langs:
      Skip if subtitle already exists for that language
      Skip if machine_translated and user prefers to skip
      Download subtitle file (uses user's quota)
      Save to /uploads/subtitles/
      Insert subtitle (source: opensubtitles_sync,
                       is_approved: true,
                       synced_by: user_id)
    Award 5 FLX per synced subtitle to user
    Set Redis key with 24h TTL to prevent re-sync

9g. Auto-sync on page load:
    If user has os_auto_sync=true:
    Call sync endpoint silently on torrent detail page load
    Show quota remaining in subtitle section

9h. Frontend subtitle section on torrent detail:
    List by language with flags
    Source badge: [OS] [👤] [🤖]
    Download count + vote stars
    [Download] button per subtitle
    [Upload Subtitle] button
    [🔄 Sync from OpenSubtitles] button (if OS connected)
    Quota remaining display

BATCH 9 COMPLETE WHEN:
  ✓ Can upload .srt subtitle to a torrent
  ✓ Subtitle appears in torrent detail
  ✓ Download works
  ✓ Voting works
  ✓ OS sync works with valid API key
  ✓ 24h sync cooldown enforced
  ✓ Source badges display correctly

═══════════════════════════════════════════════════════
BATCH 10 — STAFF & ADMIN PANELS
═══════════════════════════════════════════════════════

10a. Staff dashboard /[locale]/staff:
     Summary cards:
       Torrents awaiting approval
       Open helpdesk tickets
       Active H&Rs
       Recent reports
       Users registered today
       Online users (from Redis)

10b. Torrent approval queue /[locale]/staff/torrents:
     GET /api/staff/torrents/pending
     List unapproved torrents with uploader, size, date
     POST /api/staff/torrents/:id/approve:
       Set is_approved=true, approved_by, approved_at
       Award flux_per_upload to uploader
       Queue shoutbox announce
       Send notification to uploader
     POST /api/staff/torrents/:id/reject:
       Delete torrent record + files
       Send notification with reason to uploader
     POST /api/staff/torrents/:id/freeleech:
       Toggle is_freeleech on torrent

10c. User management /[locale]/staff/users:
     GET /api/staff/users?q=&group=&page=
     Full user search by username/email
     View user detail: stats, warnings, H&Rs, uploads
     POST /api/staff/users/:id/warn:
       type, reason, expires_at
       Insert user_warning
       Send notification + email
       Log to audit_logs
     POST /api/staff/users/:id/ban:
       type, reason, duration
       Set is_banned=true
       Invalidate all refresh tokens
       Log to audit_logs
     POST /api/staff/users/:id/unban:
       Clear is_banned, clear ban_reason
       Log to audit_logs
     POST /api/staff/users/:id/shoutbox-ban:
       Insert user_warning type='shoutbox_ban'
     GET  /api/staff/users/:id/history:
       Previous usernames, all warnings, ban history
     POST /api/staff/users/:id/change-group:
       Update users.group_id
       Log to audit_logs

10d. Helpdesk /[locale]/staff/helpdesk:
     GET  /api/staff/helpdesk/tickets?status=&priority=
     GET  /api/staff/helpdesk/tickets/:id
     POST /api/staff/helpdesk/tickets/:id/reply
     POST /api/staff/helpdesk/tickets/:id/status

10e. Reports /[locale]/staff/reports:
     GET  /api/staff/reports?status=pending
     POST /api/staff/reports/:id/resolve
     POST /api/staff/reports/:id/dismiss

10f. DMCA /[locale]/staff/dmca:
     Public page: POST /api/dmca (submit notice)
     Staff page:  GET /api/staff/dmca
                  POST /api/staff/dmca/:id/action
                    — removes torrent + notifies uploader
                  POST /api/staff/dmca/:id/dismiss

10g. H&R management /[locale]/staff/hnr:
     GET  /api/staff/hnr?status=active
     POST /api/staff/hnr/:id/pardon

10h. Audit log /[locale]/staff/logs:
     GET /api/staff/logs?page=
     Filterable by user, action, date range

10i. Admin settings /[locale]/admin/settings:
     Requires admin group
     Display all site_settings grouped by category
     Each setting: label, current value, input type
     PUT /api/admin/settings — update any setting
     Changes logged to audit_logs

10j. Admin: Flux store management:
     GET/POST/PUT/DELETE /api/admin/flux-store
     Manage flux_store_items

10k. Admin: Custom pages management:
     GET/POST/PUT/DELETE /api/admin/pages
     Markdown editor for page body

10l. Admin: Category + Tag management:
     Full CRUD for categories and tags

10m. Admin: Client blacklist management:
     GET/POST/DELETE /api/admin/clients
     Manage banned_clients table

10n. Admin: IP ban management:
     GET/POST/DELETE /api/admin/ip-bans
     Manage ip_bans table

BATCH 10 COMPLETE WHEN:
  ✓ Staff can approve/reject torrents
  ✓ Shoutbox announces on approval
  ✓ User search + warning + ban works
  ✓ Ban invalidates user sessions
  ✓ Helpdesk tickets open and reply works
  ✓ DMCA form submits and staff can action
  ✓ All admin settings save and take effect immediately
  ✓ Audit log records all staff actions

═══════════════════════════════════════════════════════
BATCH 11 — API LAYER (Torznab + RSS + REST)
═══════════════════════════════════════════════════════

11a. Torznab endpoint GET /api/torznab:
     Requires: ?apikey=USER_API_KEY
     Check api_enabled feature flag
     Check user.api_enabled=true

     t=caps → return capabilities XML:
       <caps>
         <server title="NGTT"/>
         <limits max="100" default="50"/>
         <searching>
           <search available="yes"
             supportedParams="q,cat,limit,offset"/>
           <movie-search available="yes"
             supportedParams="q,imdbid,tmdbid,cat"/>
           <tv-search available="yes"
             supportedParams="q,season,ep,cat"/>
           <music-search available="yes"
             supportedParams="q,artist,album,cat"/>
         </searching>
         <categories>
           [map NGTT categories to Newznab standard IDs]
           Movies=2000, TV=5000, Music=3000,
           Games=4000, Books=7000, Other=8000
         </categories>
       </caps>

     t=search,movie-search,tv-search,music-search →
       Build torrent query from params
       Return RSS 2.0 XML with torznab: namespace
       Each item includes:
         title, guid, pubDate, size, link, enclosure
         torznab:attr name="seeders"
         torznab:attr name="leechers"
         torznab:attr name="infohash"
         torznab:attr name="downloadvolumefactor"
           value="0" if freeleech, "1" otherwise
         torznab:attr name="uploadvolumefactor" value="1"
         torznab:attr name="category" (Newznab ID)
         torznab:attr name="imdbid" (if available)

11b. autobrr JSON feed GET /api/torrents/latest:
     Requires: ?api_key=USER_API_KEY
     Check api_enabled
     Returns last 50 approved torrents as JSON array:
       id, name, info_hash, size, category,
       seeders (from Redis), leechers (from Redis),
       is_freeleech, imdb_id, tmdb_id,
       download_url (with passkey), details_url,
       uploaded_at

11c. RSS feed GET /rss/:rss_key:
     Check rss_enabled feature flag
     Find user by rss_key
     Optional filter params: category, freeleech
     Return RSS 2.0 XML
     Each item: title, link (torrent detail),
       enclosure (download .torrent), description,
       pubDate, category

11d. General REST API endpoints:
     GET /api/v1/torrents          — browse
     GET /api/v1/torrents/:id      — detail
     GET /api/v1/torrent/:id/download — .torrent file
     GET /api/v1/user/me           — my profile
     GET /api/v1/user/me/hnr       — my H&Rs
     GET /api/v1/user/me/flux      — flux balance
     GET /api/v1/user/me/snatches  — download history
     GET /api/v1/requests          — request board
     POST /api/v1/requests         — create request

     All require: Authorization: Bearer {api_key}
     OR: ?api_key=USER_API_KEY

BATCH 11 COMPLETE WHEN:
  ✓ Prowlarr can connect and search via Torznab
  ✓ autobrr can poll /api/torrents/latest
  ✓ RSS feed validates as valid RSS 2.0
  ✓ Download via API serves .torrent with passkey
  ✓ Freeleech torrents show downloadvolumefactor=0

═══════════════════════════════════════════════════════
BATCH 12 — TORRENT REQUESTS & INACTIVITY
═══════════════════════════════════════════════════════

12a. Torrent requests CRUD:
     GET  /api/requests?page=&category=&filled=
     GET  /api/requests/:id
     POST /api/requests (create, Zod validate)
     POST /api/requests/:id/fill:
       body: { torrent_id }
       Mark request as filled
       Transfer bounty_flux from requester to filler
       Send notification to requester
     GET  /api/requests/my — my requests

12b. Reseed requests:
     POST /api/torrents/:id/reseed:
       Insert reseed_requests (upsert — one per user)
       If uploader still has account: send notification
       Show reseed request count on torrent detail

12c. Inactivity pruning cron:
     /backend/src/jobs/prune-users.ts (daily at 3am)
     Exempt groups from prune_exempt_classes setting
     Users with last_seen_at < NOW - inactivity_warn_days:
       Send warning email if not already sent
       Set a flag in user_preferences (add column
       inactivity_warned_at)
     Users with last_seen_at < NOW - inactivity_prune_days:
       Set is_banned=true with ban_reason='Inactive'
       (soft disable — not hard delete)
     Users with last_seen_at < NOW - inactivity_delete_days
       AND is_banned=true AND ban_reason='Inactive':
       Delete user record (cascade to preferences)
       Anonymize their torrent uploads (set uploader_id=NULL)

12d. Frontend:
     /[locale]/requests       — request board
     /[locale]/requests/new   — create request form

BATCH 12 COMPLETE WHEN:
  ✓ Can create torrent request with flux bounty
  ✓ Can fill request with existing torrent
  ✓ Flux transfers on fill
  ✓ Reseed request notifies uploader
  ✓ Inactivity cron sends warning emails
  ✓ Inactive users disabled after prune_days

═══════════════════════════════════════════════════════
BATCH 13 — I18N + THEMES POLISH
═══════════════════════════════════════════════════════

13a. Complete all 6 translation files with full key coverage:
     /frontend/messages/en.json      (source of truth)
     /frontend/messages/ms-MY.json   (Malay)
     /frontend/messages/zh-CN.json   (Chinese Simplified)
     /frontend/messages/es.json      (Spanish)
     /frontend/messages/pt-BR.json   (Portuguese Brazil)
     /frontend/messages/ar.json      (Arabic)

     All keys from: nav, browse, torrent, user, auth,
     flux, hnr, forum, shoutbox, staff, common,
     settings, requests, subtitles, helpdesk

13b. RTL layout for Arabic:
     root layout: dir={locale==='ar' ? 'rtl' : 'ltr'}
     Use Tailwind rtl: variant for spacing/layout
     Test all pages render correctly in RTL

13c. Language switcher in navbar:
     Dropdown with flag + language name
     Flag emoji: 🇬🇧 🇲🇾 🇨🇳 🇪🇸 🇧🇷 🇸🇦
     On change: update user.locale via API,
     set NEXT_LOCALE cookie, navigate to new locale path

13d. Theme switcher in settings + navbar quick toggle:
     Show all 7 theme previews as colour swatches
     Apply [data-theme] instantly on selection
     Persist to user.theme via API

13e. Verify all 7 themes across all pages:
     void, pulse, cipher, nebula, ember, lumen, sand
     Check: text readable, borders visible, accents pop,
     forms usable, tables scannable

BATCH 13 COMPLETE WHEN:
  ✓ All 6 languages display correctly on all pages
  ✓ Arabic RTL renders all pages correctly
  ✓ Language switch persists across sessions
  ✓ All 7 themes render correctly on every page
  ✓ Theme switch is instant (no flash)

═══════════════════════════════════════════════════════
BATCH 14 — BACKGROUND JOBS & CRON
═══════════════════════════════════════════════════════

14a. Ensure all BullMQ job handlers are complete:
     'write-stats'      → /backend/src/jobs/write-stats.ts
     'hnr-update'       → /backend/src/jobs/hnr-update.ts
     'flux-earn'        → hourly flux for seeders
     'send-email'       → /backend/src/jobs/send-email.ts
     'send-notif'       → /backend/src/jobs/send-notif.ts
     'parse-mediainfo'  → /backend/src/jobs/parse-mediainfo.ts
     'shoutbox-archive' → /backend/src/jobs/shoutbox-archive.ts
     'welcome-pm'       → /backend/src/jobs/welcome-pm.ts
     'flag-cheat'       → /backend/src/jobs/flag-cheat.ts

14b. Standalone cron scripts (called by crontab):
     flux-earn.ts   → hourly flux for all active seeders
     hnr-check.ts   → check deadlines, expire H&Rs
     prune-users.ts → inactivity warnings + disable
     birthdays.ts   → award birthday flux + shoutbox msg
     peer-cleanup.ts → log peer counts (Redis handles TTL)

14c. Email templates (HTML):
     /backend/src/templates/emails/
     welcome.{locale}.html         — welcome on register
     verify-email.{locale}.html    — verify email
     password-reset.{locale}.html  — reset link
     hnr-warning.{locale}.html     — H&R warning
     ban-notice.{locale}.html      — account banned
     inactivity-warning.{locale}.html

     Locales: en, ms-MY (minimum)
     Fallback to en for other locales

14d. Welcome PM job:
     When welcome_pm_enabled=true:
     On new registration:
       Create message from system/admin user to new user
       Subject: welcome_pm_subject setting
       Body: welcome_pm_body setting
       (Markdown rendered)

BATCH 14 COMPLETE WHEN:
  ✓ All BullMQ job handlers complete without errors
  ✓ Hourly flux earn runs correctly
  ✓ H&R check cron expires overdue H&Rs
  ✓ Birthday cron awards flux and shouts
  ✓ Welcome PM sends on registration
  ✓ All email templates render correctly

═══════════════════════════════════════════════════════
BATCH 15 — FINAL POLISH & DEPLOYMENT
═══════════════════════════════════════════════════════

15a. Homepage /[locale]:
     Site stats: total torrents, users, seeders,
     total upload/download traffic
     Latest news (3 items)
     Newest torrents (10 items)
     Today's birthdays (if any)
     Login prompt if not authenticated

15b. Ensure Nginx config is complete and correct
     SSL configured via Let's Encrypt certbot
     Static files served by Nginx directly
     Announce endpoint bypasses buffering

15c. PM2 ecosystem.config.js complete:
     Frontend cluster (2 instances)
     Backend cluster (2 instances)
     Worker fork (1 instance)

15d. Crontab /etc/cron.d/ngtt complete:
     All 5 cron jobs with correct schedules
     Certbot renewal twice daily

15e. README.md:
     Server requirements
     Installation steps
     Environment variables reference
     First-run checklist
     How to add first admin user
     Cron job setup

15f. Security final check:
     All routes requiring auth have authenticate middleware
     All staff routes have requireStaff middleware
     All admin routes have requireAdmin middleware
     All feature-flagged routes have requireFeature
     Rate limiting on auth and announce routes
     Zod validation on all POST/PUT endpoints
     No raw SQL string concatenation anywhere
     AES encryption on all stored API keys
     bcrypt on all passwords
     JWT with short expiry + refresh rotation

15g. Performance final check:
     MySQL: all foreign keys indexed
     MySQL: all WHERE clause columns indexed
     Redis: peer storage working with TTL
     BullMQ: jobs processing from queues
     Nginx: static files not hitting Node.js
     No synchronous operations on announce path

15h. Test end-to-end:
     Register user
     Verify email
     Login
     Upload torrent
     Staff approves — shoutbox announces
     Download .torrent — passkey in announce URL
     Torrent client announces — peer appears in Redis
     Ratio updates after announce stats job
     H&R created on download complete
     H&R resolved after seeding grace period
     Buy freeleech token with Flux
     Download with personal freeleech — ratio not counted
     Subtitle upload + OpenSubtitles sync
     Forum post + notification to subscriber
     Shoutbox real-time for two connected users
     RSS feed validates
     Torznab caps returns correct XML
     All 7 themes render without layout breaks
     Arabic RTL renders correctly
     All 6 languages switch correctly

BATCH 15 COMPLETE = PROJECT COMPLETE ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL NOTES FOR CLAUDE CODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Build in strict batch order. No exceptions.
2. Confirm completion of each batch before proceeding.
3. Every file under 200 lines. Split if needed.
4. Raw mysql2 queries only. No ORM.
5. Zod on every request body. No exceptions.
6. Never await slow operations in HTTP response path.
7. Two BullMQ queues only: stats and jobs.
8. Flat code. Early returns. No deep nesting.
9. All 7 themes defined in one CSS file.
10. All i18n keys in 6 JSON files.
11. Announce handler is sacred — keep it lean and fast.
12. When uncertain: do less, do it well, move on.

Currency throughout codebase = flux / FLX
Never use "bon", "bonus", "points" or "BON" anywhere.

Site name throughout = NGTT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF MASTER PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
