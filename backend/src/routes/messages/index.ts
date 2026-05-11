import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, executeInsert, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { requireFeature } from '../../middleware/featureFlag';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import { jobsQueue } from '../../lib/queues';
import { getIo } from '../../lib/socket';

const PAGE_SIZE = 25;

export const messagesRoutes: FastifyPluginAsync = async app => {
  const ff = requireFeature('pm_enabled');

  // GET /api/messages?folder=inbox|sent
  app.get('/api/messages', { preHandler: [ff, authenticate] }, async (req, reply) => {
    const folder = ((req.query as { folder?: string }).folder ?? 'inbox') === 'sent' ? 'sent' : 'inbox';
    const userId = req.user.id;

    const rows = folder === 'inbox'
      ? await query(
          `SELECT m.id, m.subject, m.is_read, m.created_at,
                  u.username AS sender_username, u.avatar_url AS sender_avatar
           FROM messages m JOIN users u ON u.id = m.sender_id
           WHERE m.receiver_id = ? AND m.deleted_by_receiver = FALSE
           ORDER BY m.created_at DESC LIMIT ${PAGE_SIZE}`,
          [userId],
        )
      : await query(
          `SELECT m.id, m.subject, m.created_at,
                  u.username AS receiver_username, u.avatar_url AS receiver_avatar
           FROM messages m JOIN users u ON u.id = m.receiver_id
           WHERE m.sender_id = ? AND m.deleted_by_sender = FALSE
           ORDER BY m.created_at DESC LIMIT ${PAGE_SIZE}`,
          [userId],
        );

    return reply.send({ folder, messages: rows });
  });

  // GET /api/messages/:id
  app.get<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: [ff, authenticate] },
    async (req, reply) => {
      const msgId = parseInt((req.params as { id: string }).id, 10);
      const msg = await queryOne(
        `SELECT m.*, u1.username AS sender_username, u2.username AS receiver_username
         FROM messages m
         JOIN users u1 ON u1.id = m.sender_id
         JOIN users u2 ON u2.id = m.receiver_id
         WHERE m.id = ?`,
        [msgId],
      );
      if (!msg) throw new NotFoundError();
      const m = msg as { sender_id: number; receiver_id: number };
      if (m.sender_id !== req.user.id && m.receiver_id !== req.user.id) throw new ForbiddenError();

      if (m.receiver_id === req.user.id) {
        void execute('UPDATE messages SET is_read = TRUE WHERE id = ?', [msgId]).catch(() => {});
      }
      return reply.send(msg);
    },
  );

  // POST /api/messages
  app.post('/api/messages', { preHandler: [ff, authenticate] }, async (req, reply) => {
    const parsed = z.object({
      receiver_username: z.string(),
      subject: z.string().min(1).max(255),
      body: z.string().min(1).max(10000),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid');

    const { receiver_username, subject, body } = parsed.data;
    const receiver = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE username = ? AND is_deleted = FALSE', [receiver_username],
    );
    if (!receiver) throw new NotFoundError('User not found');
    if (receiver.id === req.user.id) throw new ValidationError('Cannot message yourself');

    const msgId = await executeInsert(
      'INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?)',
      [req.user.id, receiver.id, subject, body],
    );

    void jobsQueue.add('send-notif', {
      user_id: receiver.id,
      title: `New PM from ${req.user.username}`,
      body: subject,
      url: `/messages/${msgId}`,
    });

    // Email notification — only if receiver opted in
    const prefs = await queryOne<{ email_pm_received: boolean }>(
      'SELECT email_pm_received FROM user_preferences WHERE user_id = ? LIMIT 1',
      [receiver.id],
    );
    if (prefs?.email_pm_received) {
      const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;
      void jobsQueue.add('send-email', {
        to_user_id: receiver.id,
        template: 'pm-notification',
        vars: { sender_username: req.user.username, preview },
      });
    }

    // Real-time PM alert if receiver is connected
    try {
      getIo().of('/ws').to(`user:${receiver.id}`).emit('pm-alert', {
        from: req.user.username,
        subject,
        id: msgId,
      });
    } catch { /* socket not initialized in some contexts */ }

    return reply.status(201).send({ id: msgId });
  });

  // DELETE /api/messages/:id
  app.delete<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: [ff, authenticate] },
    async (req, reply) => {
      const msgId = parseInt((req.params as { id: string }).id, 10);
      const msg = await queryOne<{ sender_id: number; receiver_id: number }>(
        'SELECT sender_id, receiver_id FROM messages WHERE id = ?', [msgId],
      );
      if (!msg) throw new NotFoundError();
      if (msg.sender_id === req.user.id)
        await execute('UPDATE messages SET deleted_by_sender = TRUE WHERE id = ?', [msgId]);
      else if (msg.receiver_id === req.user.id)
        await execute('UPDATE messages SET deleted_by_receiver = TRUE WHERE id = ?', [msgId]);
      else
        throw new ForbiddenError();
      return reply.send({ ok: true });
    },
  );

  // POST /api/messages/mark-read
  app.post('/api/messages/mark-read', { preHandler: [ff, authenticate] }, async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.number()) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Expected array of IDs');
    if (parsed.data.ids.length === 0) return reply.send({ ok: true });

    const placeholders = parsed.data.ids.map(() => '?').join(',');
    await execute(
      `UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...parsed.data.ids],
    );
    return reply.send({ ok: true });
  });
};
