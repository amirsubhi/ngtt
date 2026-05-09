#!/usr/bin/env node
// Copyright (c) 2026 amirsubhi — MIT License
'use strict';

/**
 * NGTT — First-run installation wizard.
 *
 * Usage (from backend/):
 *   npm install
 *   node install.js
 *
 * Self-deletes on success and writes .installed as a lock file.
 * Delete .installed to re-run (e.g. on a fresh database).
 */

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const R = '\x1b[0m';
const B = '\x1b[1m';
const green  = s => `\x1b[32m${s}${R}`;
const red    = s => `\x1b[31m${s}${R}`;
const yellow = s => `\x1b[33m${s}${R}`;
const cyan   = s => `\x1b[36m${s}${R}`;
const dim    = s => `\x1b[2m${s}${R}`;
const bold   = s => `${B}${s}${R}`;

const ok   = () => `  ${green('✓')}`;
const fail = () => `  ${red('✗')}`;
const info = () => `  ${cyan('→')}`;

// ── Lock file guard ───────────────────────────────────────────────────────────

const LOCK = path.join(__dirname, '.installed');

if (fs.existsSync(LOCK)) {
  console.log(`\n${yellow('⚠  NGTT is already installed.')}`);
  console.log(`${dim(`Delete ${LOCK} to re-run the installer.`)}\n`);
  process.exit(0);
}

// ── Banner ────────────────────────────────────────────────────────────────────

