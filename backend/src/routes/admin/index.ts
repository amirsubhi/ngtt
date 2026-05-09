import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate, requireAdmin, requireStaff } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../lib/errors';

async function audit(userId: number, action: string, meta?: object): Promise<void> {
  await execute(
    'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
    [userId, action, meta ? JSON.stringify(meta) : null],
  );
}

export const adminRoutes: FastifyPluginAsync = async app => {
  const preAdmin = [authenticate, requireAdmin];

  // 10i — Site settings
  app.get('/api/admin/settings', { preHandler: preAdmin }, async (_req, reply) => {
    const rows = await query('SELECT `key`, value, type, category, label FROM site_settings ORDER BY category, `key`');
    return reply.send({ settings: rows });
  });

  app.put('/api/admin/settings', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({ key: z.string().min(1), value: z.string() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('key and value required');
    const setting = await queryOne<{ key: string }>('SELECT `key` FROM site_settings WHERE `key`=?', [parsed.data.key]);
    if (!setting) throw new NotFoundError('Setting not found');
    await execute('UPDATE site_settings SET value=? WHERE `key`=?', [parsed.data.value, parsed.data.key]);
    await audit(req.user.id, 'setting_update', { key: parsed.data.key, value: parsed.data.value });
    return reply.send({ ok: true });
  });

  // 10j — Flux store management
  app.get('/api/admin/flux-store', { preHandler: preAdmin }, async (_req, reply) => {
    const rows = await query('SELECT * FROM flux_store_items ORDER BY display_order');
    return reply.send({ items: rows });
  });

  app.post('/api/admin/flux-store', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      cost: z.number().positive(),
      type: z.enum(['invite_token', 'freeleech_token', 'upload_credit', 'username_change']),
      value: z.number().int().nonnegative().default(1),
      display_order: z.number().int().default(0),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute(
      'INSERT INTO flux_store_items (name, description, cost, type, value, display_order) VALUES (?,?,?,?,?,?)',
      [parsed.data.name, parsed.data.description ?? null, parsed.data.cost, parsed.data.type, parsed.data.value, parsed.data.display_order],
    );
    return reply.status(201).send({ ok: true });
  });

  app.put<{ Params: { id: string } }>('/api/admin/flux-store/:id', { preHandler: preAdmin }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      cost: z.number().positive().optional(),
      is_active: z.boolean().optional(),
      display_order: z.number().int().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');
    const { name, description, cost, is_active, display_order } = parsed.data;
    if (name !== undefined) await execute('UPDATE flux_store_items SET name=? WHERE id=?', [name, id]);
    if (description !== undefined) await execute('UPDATE flux_store_items SET description=? WHERE id=?', [description, id]);
    if (cost !== undefined) await execute('UPDATE flux_store_items SET cost=? WHERE id=?', [cost, id]);
    if (is_active !== undefined) await execute('UPDATE flux_store_items SET is_active=? WHERE id=?', [is_active, id]);
    if (display_order !== undefined) await execute('UPDATE flux_store_items SET display_order=? WHERE id=?', [display_order, id]);
    return reply.send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/flux-store/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM flux_store_items WHERE id=?', [parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10l — Categories
  app.get('/api/admin/categories', { preHandler: [authenticate, requireStaff] }, async (_req, reply) => {
    return reply.send({ categories: await query('SELECT * FROM categories ORDER BY display_order') });
  });

  app.post('/api/admin/categories', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
      icon: z.string().max(50).optional(),
      display_order: z.number().int().default(0),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute(
      'INSERT INTO categories (name, slug, icon, display_order) VALUES (?,?,?,?)',
      [parsed.data.name, parsed.data.slug, parsed.data.icon ?? null, parsed.data.display_order],
    );
    return reply.status(201).send({ ok: true });
  });

  app.put<{ Params: { id: string } }>('/api/admin/categories/:id', { preHandler: preAdmin }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = z.object({ name: z.string().optional(), icon: z.string().optional(), display_order: z.number().int().optional(), is_active: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');
    if (parsed.data.name) await execute('UPDATE categories SET name=? WHERE id=?', [parsed.data.name, id]);
    if (parsed.data.icon !== undefined) await execute('UPDATE categories SET icon=? WHERE id=?', [parsed.data.icon, id]);
    if (parsed.data.display_order !== undefined) await execute('UPDATE categories SET display_order=? WHERE id=?', [parsed.data.display_order, id]);
    if (parsed.data.is_active !== undefined) await execute('UPDATE categories SET is_active=? WHERE id=?', [parsed.data.is_active, id]);
    return reply.send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/categories/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM categories WHERE id=?', [parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10l — Tags
  app.get('/api/admin/tags', { preHandler: [authenticate, requireStaff] }, async (_req, reply) => {
    return reply.send({ tags: await query('SELECT * FROM tags ORDER BY usage_count DESC') });
  });

  app.post('/api/admin/tags', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      name: z.string().min(1).max(50),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute('INSERT INTO tags (name, slug, color, created_by) VALUES (?,?,?,?)',
      [parsed.data.name, parsed.data.slug, parsed.data.color, req.user.id]);
    return reply.status(201).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/tags/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM tags WHERE id=?', [parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10m — Client blacklist
  app.get('/api/admin/clients', { preHandler: [authenticate, requireStaff] }, async (_req, reply) => {
    return reply.send({ clients: await query('SELECT b.*, u.username AS added_by_username FROM banned_clients b LEFT JOIN users u ON u.id=b.added_by ORDER BY b.created_at DESC') });
  });

  app.post('/api/admin/clients', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      peer_id_prefix: z.string().length(8),
      client_name: z.string().min(1).max(100),
      reason: z.string().max(500).optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute('INSERT INTO banned_clients (peer_id_prefix, client_name, reason, added_by) VALUES (?,?,?,?)',
      [parsed.data.peer_id_prefix, parsed.data.client_name, parsed.data.reason ?? null, req.user.id]);
    return reply.status(201).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/clients/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM banned_clients WHERE id=?', [parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });

  // 10n — IP bans
  app.get('/api/admin/ip-bans', { preHandler: [authenticate, requireStaff] }, async (_req, reply) => {
    return reply.send({ bans: await query('SELECT b.*, u.username AS banned_by_username FROM ip_bans b LEFT JOIN users u ON u.id=b.banned_by ORDER BY b.created_at DESC') });
  });

  app.post('/api/admin/ip-bans', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      ip_address: z.string().min(7).max(50),
      reason: z.string().max(500).optional(),
      expires_at: z.string().datetime().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute('INSERT INTO ip_bans (ip_address, reason, banned_by, expires_at) VALUES (?,?,?,?)',
      [parsed.data.ip_address, parsed.data.reason ?? null, req.user.id, parsed.data.expires_at ?? null]);
    return reply.status(201).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/ip-bans/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM ip_bans WHERE id=?', [parseInt(req.params.id, 10)]);
    return reply.send({ ok: true });
  });
};
