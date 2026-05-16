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
const os   = require('os');
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
      } else if (ch === '') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (ch === '') {
        if (chars.length) { chars.pop(); process.stdout.write('\b \b'); }
      } else {
        chars.push(ch);
        process.stdout.write('*');
      }
    }
    process.stdin.on('data', handler);
  });
}

// Run a binary and capture both stdout+stderr (handles tools like nginx -v that write to stderr)
function runCheck(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { stdio: 'pipe', timeout: 5000, ...opts });
  if (r.error?.code === 'ENOENT') return null; // binary not found
  const out = `${r.stdout?.toString() ?? ''}${r.stderr?.toString() ?? ''}`.trim();
  return out || null;
}

// Run an install command expressed as a string of whitespace-separated tokens.
// All command strings in DEPS are hardcoded — no user input reaches here.
function runInstallCmd(cmdStr) {
  const [bin, ...args] = cmdStr.trim().split(/\s+/);
  const r = spawnSync(bin, args, { stdio: 'inherit', timeout: 300_000 });
  if (r.error || r.status !== 0) {
    throw new Error(r.error ? r.error.message : `exit code ${r.status}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {

  // ── [ 1/8 ] System Dependencies ─────────────────────────────────────────

  console.log(`${bold('[ 1/8 ]  System Dependencies')}\n`);

  // Detect whether we are root so we can skip sudo prefix when not needed
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const su = cmd => (isRoot ? cmd : `sudo ${cmd}`);

  function detectPkgManager() {
    if (os.platform() === 'darwin') {
      const r = spawnSync('which', ['brew'], { stdio: 'pipe' });
      return (!r.error && r.status === 0) ? 'brew' : null;
    }
    for (const [bin, name] of [['apt-get', 'apt'], ['dnf', 'dnf'], ['yum', 'yum']]) {
      const r = spawnSync('which', [bin], { stdio: 'pipe' });
      if (!r.error && r.status === 0) return name;
    }
    return null;
  }

  const pkgMgr = detectPkgManager();

  if (pkgMgr) {
    note(`Package manager: ${pkgMgr}`);
  } else {
    note('No supported package manager detected (apt/dnf/yum/brew) — manual installation required if anything is missing');
  }
  console.log();

  // Each dep: name, how to check version, minimum major version, install command lists per PM
  const DEPS = [
    {
      name:        'MySQL / MariaDB',
      bin:         'mysql',
      args:        ['--version'],
      minMajor:    8,  // MySQL 8+ or MariaDB 10.4+ (major 10 > 8, passes same check)
      versionHint: 'MySQL 8+ or MariaDB 10.4+ required',
      installHint: 'mysql-server installs MySQL 8; mariadb-server installs MariaDB — both work',
      // Parse the distrib version (e.g. 10.6.16 from "10.6.16-MariaDB", or 8.0.36 from MySQL)
      parse: out => { const m = out.match(/\b(\d+)\.\d+\.\d+/); return m ? parseInt(m[1], 10) : null; },
      // Show "MariaDB X.Y.Z" or "MySQL X.Y.Z" instead of the raw version string
      label: out => {
        const mdb = out.match(/\b(\d+\.\d+\.\d+)-?MariaDB\b/i);
        if (mdb) return `MariaDB ${mdb[1]}`;
        const mysql = out.match(/\b(\d+\.\d+\.\d+)\b/);
        return mysql ? `MySQL ${mysql[1]}` : out.split('\n')[0].slice(0, 60);
      },
      install: {
        apt:  [su('apt-get install -y mysql-server'), su('systemctl start mysql'), su('systemctl enable mysql')],
        dnf:  [su('dnf install -y mysql-server'), su('systemctl start mysqld'), su('systemctl enable mysqld')],
        yum:  [su('yum install -y mysql-server'), su('systemctl start mysqld'), su('systemctl enable mysqld')],
        brew: ['brew install mysql', 'brew services start mysql'],
      },
    },
    {
      name:     'Redis 7',
      bin:      'redis-cli',
      args:     ['--version'],
      minMajor: 7,
      parse:    out => { const m = out.match(/\b(\d+)\.\d+/); return m ? parseInt(m[1], 10) : null; },
      install: {
        apt:  [su('apt-get install -y redis-server'), su('systemctl start redis-server'), su('systemctl enable redis-server')],
        dnf:  [su('dnf install -y redis'), su('systemctl start redis'), su('systemctl enable redis')],
        yum:  [su('yum install -y redis'), su('systemctl start redis'), su('systemctl enable redis')],
        brew: ['brew install redis', 'brew services start redis'],
      },
    },
    {
      name:     'Nginx',
      bin:      'nginx',
      args:     ['-v'],
      minMajor: 1,
      parse:    out => (out && out.toLowerCase().includes('nginx') ? 1 : null),
      install: {
        apt:  [su('apt-get install -y nginx'), su('systemctl start nginx'), su('systemctl enable nginx')],
        dnf:  [su('dnf install -y nginx'), su('systemctl start nginx'), su('systemctl enable nginx')],
        yum:  [su('yum install -y nginx'), su('systemctl start nginx'), su('systemctl enable nginx')],
        brew: ['brew install nginx', 'brew services start nginx'],
      },
    },
    {
      name:     'PM2',
      bin:      'pm2',
      args:     ['--version'],
      minMajor: 1,
      parse:    out => { const m = out.match(/^(\d+)\./); return m ? parseInt(m[1], 10) : null; },
      install: {
        npm:  ['npm install -g pm2'],
      },
    },
  ];

  for (const dep of DEPS) {
    const output = runCheck(dep.bin, dep.args);

    if (output === null) {
      bad(`${dep.name} — not found`);

      const installCmds = dep.name === 'PM2'
        ? dep.install.npm
        : (pkgMgr ? dep.install[pkgMgr] ?? [] : []);

      if (!installCmds.length) {
        note(`Install ${dep.name} manually, then re-run this installer`);
        continue;
      }

      if (dep.installHint) note(dep.installHint);
      const ans = await prompt(`     Install ${dep.name}? [y/N] `);
      if (ans.toLowerCase() !== 'y') {
        note(`Skipped — install ${dep.name} before starting the app`);
        continue;
      }

      let succeeded = true;
      for (const cmd of installCmds) {
        note(`Running: ${cmd}`);
        try {
          runInstallCmd(cmd);
        } catch (e) {
          bad(`Command failed: ${cmd}`, e.message);
          succeeded = false;
          break;
        }
      }

      if (succeeded) {
        pass(`${dep.name} installed`);
      } else {
        note(isRoot
          ? 'Review the error above and install manually'
          : 'If this failed with permission errors, re-run with: sudo node install.js');
      }

    } else {
      const major = dep.parse(output);
      const preview = dep.label ? dep.label(output) : output.split('\n')[0].slice(0, 70);

      if (major !== null && major < dep.minMajor) {
        console.log(`  ${yellow('⚠')} ${preview}`);
        console.log(`     ${dim(dep.versionHint ?? `Version ${dep.minMajor}+ recommended`)}`);
      } else {
        pass(preview);
      }
    }
  }

  // ── Firewall ─────────────────────────────────────────────────────────────

  console.log(`\n  ${dim('Firewall')}\n`);

  // Privileged check — ufw/firewalld status requires root
  const suCheck = (bin, args) => isRoot ? runCheck(bin, args) : runCheck('sudo', [bin, ...args]);

  const hasUfw       = runCheck('ufw',          ['version']) !== null;
  const hasFirewalld = runCheck('firewall-cmd',  ['--version']) !== null;

  if (!hasUfw && !hasFirewalld) {
    note('No firewall tool detected (ufw / firewalld) — verify ports 80 and 443 are open manually');
  } else if (hasUfw) {
    const ufwOut = suCheck('ufw', ['status']) ?? '';
    const isActive = /Status:\s*active/i.test(ufwOut);

    if (!isActive) {
      console.log(`  ${yellow('⚠')} ufw is inactive`);
      const ans = await prompt('     Enable ufw and open ports 80 / 443? [y/N] ');
      if (ans.toLowerCase() === 'y') {
        try {
          // Allow SSH first to prevent lockout, then web ports, then enable
          for (const cmd of [
            su('ufw allow 22/tcp'),
            su('ufw allow 80/tcp'),
            su('ufw allow 443/tcp'),
            su('ufw --force enable'),
          ]) {
            runInstallCmd(cmd);
          }
          pass('ufw enabled — ports 22, 80, 443 open');
        } catch (e) {
          bad('ufw enable failed', e.message);
          note('Configure firewall manually before going live');
        }
      } else {
        note('Skipped — open ports 80 and 443 before going live');
      }
    } else {
      pass('ufw active');
      for (const { port, label } of [{ port: 80, label: 'port 80 (HTTP)' }, { port: 443, label: 'port 443 (HTTPS)' }]) {
        const open = new RegExp(`^\\s*${port}(/tcp)?\\s`, 'm').test(ufwOut);
        if (!open) {
          bad(`${label} not allowed in ufw`);
          const ans = await prompt(`     Allow ${label}? [y/N] `);
          if (ans.toLowerCase() === 'y') {
            try { runInstallCmd(su(`ufw allow ${port}/tcp`)); pass(`${label} allowed`); }
            catch (e) { bad(`Failed`, e.message); }
          }
        } else {
          pass(`${label} allowed`);
        }
      }
    }
  } else {
    // firewalld
    const fwState = suCheck('firewall-cmd', ['--state']) ?? '';
    const isRunning = fwState.trim() === 'running';

    if (!isRunning) {
      console.log(`  ${yellow('⚠')} firewalld is not running`);
      const ans = await prompt('     Start firewalld and open ports 80 / 443? [y/N] ');
      if (ans.toLowerCase() === 'y') {
        try {
          for (const cmd of [
            su('systemctl start firewalld'),
            su('firewall-cmd --permanent --add-service=http'),
            su('firewall-cmd --permanent --add-service=https'),
            su('firewall-cmd --reload'),
          ]) {
            runInstallCmd(cmd);
          }
          pass('firewalld started — http and https open');
        } catch (e) {
          bad('firewalld setup failed', e.message);
        }
      } else {
        note('Skipped — open ports 80 and 443 before going live');
      }
    } else {
      pass('firewalld running');
      for (const { service, label } of [
        { service: 'http',  label: 'port 80 (HTTP)' },
        { service: 'https', label: 'port 443 (HTTPS)' },
      ]) {
        const check = suCheck('firewall-cmd', [`--query-service=${service}`]) ?? '';
        if (check.trim() !== 'yes') {
          bad(`${label} not in firewalld`);
          const ans = await prompt(`     Allow ${label}? [y/N] `);
          if (ans.toLowerCase() === 'y') {
            try {
              runInstallCmd(su(`firewall-cmd --permanent --add-service=${service}`));
              runInstallCmd(su('firewall-cmd --reload'));
              pass(`${label} allowed`);
            } catch (e) { bad('Failed', e.message); }
          }
        } else {
          pass(`${label} allowed`);
        }
      }
    }
  }

  // ── Services (autostart + running) ───────────────────────────────────────

  console.log(`\n  ${dim('Services')}\n`);

  const hasSystemd = runCheck('systemctl', ['--version']) !== null;

  if (!hasSystemd) {
    note('systemd not detected — ensure MySQL, Redis, and Nginx start automatically for your init system');
    note('PM2: run pm2 startup && pm2 save after adding processes');
  } else {
    const SVC_GROUPS = [
      { candidates: ['mysql', 'mysqld'],       label: 'MySQL' },
      { candidates: ['redis-server', 'redis'], label: 'Redis' },
      { candidates: ['nginx'],                 label: 'Nginx' },
    ];

    for (const grp of SVC_GROUPS) {
      // Probe which unit name systemd knows about
      let svcName = null;
      for (const name of grp.candidates) {
        const r = spawnSync('systemctl', ['cat', name], { stdio: 'pipe' });
        if (r.status === 0) { svcName = name; break; }
      }

      if (!svcName) {
        note(`${grp.label} service not found in systemd — verify installation`);
        continue;
      }

      // Check running
      const activeOut = (runCheck('systemctl', ['is-active', svcName]) ?? '').trim();
      if (activeOut !== 'active') {
        bad(`${grp.label} (${svcName}) is not running`);
        const ans = await prompt(`     Start ${grp.label} now? [y/N] `);
        if (ans.toLowerCase() === 'y') {
          try { runInstallCmd(su(`systemctl start ${svcName}`)); pass(`${grp.label} started`); }
          catch (e) { bad(`Failed to start ${grp.label}`, e.message); }
        }
      } else {
        pass(`${grp.label} running`);
      }

      // Check autostart
      const enabledOut = (runCheck('systemctl', ['is-enabled', svcName]) ?? '').trim();
      if (enabledOut !== 'enabled') {
        const ans = await prompt(`     Enable ${grp.label} autostart on boot? [y/N] `);
        if (ans.toLowerCase() === 'y') {
          try { runInstallCmd(su(`systemctl enable ${svcName}`)); pass(`${grp.label} autostart enabled`); }
          catch (e) { bad(`Failed to enable ${grp.label}`, e.message); }
        } else {
          note(`${grp.label} will not start automatically on boot`);
        }
      } else {
        pass(`${grp.label} autostart enabled`);
      }
    }

    note('PM2: run pm2 startup && pm2 save after adding app processes');
  }

  // ── Timezone ─────────────────────────────────────────────────────────────

  console.log(`\n  ${dim('Timezone')}\n`);

  const hasTimedatectl = runCheck('timedatectl', ['--version']) !== null;

  if (!hasTimedatectl) {
    note('timedatectl not available — set your timezone via your OS settings');
  } else {
    const tzRaw = runCheck('timedatectl', ['show', '--property=Timezone', '--value']) ?? '';
    const currentTz = tzRaw.trim() || 'unknown';
    console.log(`  ${dim('Current timezone:')} ${bold(currentTz)}\n`);

    const changeTz = await prompt('  Change timezone? [y/N] ');
    if (changeTz.toLowerCase() === 'y') {
      note('Examples: Asia/Kuala_Lumpur, America/New_York, Europe/London, UTC');
      note('Full list: timedatectl list-timezones');
      const tz = await prompt('  Timezone: ');
      if (tz.trim()) {
        // Use spawnSync directly so the tz arg is never shell-interpreted
        const r = spawnSync(
          isRoot ? 'timedatectl' : 'sudo',
          isRoot ? ['set-timezone', tz.trim()] : ['timedatectl', 'set-timezone', tz.trim()],
          { stdio: 'inherit', timeout: 10_000 },
        );
        if (r.error || r.status !== 0) {
          bad('Failed to set timezone', r.error?.message ?? `exit code ${r.status}`);
          note('Run manually: sudo timedatectl set-timezone <timezone>');
        } else {
          pass(`Timezone set to ${tz.trim()}`);
        }
      }
    } else {
      pass(`Timezone: ${currentTz}`);
    }
  }

  console.log();

  // ── [ 2/8 ] System requirements ─────────────────────────────────────────

  console.log(`${bold('[ 2/8 ]  System Requirements')}\n`);

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

  // ── [ 3/8 ] Environment variables ───────────────────────────────────────

  console.log(`\n${bold('[ 3/8 ]  Environment Variables')}\n`);

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

  // ── [ 4/8 ] MySQL ────────────────────────────────────────────────────────

  console.log(`\n${bold('[ 4/8 ]  MySQL Connection')}\n`);

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

  // ── [ 5/8 ] Redis ────────────────────────────────────────────────────────

  console.log(`\n${bold('[ 5/8 ]  Redis Connection')}\n`);

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

  // ── [ 6/8 ] Database setup ───────────────────────────────────────────────

  console.log(`\n${bold('[ 6/8 ]  Database Setup')}\n`);

  note('Applying migrations…');
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let applied = 0;
    for (const file of files) {
      const [rows] = await conn.execute('SELECT filename FROM schema_migrations WHERE filename = ?', [file]);
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await conn.execute(stmt);
      }
      await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      applied++;
    }

    pass(`Migrations applied  ${dim(`(${applied} new, ${files.length - applied} already applied)`)}`);
  } catch (e) {
    bad('Migration failed', e.message);
    process.exit(1);
  }

  const uploadPath = process.env.UPLOAD_PATH ?? '';
  if (uploadPath && !fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    pass(`Upload directory created  ${dim(`(${uploadPath})`)}`);
  } else {
    pass('Upload directory present');
  }

  // ── [ 7/8 ] Legal pages ─────────────────────────────────────────────────

  console.log(`\n${bold('[ 7/8 ]  Legal Pages')}\n`);
  console.log(`  ${dim('These details appear in your Terms, DMCA, and Support pages.')}`);
  console.log(`  ${dim('Leave blank to keep [PLACEHOLDER] markers and fill in later.\n')}`);

  const siteName    = await prompt('  Site name        : ');
  const contactEmail = await prompt('  Contact email    : ');
  const dmcaEmail   = await prompt('  DMCA agent email : ');
  const effectiveDate = new Date().toISOString().split('T')[0];

  function fillTemplate(tmpl) {
    return tmpl
      .replace(/\[SITE NAME\]/g, siteName || '[SITE NAME]')
      .replace(/\[CONTACT EMAIL\]/g, contactEmail || '[CONTACT EMAIL]')
      .replace(/\[DMCA AGENT NAME\]/g, 'DMCA Agent')
      .replace(/\[DMCA EMAIL\]/g, dmcaEmail || '[DMCA EMAIL]')
      .replace(/\[DATE\]/g, effectiveDate);
  }

  const termsBody = fillTemplate(`Terms and Conditions

Last updated: [DATE]

1. Acceptance of Terms

By accessing or using [SITE NAME] ("the Site"), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Site. The Site reserves the right to update these terms at any time without prior notice. Continued use of the Site after changes constitutes acceptance of the revised terms.

2. Eligibility and Membership

Access to the Site is by invitation only. You must be at least 18 years of age to register. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You may not share, sell, or transfer your account to any other person.

3. Acceptable Use

You agree not to use the Site to:

  a. Upload, share, or distribute content that infringes any third-party copyright, trademark, patent, trade secret, or other intellectual property right.
  b. Upload, share, or distribute child sexual abuse material (CSAM) or any content that exploits or harms minors. Such content will be immediately reported to the National Center for Missing and Exploited Children (NCMEC) and relevant law enforcement.
  c. Distribute malware, spyware, ransomware, or any malicious software.
  d. Harass, threaten, or abuse other members.
  e. Attempt to gain unauthorized access to any part of the Site or its infrastructure.
  f. Use automated tools to scrape, harvest, or abuse Site resources without prior written consent.

4. Content and Torrents

The Site is a meta-index and tracker. We do not host or transmit the actual content referenced by torrent files. Uploaders are solely responsible for ensuring they have the right to distribute any content they upload. The Site does not verify the legality of user-submitted content.

5. Ratio Requirements

Members are expected to maintain a minimum upload/download ratio as specified in the Site rules. Failure to meet ratio requirements may result in restricted access, account warnings, or termination.

6. Account Termination

The Site reserves the right to suspend or terminate any account, at any time, with or without notice, for conduct that we determine violates these Terms, is harmful to other users, third parties, or the Site, or for any other reason at our sole discretion.

7. Disclaimer of Warranties

THE SITE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SITE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.

8. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY LAW, THE SITE AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SITE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

9. Indemnification

You agree to indemnify and hold harmless the Site and its operators from any claims, damages, liabilities, costs, or expenses (including reasonable attorneys' fees) arising from your use of the Site, your violation of these Terms, or your infringement of any third-party rights.

10. Governing Law

These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the applicable courts.

11. Contact

For general inquiries, contact: [CONTACT EMAIL]`);

  const dmcaBody = fillTemplate(`DMCA Copyright Policy

Last updated: [DATE]

1. Overview

[SITE NAME] ("the Site") respects the intellectual property rights of others and expects users to do the same. In accordance with the Digital Millennium Copyright Act of 1998 ("DMCA"), 17 U.S.C. 512, the Site will respond expeditiously to claims of copyright infringement. The Site functions as a BitTorrent tracker and meta-index and does not host copyrighted content files directly.

2. Designated DMCA Agent

To submit a copyright infringement notice, contact our designated agent:

  DMCA Agent: [DMCA AGENT NAME]
  Email:      [DMCA EMAIL]

3. How to Submit a Takedown Notice (17 U.S.C. 512(c)(3))

To be valid, your written notice must include ALL of the following:

  a. A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.
  b. Identification of the copyrighted work claimed to have been infringed.
  c. Identification of the material on the Site that you claim is infringing, with enough detail for us to locate it (e.g., the full URL of the torrent page).
  d. Your contact information: name, address, telephone number, and email address.
  e. A statement that you have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
  f. A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on behalf of the copyright owner.

Notices that do not satisfy all requirements may be disregarded. False or misleading notices may expose the sender to liability under 17 U.S.C. 512(f).

4. Our Response

Upon receipt of a valid takedown notice, we will remove or disable access to the identified torrent listing promptly, notify the uploader, and document the notice for our repeat infringer records.

5. Counter-Notice (17 U.S.C. 512(g))

If you believe your content was removed by mistake or misidentification, you may submit a counter-notice to our DMCA Agent containing your signature, identification of the removed material, a good faith statement under penalty of perjury, your contact details, and consent to federal court jurisdiction.

Upon receipt of a valid counter-notice, we will forward it to the original complainant. If the complainant does not file a court action within 10 to 14 business days, we may reinstate the removed material.

6. Repeat Infringer Policy

The Site will terminate accounts of users who are repeat infringers in appropriate circumstances.

7. Contact

All DMCA correspondence must be sent to: [DMCA EMAIL]
General inquiries: [CONTACT EMAIL]`);

  const supportBody = fillTemplate(`Support & Help

Welcome to [SITE NAME]. This page covers the most common questions and how to get help.

Getting Started
---------------
After logging in, use the Browse page to find torrents. Download the .torrent file or copy the magnet link into your torrent client (qBittorrent, Deluge, Transmission, etc.). Make sure your client is configured to use your personal announce URL: found in your Profile under Settings.

Maintaining Your Ratio
----------------------
Your ratio is your total uploaded bytes divided by your total downloaded bytes. A healthy ratio is above 1.0. To build ratio, seed your downloads for as long as possible after they complete. Freeleech torrents do not count against your downloaded total: take advantage of them.

If your ratio drops below the minimum threshold, your download privileges may be limited until you seed enough to recover. Check the Site Rules page for the current minimum.

Account Issues
--------------
  - Forgot your password? Use the Forgot Password link on the login page.
  - Need to change your email or username? Go to Settings.
  - Lost your two-factor authentication device? Contact support (see below).
  - Account banned? You will have received a reason by email or on login.

Reporting Problems
------------------
  - Broken torrent file or bad content: use the Report button on the torrent page.
  - DMCA / copyright concern: see our DMCA Policy at /p/dmca.
  - Staff abuse or site issue: use the Helpdesk in the Staff section.

Contact
-------
For support enquiries not covered above, email: [CONTACT EMAIL]
Please include your username and a clear description of the issue.`);

  const legalPages = [
    { title: 'Terms and Conditions', slug: 'terms',   body: termsBody,   order: 1 },
    { title: 'DMCA Policy',          slug: 'dmca',    body: dmcaBody,    order: 2 },
    { title: 'Support',              slug: 'support', body: supportBody, order: 3 },
  ];

  for (const pg of legalPages) {
    const [existing] = await conn.execute('SELECT id FROM custom_pages WHERE slug = ? LIMIT 1', [pg.slug]);
    if (existing.length > 0) {
      // Always update — migrations seed placeholder markers; the installer fills in real values.
      await conn.execute(
        'UPDATE custom_pages SET title = ?, body = ?, is_published = TRUE WHERE slug = ?',
        [pg.title, pg.body, pg.slug],
      );
      pass(`${pg.title} page updated  ${dim(`(/${pg.slug})`)}`);
    } else {
      await conn.execute(
        'INSERT INTO custom_pages (title, slug, body, show_in_nav, is_published, display_order) VALUES (?, ?, ?, FALSE, TRUE, ?)',
        [pg.title, pg.slug, pg.body, pg.order],
      );
      pass(`${pg.title} page created  ${dim(`(/${pg.slug})`)}`);
    }
  }

  // ── [ 8/8 ] Administrator account ───────────────────────────────────────

  console.log(`\n${bold('[ 8/8 ]  Administrator Account')}\n`);

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
