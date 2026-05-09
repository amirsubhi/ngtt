import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute, withTransaction } from '../../lib/db';
import { authenticate, requireStaff } from '../../middleware/auth';
import { jobsQueue } from '../../lib/queues';
import { deleteFile } from '../../lib/storage';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import { emitSystemShoutbox } from '../shoutbox/shoutbox';

async function audit(userId: number, action: string, targetType: string | null, targetId: number | null, meta?: object): Promise<void> {
  await execute(
    'INSERT INTO audit_logs (user_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [userId, action, targetType, targetId, meta ? JSON.stringify(meta) : null],
  );
}

export const staffRoutes: FastifyPluginAsync = async app => {
  const pre = [authenticate, requireStaff];

  // 10a — Dashboard summary
  app.get('/api/staff/dashboard', { preHandler: pre }, async (_req, reply) => {
    const [[pending], [tickets], [hnr], [reports], [newUsers], [online]] = await Promise.all([
      query<{ c: number }>("SELECT COUNT(*) AS c FROM torrents WHERE status='pending'"),
      query<{ c: number }>("SELECT COUNT(*) AS c FROM helpdesk_tickets WHERE status IN ('open','in_progress')"),
      query<{ c: number }>("SELECT COUNT(*) AS c FROM hit_and_runs WHERE status='active'"),
      query<{ c: number }>("SELECT COUNT(*) AS c FROM reports WHERE status='pending'"),
      query<{ c: number }>('SELECT COUNT(*) AS c FROM users WHERE DATE(created_at) = CURDATE()'),
      query<{ c: number }>('SELECT COUNT(*) AS c FROM users WHERE last_seen_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'),
    ]);
    return reply.send({
      pending_torrents: pending?.c ?? 0,
      open_tickets: tickets?.c ?? 0,
      active_hnr: hnr?.c ?? 0,
      pending_reports: reports?.c ?? 0,
      new_users_today: newUsers?.c ?? 0,
      online_users: online?.c ?? 0,
    });
  });

  // 10b — Torrent approval queue
  app.get('/api/staff/torrents/pending', { preHandler: pre }, async (_req, reply) => {
    const rows = await query(
      `SELECT t.id, t.name, t.size, t.created_at, u.username AS uploader, c.name AS category
       FROM torrents t JOIN users u ON u.id=t.uploader_id JOIN categories c ON c.id=t.category_id
       WHERE t.status='pending' ORDER BY t.created_at ASC LIMIT 100`,
    );
    return reply.send({ torrents: rows });
  });

  app.post<{ Params: { id: string } }>('/api/staff/torrents/:id/approve', { preHandler: pre }, async (req, reply) => {
    const torrentId = parseInt(req.params.id, 10);
    const torrent = await queryOne<{ id: number; name: string; uploader_id: number; status: string }>(
      'SELECT id, name, uploader_id, status FROM torrents WHERE id = ?', [torrentId],
    );
    if (!torrent) throw new NotFoundError('Torrent not found');
    if (torrent.status !== 'pending') throw new ForbiddenError('Torrent is not pending');

    await withTransaction(async conn => {
      await conn.execute(
        "UPDATE torrents SET status='approved', approved_by=?, approved_at=NOW() WHERE id=?",
        [req.user.id, torrentId],
      );
      const fluxRow = await queryOne<{ value: string }>("SELECT value FROM site_settings WHERE `key`='flux_per_upload' LIMIT 1");
      const flux = parseInt(fluxRow?.value ?? '0', 10);
      if (flux > 0) {
        await conn.execute('UPDATE users SET flux=flux+? WHERE id=?', [flux, torrent.uploader_id]);
        await conn.execute(
          "INSERT INTO flux_transactions(user_id,amount,source,reference_id) VALUES(?,?,'torrent_approved',?)",
          [torrent.uploader_id, flux, torrentId],
        );
      }
    });

    void jobsQueue.add('send-notif', {
      user_id: torrent.uploader_id,
      title: 'Torrent Approved',
      body: `"${torrent.name}" has been approved.`,
      url: `/torrent/${torrentId}`,
    });
    void emitSystemShoutbox(`🎉 New torrent approved: <a href="/torrent/${torrentId}">${torrent.name}</a>`);
    await audit(req.user.id, 'torrent_approve', 'torrent', torrentId);
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/torrents/:id/reject', { preHandler: pre }, async (req, reply) => {
    const torrentId = parseInt(req.params.id, 10);
    const parsed = z.object({ reason: z.string().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Reason required');

    const torrent = await queryOne<{ id: number; name: string; uploader_id: number; info_hash: string }>(
      'SELECT id, name, uploader_id, info_hash FROM torrents WHERE id=?', [torrentId],
    );
    if (!torrent) throw new NotFoundError('Torrent not found');

    await execute('DELETE FROM torrents WHERE id=?', [torrentId]);
    void deleteFile(`torrents/${torrent.info_hash}.torrent`);

    void jobsQueue.add('send-notif', {
      user_id: torrent.uploader_id,
      title: 'Torrent Rejected',
      body: `"${torrent.name}" was rejected: ${parsed.data.reason}`,
      url: '/upload',
    });
    await audit(req.user.id, 'torrent_reject', 'torrent', torrentId, { reason: parsed.data.reason });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/torrents/:id/freeleech', { preHandler: pre }, async (req, reply) => {
    const torrentId = parseInt(req.params.id, 10);
    const row = await queryOne<{ is_freeleech: boolean }>('SELECT is_freeleech FROM torrents WHERE id=?', [torrentId]);
    if (!row) throw new NotFoundError('Torrent not found');
    await execute('UPDATE torrents SET is_freeleech=? WHERE id=?', [!row.is_freeleech, torrentId]);
    await audit(req.user.id, 'torrent_freeleech_toggle', 'torrent', torrentId);
    return reply.send({ is_freeleech: !row.is_freeleech });
  });

  // 10c — User management
  app.get('/api/staff/users', { preHandler: pre }, async (req, reply) => {
    const q = ((req.query as { q?: string }).q ?? '').trim();
    const page = Math.max(1, parseInt(((req.query as { page?: string }).page ?? '1'), 10));
    const offset = (page - 1) * 50;
    const like = `%${q}%`;
    const rows = await query(
      `SELECT u.id, u.username, u.email, u.is_banned, u.created_at,
              g.name AS group_name, g.color AS group_color
       FROM users u JOIN user_groups g ON g.id=u.group_id
       WHERE u.is_deleted=FALSE AND (u.username LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC LIMIT 50 OFFSET ?`,
      [like, like, offset],
    );
    return reply.send({ users: rows, page });
  });

  app.get<{ Params: { id: string } }>('/api/staff/users/:id', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    const user = await queryOne(
      `SELECT u.id, u.username, u.email, u.is_banned, u.ban_reason, u.uploaded, u.downloaded,
              u.ratio, u.created_at, u.last_seen_at, g.name AS group_name, g.color AS group_color, g.id AS group_id
       FROM users u JOIN user_groups g ON g.id=u.group_id WHERE u.id=?`, [userId],
    );
    if (!user) throw new NotFoundError('User not found');
    const warnings = await query('SELECT * FROM user_warnings WHERE user_id=? ORDER BY created_at DESC LIMIT 20', [userId]);
    const uploads = await query<{ id: number; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM torrents WHERE uploader_id=? ORDER BY created_at DESC LIMIT 20', [userId],
    );
    return reply.send({ user, warnings, uploads });
  });

  app.post<{ Params: { id: string } }>('/api/staff/users/:id/warn', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    const parsed = z.object({
      type: z.enum(['warning', 'shoutbox_ban', 'download_ban', 'upload_ban', 'temp_suspension']),
      reason: z.string().min(1).max(1000),
      expires_at: z.string().datetime().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    await execute(
      'INSERT INTO user_warnings (user_id, issued_by, reason, type, expires_at) VALUES (?,?,?,?,?)',
      [userId, req.user.id, parsed.data.reason, parsed.data.type, parsed.data.expires_at ?? null],
    );
    void jobsQueue.add('send-notif', { user_id: userId, title: 'Warning Issued', body: parsed.data.reason, url: '/support' });
    void jobsQueue.add('send-email', { to_user_id: userId, subject: 'NGTT Warning', body: parsed.data.reason });
    await audit(req.user.id, 'user_warn', 'user', userId, { type: parsed.data.type, reason: parsed.data.reason });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/users/:id/ban', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) throw new ForbiddenError('Cannot ban yourself');
    const parsed = z.object({ reason: z.string().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Reason required');

    await execute('UPDATE users SET is_banned=TRUE, ban_reason=? WHERE id=?', [parsed.data.reason, userId]);
    await execute('DELETE FROM refresh_tokens WHERE user_id=?', [userId]);
    void jobsQueue.add('send-notif', { user_id: userId, title: 'Account Banned', body: parsed.data.reason, url: '/support' });
    await audit(req.user.id, 'user_ban', 'user', userId, { reason: parsed.data.reason });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/users/:id/unban', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    await execute('UPDATE users SET is_banned=FALSE, ban_reason=NULL WHERE id=?', [userId]);
    await audit(req.user.id, 'user_unban', 'user', userId);
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/users/:id/shoutbox-ban', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    const parsed = z.object({ reason: z.string().min(1).max(500), expires_at: z.string().datetime().optional() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Reason required');
    await execute(
      "INSERT INTO user_warnings (user_id, issued_by, reason, type, expires_at) VALUES (?,?,?,'shoutbox_ban',?)",
      [userId, req.user.id, parsed.data.reason, parsed.data.expires_at ?? null],
    );
    await audit(req.user.id, 'shoutbox_ban', 'user', userId, { reason: parsed.data.reason });
    return reply.send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/api/staff/users/:id/history', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    const [usernames, warnings, logs] = await Promise.all([
      query('SELECT old_username, new_username, changed_at FROM username_history WHERE user_id=? ORDER BY changed_at DESC', [userId]),
      query('SELECT * FROM user_warnings WHERE user_id=? ORDER BY created_at DESC', [userId]),
      query('SELECT action, target_type, target_id, metadata, created_at FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [userId]),
    ]);
    return reply.send({ usernames, warnings, logs });
  });

  app.post<{ Params: { id: string } }>('/api/staff/users/:id/change-group', { preHandler: pre }, async (req, reply) => {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) throw new ForbiddenError('Cannot change your own group');
    const parsed = z.object({ group_id: z.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('group_id required');
    const group = await queryOne<{ id: number; slug: string }>('SELECT id, slug FROM user_groups WHERE id=?', [parsed.data.group_id]);
    if (!group) throw new NotFoundError('Group not found');
    if (group.slug === 'admin') throw new ForbiddenError('Cannot assign admin group via this endpoint');
    await execute('UPDATE users SET group_id=? WHERE id=?', [parsed.data.group_id, userId]);
    await audit(req.user.id, 'change_group', 'user', userId, { new_group_id: parsed.data.group_id });
    return reply.send({ ok: true });
  });

  // 10d — Helpdesk
  app.get('/api/staff/helpdesk/tickets', { preHandler: pre }, async (req, reply) => {
    const status = (req.query as { status?: string }).status ?? 'open';
    const priority = (req.query as { priority?: string }).priority;
    let sql = `SELECT t.id, t.subject, t.category, t.status, t.priority, t.created_at,
               u.username FROM helpdesk_tickets t JOIN users u ON u.id=t.user_id WHERE t.status=?`;
    const params: (string | number)[] = [status];
    if (priority) { sql += ' AND t.priority=?'; params.push(priority); }
    sql += ' ORDER BY t.created_at DESC LIMIT 50';
    return reply.send({ tickets: await query(sql, params) });
  });

  app.get<{ Params: { id: string } }>('/api/staff/helpdesk/tickets/:id', { preHandler: pre }, async (req, reply) => {
    const ticketId = parseInt(req.params.id, 10);
    const ticket = await queryOne('SELECT t.*, u.username FROM helpdesk_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', [ticketId]);
    if (!ticket) throw new NotFoundError('Ticket not found');
    const replies = await query(
      'SELECT r.*, u.username FROM helpdesk_replies r JOIN users u ON u.id=r.user_id WHERE r.ticket_id=? ORDER BY r.created_at ASC',
      [ticketId],
    );
    return reply.send({ ticket, replies });
  });

  app.post<{ Params: { id: string } }>('/api/staff/helpdesk/tickets/:id/reply', { preHandler: pre }, async (req, reply) => {
    const ticketId = parseInt(req.params.id, 10);
    const parsed = z.object({ body: z.string().min(1).max(5000) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Body required');
    const ticket = await queryOne<{ id: number; user_id: number }>('SELECT id, user_id FROM helpdesk_tickets WHERE id=?', [ticketId]);
    if (!ticket) throw new NotFoundError('Ticket not found');
    await execute('INSERT INTO helpdesk_replies (ticket_id, user_id, body, is_staff) VALUES (?,?,?,TRUE)', [ticketId, req.user.id, parsed.data.body]);
    await execute("UPDATE helpdesk_tickets SET status='in_progress', updated_at=NOW() WHERE id=?", [ticketId]);
    void jobsQueue.add('send-notif', { user_id: ticket.user_id, title: 'Helpdesk Reply', body: 'Staff replied to your ticket.', url: '/support' });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/helpdesk/tickets/:id/status', { preHandler: pre }, async (req, reply) => {
    const ticketId = parseInt(req.params.id, 10);
    const parsed = z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid status');
    await execute('UPDATE helpdesk_tickets SET status=?, updated_at=NOW() WHERE id=?', [parsed.data.status, ticketId]);
    return reply.send({ ok: true });
  });

  // 10e — Reports
  app.get('/api/staff/reports', { preHandler: pre }, async (req, reply) => {
    const status = (req.query as { status?: string }).status ?? 'pending';
    const rows = await query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
              u.username AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id
       WHERE r.status=? ORDER BY r.created_at DESC LIMIT 100`,
      [status],
    );
    return reply.send({ reports: rows });
  });

  app.post<{ Params: { id: string } }>('/api/staff/reports/:id/resolve', { preHandler: pre }, async (req, reply) => {
    await execute("UPDATE reports SET status='resolved', resolved_by=? WHERE id=?", [req.user.id, parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/reports/:id/dismiss', { preHandler: pre }, async (req, reply) => {
    await execute("UPDATE reports SET status='dismissed', resolved_by=? WHERE id=?", [req.user.id, parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10f — DMCA (public submit + staff actions)
  app.post('/api/dmca', async (req, reply) => {
    const parsed = z.object({
      torrent_id: z.number().int().positive().optional(),
      claimant_name: z.string().min(1).max(255),
      claimant_email: z.string().email().max(255),
      description: z.string().min(10).max(10000),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute(
      'INSERT INTO dmca_notices (torrent_id, claimant_name, claimant_email, description) VALUES (?,?,?,?)',
      [parsed.data.torrent_id ?? null, parsed.data.claimant_name, parsed.data.claimant_email, parsed.data.description],
    );
    return reply.status(201).send({ ok: true });
  });

  app.get('/api/staff/dmca', { preHandler: pre }, async (_req, reply) => {
    const rows = await query(
      `SELECT d.id, d.torrent_id, t.name AS torrent_name, d.claimant_name,
              d.claimant_email, d.description, d.status, d.created_at
       FROM dmca_notices d LEFT JOIN torrents t ON t.id=d.torrent_id
       ORDER BY d.created_at DESC LIMIT 100`,
    );
    return reply.send({ notices: rows });
  });

  app.post<{ Params: { id: string } }>('/api/staff/dmca/:id/action', { preHandler: pre }, async (req, reply) => {
    const noticeId = parseInt(req.params.id, 10);
    const notice = await queryOne<{ id: number; torrent_id: number | null }>(
      'SELECT id, torrent_id FROM dmca_notices WHERE id=?', [noticeId],
    );
    if (!notice) throw new NotFoundError('DMCA notice not found');

    if (notice.torrent_id) {
      const torrent = await queryOne<{ info_hash: string; uploader_id: number }>(
        'SELECT info_hash, uploader_id FROM torrents WHERE id=?', [notice.torrent_id],
      );
      if (torrent) {
        await execute("UPDATE torrents SET status='takedown' WHERE id=?", [notice.torrent_id]);
        void deleteFile(`torrents/${torrent.info_hash}.torrent`);
        void jobsQueue.add('send-notif', {
          user_id: torrent.uploader_id,
          title: 'Torrent Removed (DMCA)',
          body: 'Your torrent was removed due to a DMCA notice.',
          url: '/support',
        });
      }
    }
    await execute("UPDATE dmca_notices SET status='actioned', actioned_by=?, actioned_at=NOW() WHERE id=?", [req.user.id, noticeId]);
    await audit(req.user.id, 'dmca_action', 'torrent', notice.torrent_id, { notice_id: noticeId });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/staff/dmca/:id/dismiss', { preHandler: pre }, async (req, reply) => {
    await execute("UPDATE dmca_notices SET status='dismissed', actioned_by=?, actioned_at=NOW() WHERE id=?", [req.user.id, parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10h — Audit log
  app.get('/api/staff/logs', { preHandler: pre }, async (req, reply) => {
    const page = Math.max(1, parseInt(((req.query as { page?: string }).page ?? '1'), 10));
    const offset = (page - 1) * 50;
    const rows = await query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.metadata, l.created_at,
              u.username FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id
       ORDER BY l.created_at DESC LIMIT 50 OFFSET ?`,
      [offset],
    );
    return reply.send({ logs: rows, page });
  });
};
