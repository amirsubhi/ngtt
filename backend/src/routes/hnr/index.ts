import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate, requireStaff } from '../../middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';

interface HnrRow {
  id: number;
  torrent_id: number;
  torrent_name: string;
  downloaded_at: string;
  seed_deadline_at: string;
  seeded_time_mins: number;
  status: 'active' | 'resolved' | 'pardoned' | 'expired';
  pardon_reason: string | null;
}

export const hnrRoutes: FastifyPluginAsync = async app => {
  // GET /api/users/me/hnr
  app.get('/api/users/me/hnr', { preHandler: [authenticate] }, async (req, reply) => {
    const rows = await query<HnrRow>(
      `SELECT h.id, h.torrent_id, t.name AS torrent_name,
              h.downloaded_at, h.seed_deadline_at, h.seeded_time_mins, h.status, h.pardon_reason
       FROM hit_and_runs h
       JOIN torrents t ON t.id = h.torrent_id
       WHERE h.user_id = ?
       ORDER BY h.created_at DESC
       LIMIT 100`,
      [req.user.id],
    );
    return reply.send({ hnr: rows });
  });

  // GET /api/staff/hnr (staff only)
  app.get('/api/staff/hnr', { preHandler: [authenticate, requireStaff] }, async (req, reply) => {
    const status = (req.query as { status?: string }).status ?? 'active';
    const page = Math.max(1, parseInt(((req.query as { page?: string }).page ?? '1'), 10));
    const offset = (page - 1) * 50;

    const rows = await query<HnrRow & { username: string }>(
      `SELECT h.id, h.torrent_id, t.name AS torrent_name, u.username,
              h.downloaded_at, h.seed_deadline_at, h.seeded_time_mins, h.status, h.pardon_reason
       FROM hit_and_runs h
       JOIN torrents t ON t.id = h.torrent_id
       JOIN users u ON u.id = h.user_id
       WHERE h.status = ?
       ORDER BY h.seed_deadline_at ASC
       LIMIT 50 OFFSET ${offset}`,
      [status],
    );
    return reply.send({ hnr: rows, page });
  });

  // POST /api/staff/hnr/:id/pardon
  app.post<{ Params: { id: string } }>(
    '/api/staff/hnr/:id/pardon',
    { preHandler: [authenticate, requireStaff] },
    async (req, reply) => {
      const hnrId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({ reason: z.string().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Reason required');

      const hnr = await queryOne<{ id: number; status: string }>(
        'SELECT id, status FROM hit_and_runs WHERE id = ?', [hnrId],
      );
      if (!hnr) throw new NotFoundError('H&R record not found');
      if (hnr.status === 'pardoned') throw new ForbiddenError('Already pardoned');

      await execute(
        "UPDATE hit_and_runs SET status = 'pardoned', pardoned_by = ?, pardon_reason = ? WHERE id = ?",
        [req.user.id, parsed.data.reason, hnrId],
      );
      return reply.send({ ok: true });
    },
  );
};
