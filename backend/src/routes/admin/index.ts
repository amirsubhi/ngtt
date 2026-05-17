import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate, requireAdmin, requireStaff } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { redis } from '../../lib/redis';
import { invalidateBadWordsCache } from '../../lib/badwords';

async function audit(userId: number, action: string, meta?: object): Promise<void> {
  await execute(
    'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
    [userId, action, meta ? JSON.stringify(meta) : null],
  );
}

export const adminRoutes: FastifyPluginAsync = async app => {
  const preAdmin = [authenticate, requireAdmin];

  const UPLOADS_DIR = path.join(process.cwd(), '..', 'uploads', 'branding');
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  // 10i — Site settings
  app.get('/api/admin/settings', { preHandler: preAdmin }, async (_req, reply) => {
    const rows = await query('SELECT `key`, value, type, `group` AS category, label FROM site_settings ORDER BY `group`, `key`');
    return reply.send({ settings: rows });
  });

  app.put('/api/admin/settings', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({ key: z.string().min(1), value: z.string() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('key and value required');
    const setting = await queryOne<{ key: string }>('SELECT `key` FROM site_settings WHERE `key`=?', [parsed.data.key]);
    if (!setting) throw new NotFoundError('Setting not found');
    await execute('UPDATE site_settings SET value=? WHERE `key`=?', [parsed.data.value, parsed.data.key]);
    await audit(req.user.id, 'setting_update', { key: parsed.data.key, value: parsed.data.value });
    void redis.del('public:settings').catch(() => {});
    if (parsed.data.key === 'bad_words') void invalidateBadWordsCache().catch(() => {});
    return reply.send({ ok: true });
  });

  // Apply site defaults to all users
  const VALID_THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand', 'cobalt'];
  const VALID_LOCALES = ['en', 'zh-CN', 'es', 'pt-BR', 'ar', 'ms-MY'];

  app.post('/api/admin/settings/apply-defaults', { preHandler: preAdmin }, async (req, reply) => {
    const [themeRow, localeRow] = await Promise.all([
      queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key`=?', ['default_theme']),
      queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key`=?', ['default_locale']),
    ]);
    const theme = themeRow?.value ?? '';
    const locale = localeRow?.value ?? '';
    if (VALID_THEMES.includes(theme)) {
      await execute('UPDATE users SET theme = ? WHERE is_deleted = FALSE', [theme]);
    }
    if (VALID_LOCALES.includes(locale)) {
      await execute('UPDATE users SET locale = ? WHERE is_deleted = FALSE', [locale]);
    }
    await audit(req.user.id, 'apply_defaults', { theme, locale });
    void redis.del('public:settings').catch(() => {});
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
    void redis.del('flux:store').catch(() => {});
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
    void redis.del('flux:store').catch(() => {});
    return reply.send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/flux-store/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM flux_store_items WHERE id=?', [parseInt(req.params.id, 10)]);
    void redis.del('flux:store').catch(() => {});
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

  // Branding uploads
  app.post('/api/admin/upload/logo', { preHandler: preAdmin }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw new ValidationError('No file provided');
    if (file.mimetype === 'image/svg+xml') throw new ValidationError('SVG not allowed');
    const buf = await file.toBuffer();
    const webp = await sharp(buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (webp.byteLength > 200 * 1024) throw new ValidationError('Logo exceeds 200 KB after conversion');
    await fs.writeFile(path.join(UPLOADS_DIR, 'logo.webp'), webp);
    const url = '/uploads/branding/logo.webp';
    await execute('UPDATE site_settings SET value=? WHERE `key`=?', [url, 'site_logo_url']);
    await audit(req.user.id, 'setting_update', { key: 'site_logo_url', value: url });
    void redis.del('public:settings').catch(() => {});
    return reply.send({ ok: true, url });
  });

  app.post('/api/admin/upload/favicon', { preHandler: preAdmin }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw new ValidationError('No file provided');
    if (file.mimetype === 'image/svg+xml') throw new ValidationError('SVG not allowed');
    const buf = await file.toBuffer();
    const webp = await sharp(buf).resize({ width: 64, height: 64, fit: 'contain' }).webp({ quality: 90 }).toBuffer();
    if (webp.byteLength > 50 * 1024) throw new ValidationError('Favicon exceeds 50 KB after conversion');
    await fs.writeFile(path.join(UPLOADS_DIR, 'favicon.webp'), webp);
    const url = '/uploads/branding/favicon.webp';
    await execute('UPDATE site_settings SET value=? WHERE `key`=?', [url, 'site_favicon_url']);
    await audit(req.user.id, 'setting_update', { key: 'site_favicon_url', value: url });
    void redis.del('public:settings').catch(() => {});
    return reply.send({ ok: true, url });
  });

  // Upload events (double upload, global freeleech)
  app.get('/api/admin/events', { preHandler: preAdmin }, async (_req, reply) => {
    const events = await query(
      'SELECT e.*, u.username AS created_by_username FROM upload_events e LEFT JOIN users u ON u.id=e.created_by ORDER BY e.starts_at DESC LIMIT 50',
    );
    return reply.send({ events });
  });

  app.post('/api/admin/events', { preHandler: preAdmin }, async (req, reply) => {
    const parsed = z.object({
      name:      z.string().min(1).max(100),
      type:      z.enum(['double_upload', 'freeleech_global']),
      starts_at: z.string().datetime(),
      ends_at:   z.string().datetime(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    if (parsed.data.ends_at <= parsed.data.starts_at) throw new ValidationError('ends_at must be after starts_at');
    await execute(
      'INSERT INTO upload_events (name, type, starts_at, ends_at, created_by) VALUES (?,?,?,?,?)',
      [parsed.data.name, parsed.data.type, parsed.data.starts_at, parsed.data.ends_at, req.user.id],
    );
    await audit(req.user.id, 'event_create', { name: parsed.data.name, type: parsed.data.type });
    return reply.status(201).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/api/admin/events/:id', { preHandler: preAdmin }, async (req, reply) => {
    await execute('DELETE FROM upload_events WHERE id=?', [parseInt(req.params.id, 10)]);
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