console.log(`
${cyan('┌──────────────────────────────────────────┐')}
${cyan('│')}  ${bold('⚡ NGTT — Installation Wizard')}             ${cyan('│')}
${cyan('│')}  ${dim('Next-Gen Torrent Tracker')}                   ${cyan('│')}
${cyan('└──────────────────────────────────────────┘')}
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(label) { console.log(`${ok()} ${label}`); }
function bad(label, hint = '') {
  console.log(`${fail()} ${red(label)}`);
  if (hint) console.log(`     ${dim(hint)}`);
}
function note(label) { console.log(`${info()} ${dim(label)}`); }

function exitWithErrors() {
  console.log(`\n${red('Fix the errors above, then re-run the installer.')}\n`);
  process.exit(1);
}

function prompt(question) {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(question, a => { rl.close(); resolve(a.trim()); }));
}

function promptPassword(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    function handler(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(chars.join(''));
      } else if (ch === '') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (ch === '') {
        if (chars.length) { chars.pop(); process.stdout.write('\b \b'); }
      } else {
        chars.push(ch);
        process.stdout.write('*');
      }
    }
    process.stdin.on('data', handler);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {

  // ── [ 1/6 ] System requirements ─────────────────────────────────────────

  console.log(`${bold('[ 1/6 ]  System Requirements')}\n`);

  let errors = 0;

  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log(`${fail()} ${red('node_modules not found')}`);
    console.log(`     ${dim('Run:  npm install')}`);
    console.log(`\n${red('Install dependencies first, then re-run the installer.')}\n`);
    process.exit(1);
  }
  pass('node_modules present');

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor >= 20) {
    pass(`Node.js ${process.versions.node}`);
  } else {
    bad(`Node.js ${process.versions.node}`, 'Node.js 20 LTS or newer is required');
    errors++;
  }

  if (errors) exitWithErrors();

  // ── [ 2/6 ] Environment variables ───────────────────────────────────────

  console.log(`\n${bold('[ 2/6 ]  Environment Variables')}\n`);

  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    bad('.env file not found', 'Copy .env.example to .env and fill in the values');
    exitWithErrors();
  }
  require('dotenv').config({ path: envPath });
  pass('.env loaded');

  const REQUIRED = [
    'DATABASE_URL', 'REDIS_URL',
    'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
    'FRONTEND_URL',
    'UPLOAD_PATH', 'UPLOAD_URL',
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'ENCRYPTION_KEY',
  ];

  errors = 0;
  const missing = REQUIRED.filter(k => !process.env[k]);
  for (const k of missing) { bad(`${k} is not set`); errors++; }
  if (!missing.length) pass('All required env vars present');

  const encKey = process.env.ENCRYPTION_KEY ?? '';
  if (encKey && !/^[0-9a-f]{64}$/i.test(encKey)) {
    bad('ENCRYPTION_KEY must be exactly 64 hex characters', 'Generate with:  openssl rand -hex 32');
    errors++;
  }

  if (errors) exitWithErrors();

  // ── [ 3/6 ] MySQL ────────────────────────────────────────────────────────

  console.log(`\n${bold('[ 3/6 ]  MySQL Connection')}\n`);

  const mysql = require('mysql2/promise');
  let conn;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL);
    await conn.query('SELECT 1');
    pass('MySQL connected');
  } catch (e) {
    bad('MySQL connection failed', e.message);
    exitWithErrors();
  }

  // ── [ 4/6 ] Redis ────────────────────────────────────────────────────────

  console.log(`\n${bold('[ 4/6 ]  Redis Connection')}\n`);

  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    await redis.ping();
    pass('Redis connected');
  } catch (e) {
    bad('Redis connection failed', e.message);
    process.exit(1);
  } finally {
    redis.disconnect();
  }

  // ── [ 5/6 ] Database setup ───────────────────────────────────────────────

  console.log(`\n${bold('[ 5/6 ]  Database Setup')}\n`);

  note('Applying migrations…');
  const mg = spawnSync(
    path.join(__dirname, 'node_modules/.bin/tsx'),
    ['src/lib/migrate.ts'],
    {
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (mg.status === 0) {
    pass('Migrations applied');
  } else {
    const combined = (mg.stdout?.toString() ?? '') + (mg.stderr?.toString() ?? '');
    const lastLine = combined.trim().split('\n').pop() ?? '';
    bad('Migration failed', lastLine);
    if (combined.trim()) console.log(`\n${dim(combined.trim())}\n`);
    process.exit(1);
  }

  const uploadPath = process.env.UPLOAD_PATH ?? '';
  if (uploadPath && !fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    pass(`Upload directory created  ${dim(`(${uploadPath})`)}`);
  } else {
    pass('Upload directory present');
  }

  // ── [ 6/6 ] Administrator account ───────────────────────────────────────

  console.log(`\n${bold('[ 6/6 ]  Administrator Account')}\n`);

  const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM users');

  if (Number(cnt) > 0) {
    note(`${cnt} user(s) already exist — skipping admin creation`);
  } else {
    console.log(`  ${dim('Create the first administrator account.\n')}`);

    let username;
    while (true) {
      username = await prompt('  Username : ');
      if (/^[a-zA-Z0-9_]{3,50}$/.test(username)) break;
      console.log(`  ${yellow('3–50 characters, letters / numbers / underscore only.')}`);
    }

    let email;
    while (true) {
      email = await prompt('  Email    : ');
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) break;
      console.log(`  ${yellow('Enter a valid email address.')}`);
    }

    let password;
    while (true) {
      password = await promptPassword('  Password : ');
      if (password.length >= 12) break;
      console.log(`  ${yellow('Password must be at least 12 characters.')}`);
    }
    const confirm = await promptPassword('  Confirm  : ');
    if (password !== confirm) {
      console.log(`\n  ${red('Passwords do not match.')}\n`);
      process.exit(1);
    }

    const crypto = require('crypto');
    const bcrypt = require('bcrypt');

    const passwordHash = await bcrypt.hash(password, 12);
    const passkey = crypto.randomBytes(16).toString('hex'); // 32 chars — matches VARCHAR(32)
    const rssKey  = crypto.randomBytes(16).toString('hex'); // 32 chars — matches VARCHAR(32)

    const [[adminGroup]] = await conn.query(
      "SELECT id FROM user_groups WHERE slug = 'admin' LIMIT 1",
    );
    if (!adminGroup) {
      console.log(`\n  ${red("Admin group not found — did the migrations above apply cleanly?")}\n`);
      process.exit(1);
    }

    const [ins] = await conn.execute(
      `INSERT INTO users (username, email, password_hash, passkey, rss_key, group_id, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [username, email, passwordHash, passkey, rssKey, adminGroup.id],
    );

    await conn.execute(
      'INSERT INTO user_preferences (user_id) VALUES (?)',
      [ins.insertId],
    );

    console.log();
    pass(`Admin account created  ${dim('→')}  ${bold(username)}`);
  }

  await conn.end();

  // ── Write lock file ──────────────────────────────────────────────────────

  fs.writeFileSync(LOCK, `installed: ${new Date().toISOString()}\n`);

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log(`
${green('┌──────────────────────────────────────────┐')}
${green('│')}  ${bold('✓  Installation complete!')}                 ${green('│')}
${green('└──────────────────────────────────────────┘')}

  ${bold('Next steps:')}

  ${dim('Development')}
  ${cyan('npm run dev')}                              ${dim('(backend/)')}
  ${cyan('npm run dev')}                              ${dim('(frontend/)')}

  ${dim('Production')}
  ${cyan('npm run build')}                            ${dim('(backend/ and frontend/)')}
  ${cyan('pm2 start ecosystem.config.js')}           ${dim('(project root)')}
`);

  fs.unlinkSync(__filename); // self-delete

})().catch(err => {
  console.error(`\n  ${red('Unexpected error:')} ${err.message}\n`);
  process.exit(1);
});
