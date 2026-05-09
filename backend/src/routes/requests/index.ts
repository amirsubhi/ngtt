import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute, withTransaction } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { jobsQueue } from '../../lib/queues';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';

interface RequestRow {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  bounty_flux: number;
  is_filled: boolean;
  filled_torrent_id: number | null;
  created_at: string;
  username: string;
  category_name: string | null;
}

export const requestRoutes: FastifyPluginAsync = async app => {
  // GET /api/requests/my — must be registered before /:id
  app.get('/api/requests/my', { preHandler: [authenticate] }, async (req, reply) => {
    const rows = await query<RequestRow>(
      `SELECT r.id, r.title, r.bounty_flux, r.is_filled, r.created_at,
              u.username, c.name AS category_name
       FROM torrent_requests r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC LIMIT 50`,
      [req.user.id],
    );
    return reply.send({ requests: rows });
  });

  // GET /api/requests
  app.get('/api/requests', { preHandler: [authenticate] }, async (req, reply) => {
    const page = Math.max(1, parseInt(((req.query as { page?: string }).page ?? '1'), 10));
    const offset = (page - 1) * 50;
    const category = (req.query as { category?: string }).category;
    const filled = (req.query as { filled?: string }).filled;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (category) { conditions.push('c.slug = ?'); params.push(category); }
    if (filled === '1') { conditions.push('r.is_filled = TRUE'); }
    else if (filled === '0' || filled === undefined) { conditions.push('r.is_filled = FALSE'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(50, offset);

    const rows = await query<RequestRow>(
      `SELECT r.id, r.title, r.description, r.bounty_flux, r.is_filled,
              r.filled_torrent_id, r.created_at, u.username, c.name AS category_name
       FROM torrent_requests r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN categories c ON c.id = r.category_id
       ${where}
       ORDER BY r.bounty_flux DESC, r.created_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );
    return reply.send({ requests: rows, page });
  });

  // GET /api/requests/:id
  app.get<{ Params: { id: string } }>('/api/requests/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const requestId = parseInt(req.params.id, 10);
    const row = await queryOne(
      `SELECT r.id, r.title, r.description, r.bounty_flux, r.is_filled,
              r.filled_torrent_id, r.created_at, u.username, u.id AS user_id,
              c.name AS category_name
       FROM torrent_requests r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.id = ?`,
      [requestId],
    );
    if (!row) throw new NotFoundError('Request not found');
    return reply.send(row);
  });

  // POST /api/requests — create
  app.post('/api/requests', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = z.object({
      title: z.string().min(3).max(500).trim(),
      description: z.string().max(5000).optional(),
      category_id: z.number().int().positive().optional(),
      bounty_flux: z.number().min(0).max(1_000_000).default(0),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const { title, description, category_id, bounty_flux } = parsed.data;

    // Deduct bounty atomically if > 0
    if (bounty_flux > 0) {
      await withTransaction(async conn => {
        const [result] = await conn.execute<import('mysql2').ResultSetHeader>(
          'UPDATE users SET flux = flux - ? WHERE id = ? AND flux >= ?',
          [bounty_flux, req.user.id, bounty_flux],
        );
        if (result.affectedRows === 0) throw new ForbiddenError('Insufficient FLX balance');

        const [ins] = await conn.execute<import('mysql2').ResultSetHeader>(
          'INSERT INTO torrent_requests (user_id, title, description, category_id, bounty_flux) VALUES (?,?,?,?,?)',
          [req.user.id, title, description ?? null, category_id ?? null, bounty_flux],
        );
        await conn.execute(
          "INSERT INTO flux_transactions (user_id, amount, source, reference_id) VALUES (?, ?, 'request_bounty', ?)",
          [req.user.id, -bounty_flux, ins.insertId],
        );
      });
    } else {
      await execute(
        'INSERT INTO torrent_requests (user_id, title, description, category_id, bounty_flux) VALUES (?,?,?,?,?)',
        [req.user.id, title, description ?? null, category_id ?? null, 0],
      );
    }

    return reply.status(201).send({ ok: true });
  });

  // POST /api/requests/:id/fill
  app.post<{ Params: { id: string } }>(
    '/api/requests/:id/fill',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const requestId = parseInt(req.params.id, 10);
      const parsed = z.object({ torrent_id: z.number().int().positive() }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('torrent_id required');

      const request = await queryOne<{
        id: number; user_id: number; bounty_flux: number;
        is_filled: boolean; title: string;
      }>(
        'SELECT id, user_id, bounty_flux, is_filled, title FROM torrent_requests WHERE id = ?',
        [requestId],
      );
      if (!request) throw new NotFoundError('Request not found');
      if (request.is_filled) throw new ForbiddenError('Request is already filled');
      if (request.user_id === req.user.id) throw new ForbiddenError('Cannot fill your own request');

      // Verify the torrent exists and is approved
      const torrent = await queryOne<{ id: number }>(
        "SELECT id FROM torrents WHERE id = ? AND status = 'approved'",
        [parsed.data.torrent_id],
      );
      if (!torrent) throw new NotFoundError('Torrent not found or not approved');

      await withTransaction(async conn => {
        // Mark filled
        await conn.execute(
          'UPDATE torrent_requests SET is_filled=TRUE, filled_by=?, filled_torrent_id=? WHERE id=? AND is_filled=FALSE',
          [req.user.id, parsed.data.torrent_id, requestId],
        );

        // Transfer bounty atomically if > 0
        if (request.bounty_flux > 0) {
          // Deduct from requester (atomic check — may already have spent it)
          const [deduct] = await conn.execute<import('mysql2').ResultSetHeader>(
            'UPDATE users SET flux = flux - ? WHERE id = ? AND flux >= ?',
            [request.bounty_flux, request.user_id, request.bounty_flux],
          );
          if (deduct.affectedRows === 0) {
            // Requester can't pay — still mark filled but skip flux transfer
          } else {
            await conn.execute(
              'UPDATE users SET flux = flux + ? WHERE id = ?',
              [request.bounty_flux, req.user.id],
            );
            await conn.execute(
              "INSERT INTO flux_transactions (user_id, amount, source, reference_id) VALUES (?,?,'request_filled',?)",
              [req.user.id, request.bounty_flux, requestId],
            );
          }
        }
      });

      void jobsQueue.add('send-notif', {
        user_id: request.user_id,
        title: 'Request Filled',
        body: `Your request "${request.title}" has been filled.`,
        url: `/requests/${requestId}`,
      });

      return reply.send({ ok: true });
    },
  );

  // POST /api/torrents/:id/reseed — 12b
  app.post<{ Params: { id: string } }>(
    '/api/torrents/:id/reseed',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const torrentId = parseInt(req.params.id, 10);
      const torrent = await queryOne<{ id: number; uploader_id: number | null; name: string }>(
        "SELECT id, uploader_id, name FROM torrents WHERE id = ? AND status = 'approved'",
        [torrentId],
      );
      if (!torrent) throw new NotFoundError('Torrent not found');

      // Upsert — one per user per torrent
      await execute(
        'INSERT IGNORE INTO reseed_requests (torrent_id, requested_by) VALUES (?, ?)',
        [torrentId, req.user.id],
      );

      // Notify uploader if they still have an account
      if (torrent.uploader_id) {
        void jobsQueue.add('send-notif', {
          user_id: torrent.uploader_id,
          title: 'Reseed Request',
          body: `Someone is requesting you reseed "${torrent.name}".`,
          url: `/torrent/${torrentId}`,
        });
      }

      const countRow = await queryOne<{ count: number }>(
        'SELECT COUNT(*) AS count FROM reseed_requests WHERE torrent_id = ?',
        [torrentId],
      );

      return reply.send({ ok: true, reseed_count: countRow?.count ?? 1 });
    },
  );
};
