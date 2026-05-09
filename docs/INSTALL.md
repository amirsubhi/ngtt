# NGTT — Installation Guide

## Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB (OS + app) | SSD, separate volume for uploads |
| Node.js | 20 LTS | 20 LTS |
| MySQL | 8.0 | 8.0 |
| Redis | 7.0 | 7.0 |
| Nginx | 1.18+ | latest stable |
| PM2 | 5.x | latest |

---

## Environment Variables

Create `/var/www/ngtt/backend/.env` (never commit this file):

```env
# App
NODE_ENV=production
FRONTEND_URL=https://ngtt.com

# Database — mysql2 connection string
DATABASE_URL=mysql://ngtt:PASSWORD@127.0.0.1:3306/ngtt

# Redis
REDIS_URL=redis://127.0.0.1:6379

# JWT — generate with: openssl rand -hex 64
JWT_ACCESS_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<64-char-hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# File uploads
UPLOAD_PATH=/var/www/ngtt/uploads
UPLOAD_URL=https://ngtt.com/uploads

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@ngtt.com
SMTP_PASS=<smtp-password>
SMTP_FROM="NGTT <noreply@ngtt.com>"

# Encryption key for stored API keys — generate with: openssl rand -hex 32
ENCRYPTION_KEY=<32-char-hex>

# Optional — leave blank to disable
TURNSTILE_SECRET_KEY=
TMDB_API_KEY=
MUSICBRAINZ_UA=NGTT/1.0
ANNOUNCE_INTERVAL=1800
MIN_ANNOUNCE_INTERVAL=900
```

---

## Installation Steps

### 1. Install system dependencies

```bash
# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL 8
sudo apt-get install -y mysql-server

# Redis 7
sudo apt-get install -y redis-server

# Nginx + Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# PM2
sudo npm install -g pm2
```

### 2. Create database and user

```sql
CREATE DATABASE ngtt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ngtt'@'127.0.0.1' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON ngtt.* TO 'ngtt'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 3. Deploy application files

```bash
# Create directories
sudo mkdir -p /var/www/ngtt/{backend,frontend,uploads}
sudo mkdir -p /var/log/ngtt

# Clone repository
git clone https://github.com/your-org/ngtt /tmp/ngtt

# Copy files
sudo cp -r /tmp/ngtt/backend /var/www/ngtt/backend
sudo cp -r /tmp/ngtt/frontend /var/www/ngtt/frontend
sudo cp /tmp/ngtt/ecosystem.config.js /var/www/ngtt/ecosystem.config.js

# Set permissions
sudo chown -R www-data:www-data /var/www/ngtt
sudo chown -R www-data:www-data /var/log/ngtt
```

### 4. Build backend

```bash
cd /var/www/ngtt/backend
sudo -u www-data npm install --omit=dev
sudo -u www-data npm run build
```

### 5. Run database migrations

```bash
cd /var/www/ngtt/backend
sudo -u www-data npm run migrate
```

Migrations are idempotent — safe to re-run. Never apply SQL files manually after the first deploy.

### 6. Build frontend

```bash
cd /var/www/ngtt/frontend
sudo -u www-data npm install --omit=dev
sudo -u www-data npm run build
```

### 7. Configure Nginx

```bash
# Copy the provided config
sudo cp /tmp/ngtt/nginx.conf /etc/nginx/sites-available/ngtt
sudo ln -s /etc/nginx/sites-available/ngtt /etc/nginx/sites-enabled/ngtt
sudo rm -f /etc/nginx/sites-enabled/default

# Obtain SSL certificate (replace with your domain)
sudo certbot --nginx -d ngtt.com -d www.ngtt.com

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Start PM2

```bash
cd /var/www/ngtt
sudo -u www-data pm2 start ecosystem.config.js
sudo -u www-data pm2 save

# Enable PM2 on boot
sudo pm2 startup systemd -u www-data --hp /home/www-data
```

### 9. Install cron jobs

```bash
sudo cp /tmp/ngtt/deploy/cron.d/ngtt /etc/cron.d/ngtt
sudo chmod 644 /etc/cron.d/ngtt
```

---

## First-Run Checklist

After the first deploy, complete these steps in order:

- [ ] Visit `https://ngtt.com/api/health` — expect `{"status":"ok"}`
- [ ] Register the first account via the web UI
- [ ] Promote that account to Admin (see below)
- [ ] Log in and open **Admin → Site Settings** — configure site name, invite-only mode, announce interval
- [ ] Send a test email from **Admin → Email Test**
- [ ] Upload one test torrent and verify announce works with a real torrent client
- [ ] Confirm `/var/log/ngtt/` logs are being written by PM2 and cron

---

## Adding the First Admin User

After registering, promote via MySQL:

```sql
-- Find the user group for Admin (created by migrations)
SELECT id, name FROM user_groups WHERE name = 'Admin';

-- Promote user (replace 1 with the correct group id)
UPDATE users SET group_id = 1 WHERE username = 'your_username';
```

Or use the provided CLI script if available:
```bash
cd /var/www/ngtt/backend
node dist/scripts/make-admin.js your_username
```

---

## Cron Job Schedule

Cron jobs are installed from `deploy/cron.d/ngtt`. The schedule:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `flux-earn.js` | Every hour | Award passive Flux to eligible users |
| `hnr-check.js` | :30 every hour | Expire overdue H&Rs, ban repeat offenders |
| `peer-cleanup.js` | Every 15 min | Remove stale peers from Redis |
| `birthdays.js` | Daily 00:00 | Award birthday Flux + shoutbox announcement |
| `prune-users.js` | Daily 03:00 | Warn/prune inactive accounts |
| certbot renew | 00:00 + 12:00 | Renew Let's Encrypt certificate |

---

## Upgrades

```bash
# Pull new code
git -C /tmp/ngtt pull

# Rebuild
cd /var/www/ngtt/backend && sudo -u www-data npm run build
cd /var/www/ngtt/frontend && sudo -u www-data npm run build

# Run any new migrations
cd /var/www/ngtt/backend && sudo -u www-data npm run migrate

# Zero-downtime reload
sudo -u www-data pm2 reload all
```

---

## Log Locations

| Log | Path |
|-----|------|
| Frontend stdout | `/var/log/ngtt/frontend-out.log` |
| Frontend stderr | `/var/log/ngtt/frontend-error.log` |
| Backend stdout | `/var/log/ngtt/backend-out.log` |
| Backend stderr | `/var/log/ngtt/backend-error.log` |
| Worker stdout | `/var/log/ngtt/worker-out.log` |
| Worker stderr | `/var/log/ngtt/worker-error.log` |
| Cron jobs | `/var/log/ngtt/cron.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx error | `/var/log/nginx/error.log` |
