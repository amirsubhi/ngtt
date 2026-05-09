import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MultipartFile } from '@fastify/multipart';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import { queryOne, execute, withTransaction } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { saveFile, getFileUrl, deleteFile } from '../../lib/storage';
import { ValidationError, ForbiddenError } from '../../lib/errors';
import { jobsQueue } from '../../lib/queues';
import mysql from 'mysql2/promise';

const USERNAME_CHANGE_COST = 500;
const USERNAME_CHANGE_DAYS = 90;

const UsernameChangeSchema = z.object({
  new_username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string(),
});

const DeleteAccountSchema = z.object({
  password: z.string(),
});

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // Username change
  app.post('/api/users/me/username', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = UsernameChangeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { new_username, password } = parsed.data;

    const user = await queryOne<{ id: number; username: string; password_hash: string; flux: number }>(
      'SELECT id, username, password_hash, flux FROM users WHERE id = ? LIMIT 1',
      [req.user.id],
    );
    if (!user) throw new ValidationError('User not found');

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) throw new ForbiddenError('Incorrect password');

    if (user.flux < USERNAME_CHANGE_COST) {
      return reply.status(402).send({ error: 'INSUFFICIENT_FLUX', message: `Requires ${USERNAME_CHANGE_COST} FLX` });
    }

    // 90-day cooldown
    const recentChange = await queryOne<{ created_at: string }>(
      `SELECT created_at FROM username_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.user.id],
    );
    if (recentChange) {
      const daysSince = (Date.now() - new Date(recentChange.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < USERNAME_CHANGE_DAYS) {
        const daysLeft = Math.ceil(USERNAME_CHANGE_DAYS - daysSince);
        throw new ValidationError(`Username can only be changed every ${USERNAME_CHANGE_DAYS} days. ${daysLeft} days remaining.`);
      }
    }

    // Check new username availability
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
      [new_username, req.user.id],
    );
    if (existing) throw new ValidationError('Username already taken');

    await withTransaction(async (conn: mysql.PoolConnection) => {
      await conn.execute('INSERT INTO username_history (user_id, old_username, changed_by) VALUES (?, ?, ?)', [req.user.id, user.username, req.user.id]);
      await conn.execute('UPDATE users SET username = ?, flux = flux - ? WHERE id = ?', [new_username, USERNAME_CHANGE_COST, req.user.id]);
      await conn.execute("INSERT INTO flux_transactions (user_id, amount, type, source) VALUES (?, ?, 'spend', 'Username change')", [req.user.id, USERNAME_CHANGE_COST]);
    });

    return reply.send({ username: new_username, flux_spent: USERNAME_CHANGE_COST });
  });

  // Avatar upload
  app.post('/api/users/me/avatar', { preHandler: [authenticate] }, async (req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: MultipartFile | undefined = await (req as any).file({ limits: { fileSize: 1024 * 1024 } });
    if (!data) throw new ValidationError('No file uploaded');

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(data.mimetype)) throw new ValidationError('Only jpg, png, webp allowed');

    const raw = await data.toBuffer();
    // Square crop and resize to 200x200
    const processed = await sharp(raw)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90 })
      .toBuffer();

    const filename = `avatars/${req.user.id}.jpg`;

    // Delete old avatar if exists
    const old = await queryOne<{ avatar_url: string | null }>('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
    if (old?.avatar_url) {
      void deleteFile(`avatars/${req.user.id}.jpg`).catch(() => {});
    }

    await saveFile(filename, processed);
    const url = getFileUrl(filename);
    await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);

    return reply.send({ avatar_url: url });
  });

  // Data export (GDPR) — synchronous, returns file directly
  app.get('/api/users/me/export', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.user.id;
    const [profile, uploads, snatches, flux] = await Promise.all([
      queryOne<Record<string, unknown>>(
        'SELECT id, username, email, uploaded, downloaded, created_at, last_seen_at FROM users WHERE id = ?',
        [userId],
      ),
      queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM torrents WHERE uploader_id = ?', [userId]),
      queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM torrent_snatches WHERE user_id = ?', [userId]),
      queryOne<{ balance: number }>('SELECT flux AS balance FROM users WHERE id = ?', [userId]),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      upload_count: uploads?.cnt ?? 0,
      snatch_count: snatches?.cnt ?? 0,
      flux_balance: flux?.balance ?? 0,
    };

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="ngtt-export-${userId}.json"`)
      .send(JSON.stringify(exportData, null, 2));
  });

  // Account deletion (GDPR)
  app.delete('/api/users/me/account', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = DeleteAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Password required');

    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id],
    );
    if (!user) throw new ValidationError('User not found');

    const validPassword = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!validPassword) throw new ForbiddenError('Incorrect password');

    const userId = req.user.id;
    const scrambledUsername = `deleted_${userId}_${Date.now()}`;
    const scrambledEmail = `deleted_${userId}@deleted.invalid`;

    await withTransaction(async (conn: mysql.PoolConnection) => {
      // Soft delete + scramble PII
      await conn.execute(
        'UPDATE users SET is_deleted = TRUE, deleted_at = NOW(), username = ?, email = ?, avatar_url = NULL, about_me = NULL, two_factor_secret = NULL WHERE id = ?',
        [scrambledUsername, scrambledEmail, userId],
      );
      // Hard delete personal data
      await conn.execute('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
      await conn.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      await conn.execute('DELETE FROM user_backup_codes WHERE user_id = ?', [userId]);
      await conn.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
      await conn.execute('DELETE FROM torrent_bookmarks WHERE user_id = ?', [userId]);
      // Anonymize (set user_id=NULL) forum posts, shoutbox, audit logs
      // (torrents keep uploader_id — staff decides per-torrent)
    });

    reply.clearCookie('refresh_token', { path: '/' });
    return reply.send({ ok: true });
  });
}
