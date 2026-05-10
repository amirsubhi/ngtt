import { FastifyPluginAsync } from 'fastify';
import { execFileSync, spawn } from 'child_process';
import path from 'path';
import { z } from 'zod';
import { config } from '../../lib/config';
import { redis, rPush } from '../../lib/redis';
import { execute } from '../../lib/db';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { ValidationError } from '../../lib/errors';

const REPO_ROOT = path.join(process.cwd(), '..');
const TAG_RE    = /^[a-zA-Z0-9._-]+$/;

interface GithubRelease {
  tag_name:     string;
  name:         string;
  body:         string;
  published_at: string;
  html_url:     string;
}

async function audit(userId: number, action: string, meta?: object): Promise<void> {
  await execute(
    'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
    [userId, action, meta ? JSON.stringify(meta) : null],
  );
}

function getCurrentRef(): string {
  const opts = { cwd: REPO_ROOT, encoding: 'utf8' as const, stdio: 'pipe' as const };
  try {
    return execFileSync('git', ['describe', '--tags', '--exact-match'], opts).trim();
  } catch {
    try {
      return execFileSync('git', ['describe', '--tags'], opts).trim();
    } catch {
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], opts).trim();
    }
  }
}

async function fetchLatestRelease(): Promise<GithubRelease | null> {
  if (!config.githubRepo) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${config.githubRepo}/releases/latest`, {
      headers: {
        'User-Agent': 'NGTT-updater/1.0',
        'Accept':     'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return null;
    return await res.json() as GithubRelease;
  } catch {
    return null;
  }
}

export const adminUpdateRoutes: FastifyPluginAsync = async app => {
  const preAdmin = [authenticate, requireAdmin];

  app.get('/api/admin/update/status', { preHandler: preAdmin }, async (_req, reply) => {
    if (!config.githubRepo) {
      return reply.send({
        configured: false,
        message:    'Set GITHUB_REPO=owner/repo in .env to enable in-app updates',
      });
    }

    const current = getCurrentRef();
    const latest  = await fetchLatestRelease();
    const status  = (await redis.get('update:status')) ?? 'idle';

    return reply.send({
      configured: true,
      current,
      latest: latest
        ? {
            tag:          latest.tag_name,
            name:         latest.name,
            body:         latest.body,
            published_at: latest.published_at,
            url:          latest.html_url,
          }
        : null,
      isLatest: latest ? current === latest.tag_name : null,
      status,
    });
  });

  app.post('/api/admin/update/apply', { preHandler: preAdmin }, async (req, reply) => {
    if (!config.githubRepo) throw new ValidationError('GITHUB_REPO not configured');

    const parsed = z.object({ tag: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('tag is required');
    const { tag } = parsed.data;

    // Strict format check before any git/shell use
    if (!TAG_RE.test(tag)) throw new ValidationError('Invalid tag format');

    // Validate against GitHub — tag must be the current latest release
    const latest = await fetchLatestRelease();
    if (!latest || latest.tag_name !== tag) {
      throw new ValidationError(`${tag} is not the current latest GitHub Release`);
    }

    // Acquire Redis lock — 1800s covers cold-install deploys (npm ci × 2 + builds + migrate + pm2 reload)
    const locked = await redis.set('update:lock', '1', 'EX', 1800, 'NX');
    if (locked === null) {
      return reply.status(409).send({ error: 'UPDATE_IN_PROGRESS', message: 'An update is already running' });
    }

    const prevRef = getCurrentRef();

    // Clear previous log and set status before spawning.
    // TTL of 1800s is a safety net: if the script crashes before writing its final
    // status, this key would otherwise persist forever and block future updates.
    await redis.del('update:log');
    await rPush('update:log', `${new Date().toISOString()} Update to ${tag} initiated`);
    await redis.expire('update:log', 7 * 24 * 60 * 60);
    await redis.set('update:status', 'running', 'EX', 1800);

    await audit(req.user.id, 'update_apply', { tag, prevRef });

    const scriptPath = path.join(process.cwd(), 'update.sh');
    const child = spawn('/bin/bash', [scriptPath, tag, prevRef], {
      detached: true,
      stdio:    'ignore',
      env: { ...process.env, REDIS_URL: config.redisUrl, REPO_ROOT },
    });
    // Attach error listener before unref() so launch failures (e.g. missing script)
    // clear the lock and status rather than leaving them permanently set.
    child.on('error', async (err: Error) => {
      await redis.set('update:status', 'failed', 'EX', 1800);
      await rPush('update:log', `FATAL: failed to start update script — ${err.message}`);
      await redis.del('update:lock');
    });
    child.unref();

    return reply.status(202).send({ ok: true, message: `Update to ${tag} started` });
  });

  app.get('/api/admin/update/progress', { preHandler: preAdmin }, async (_req, reply) => {
    const status = (await redis.get('update:status')) ?? 'idle';
    const lines  = await redis.lrange('update:log', 0, -1);
    return reply.send({ status, lines });
  });
};
