import { FastifyPluginAsync } from 'fastify';
import { spawn } from 'child_process';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from '../../lib/config';
import { redis, rPush } from '../../lib/redis';
import { execute } from '../../lib/db';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { ValidationError, NotFoundError } from '../../lib/errors';

const REPO_ROOT  = path.join(process.cwd(), '..');
const BACKUP_DIR = config.backupPath || path.join(process.cwd(), '..', '..', 'backups');
const FILE_RE    = /^ngtt-backup-[0-9T-]+\.tar\.gz$/;

async function audit(userId: number, action: string, meta?: object): Promise<void> {
  await execute(
    'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
    [userId, action, meta ? JSON.stringify(meta) : null],
  );
}

function safeFilename(name: string): string | null {
  return FILE_RE.test(name) ? name : null;
}

export const adminBackupRoutes: FastifyPluginAsync = async app => {
  const preAdmin = [authenticate, requireAdmin];

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // POST /api/admin/backup/create
  app.post('/api/admin/backup/create', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      components: z.array(z.enum(['db', 'uploads', 'env'])).min(1),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('At least one component required');

    // Cross-lock: refuse if update is running
    if (await redis.get('update:lock')) {
      return reply.status(409).send({ error: 'UPDATE_IN_PROGRESS', message: 'Cannot backup while an update is running' });
    }

    // Acquire backup lock — 1800s covers dumps of large databases + uploads
    const locked = await redis.set('backup:lock', '1', 'EX', 1800, 'NX');
    if (locked === null) {
      return reply.status(409).send({ error: 'BACKUP_IN_PROGRESS', message: 'A backup is already running' });
    }

    const components = parsed.data.components.join(',');

    await redis.del('backup:log');
    await rPush('backup:log', `${new Date().toISOString()} Backup started (${components})`);
    await redis.expire('backup:log', 7 * 24 * 60 * 60);
    await redis.set('backup:status', 'running', 'EX', 1800);

    await audit(req.user.id, 'backup_create', { components });

    const scriptPath = path.join(process.cwd(), 'backup.sh');
    const child = spawn('/bin/bash', [scriptPath, components, BACKUP_DIR], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        REDIS_URL:    config.redisUrl,
        DATABASE_URL: config.databaseUrl,
        UPLOAD_PATH:  config.uploadPath,
        REPO_ROOT,
      },
    });
    child.on('error', async (err: Error) => {
      await redis.set('backup:status', 'failed', 'EX', 1800);
      await rPush('backup:log', `FATAL: failed to start backup script — ${err.message}`);
      await redis.del('backup:lock');
    });
    child.unref();

    return reply.status(202).send({ ok: true, message: `Backup started (${components})` });
  });

  // GET /api/admin/backup/progress
  app.get('/api/admin/backup/progress', { preHandler: preAdmin }, async (_req, reply) => {
    const status = (await redis.get('backup:status')) ?? 'idle';
    const lines  = await redis.lrange('backup:log', 0, -1);
    return reply.send({ status, lines });
  });

  // GET /api/admin/backup/list
  app.get('/api/admin/backup/list', { preHandler: preAdmin }, async (_req, reply) => {
    let files: string[] = [];
    try { files = await fs.readdir(BACKUP_DIR); } catch { /* dir not yet created */ }

    const backups = (await Promise.all(
      files
        .filter(f => FILE_RE.test(f))
        .sort()
        .reverse()
        .map(async name => {
          try {
            const stat = await fs.stat(path.join(BACKUP_DIR, name));
            return { name, size: stat.size, created_at: stat.mtime.toISOString() };
          } catch { return null; }
        }),
    )).filter((b): b is { name: string; size: number; created_at: string } => b !== null);
    return reply.send({ backups });
  });

  // GET /api/admin/backup/download/:filename
  app.get<{ Params: { filename: string } }>(
    '/api/admin/backup/download/:filename',
    { preHandler: preAdmin },
    async (req, reply) => {
      const name = safeFilename(req.params.filename);
      if (!name) throw new ValidationError('Invalid filename');

      const filePath = path.join(BACKUP_DIR, name);
      try { await fs.access(filePath); }
      catch { throw new NotFoundError('Backup file not found'); }

      const stat = await fs.stat(filePath);
      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="${name}"`);
      reply.header('Content-Length', stat.size);
      return reply.send(createReadStream(filePath));
    },
  );

  // DELETE /api/admin/backup/:filename
  app.delete<{ Params: { filename: string } }>(
    '/api/admin/backup/:filename',
    { preHandler: preAdmin },
    async (req, reply) => {
      const name = safeFilename(req.params.filename);
      if (!name) throw new ValidationError('Invalid filename');

      const filePath = path.join(BACKUP_DIR, name);
      try { await fs.unlink(filePath); }
      catch { throw new NotFoundError('Backup file not found'); }

      await audit(req.user.id, 'backup_delete', { filename: name });
      return reply.send({ ok: true });
    },
  );
};
