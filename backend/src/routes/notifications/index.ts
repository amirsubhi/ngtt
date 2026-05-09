import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { ValidationError } from '../../lib/errors';
import { getIo } from '../../lib/socket';

export const notificationsRoutes: FastifyPluginAsync = async app => {
  // GET /api/notifications
  app.get('/api/notifications', { preHandler: [authenticate] }, async (req, reply) => {
    const rawPage = parseInt(((req.query as { page?: string }).page ?? '1'), 10);
    const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const offset = (page - 1) * 25;

    const notifications = await query(
      `SELECT id, type, title, body, url, is_read, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 25 OFFSET ${offset}`,
      [req.user.id],
    );
    const unread = await queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id],
    );
    return reply.send({ notifications, unread_count: unread?.count ?? 0, page });
  });

  // POST /api/notifications/mark-read
  app.post('/api/notifications/mark-read', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.number()) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Expected array of IDs');
    if (parsed.data.ids.length === 0) return reply.send({ ok: true });

    const placeholders = parsed.data.ids.map(() => '?').join(',');
    await execute(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...parsed.data.ids],
    );
    await pushUnreadCount(req.user.id);
    return reply.send({ ok: true });
  });

  // POST /api/notifications/mark-all-read
  app.post('/api/notifications/mark-all-read', { preHandler: [authenticate] }, async (req, reply) => {
    await execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    await pushUnreadCount(req.user.id);
    return reply.send({ ok: true });
  });
};

async function pushUnreadCount(userId: number): Promise<void> {
  try {
    const row = await queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId],
    );
    getIo().of('/ws').to(`user:${userId}`).emit('notif-count', row?.count ?? 0);
  } catch { /* socket not initialized in some contexts */ }
}
