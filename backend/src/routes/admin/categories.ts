import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { redis } from '../../lib/redis';
import { NotFoundError, ValidationError } from '../../lib/errors';

const preAdmin = [authenticate, requireAdmin];
const CACHE_KEY = 'categories:enabled';

const CategoryBody = z.object({
  label:          z.string().min(1).max(128).optional(),
  slug:           z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
  icon:           z.string().max(8).optional(),
  color:          z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder:      z.number().int().optional(),
  enabled:        z.boolean().optional(),
  uploadMinGroup: z.enum(['user', 'power', 'staff']).optional(),
  browseMinGroup: z.enum(['all', 'user', 'power', 'staff']).optional(),
  subcats:        z.array(z.string()).optional(),
});

const CreateBody = CategoryBody.required({ label: true, slug: true });

interface CatWithCount {
  id: number;
  slug: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  enabled: number;
  upload_min_group: string;
  browse_min_group: string;
  subcats: string | string[];
  created_at: string;
  torrentCount: number;
}

function parseSubcats(v: string | string[]): string[] {
  return Array.isArray(v) ? v : JSON.parse(v ?? '[]') as string[];
}

async function invalidateCache(): Promise<void> {
  await redis.del(CACHE_KEY);
}

export async function adminCategoriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', { preHandler: preAdmin }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const rows = await query<CatWithCount>(`
      SELECT c.*, COUNT(t.id) AS torrentCount
      FROM categories c
      LEFT JOIN torrents t ON t.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order
    `);
    return reply.send(rows.map(r => ({
      id: r.id, slug: r.slug, label: r.label, icon: r.icon, color: r.color,
      sortOrder: r.sort_order, enabled: r.enabled === 1,
      uploadMinGroup: r.upload_min_group, browseMinGroup: r.browse_min_group,
      subcats: parseSubcats(r.subcats),
      createdAt: r.created_at, torrentCount: Number(r.torrentCount),
    })));
  });

  app.post('/categories', { preHandler: preAdmin }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { label, slug, icon, color, sortOrder, uploadMinGroup, browseMinGroup, subcats } = parsed.data;

    const existing = await queryOne('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existing) throw new ValidationError('Slug already in use');

    await execute(
      `INSERT INTO categories (label, slug, icon, color, sort_order, upload_min_group, browse_min_group, subcats)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        label,
        slug,
        icon ?? '📁',
        color ?? '#6c63ff',
        sortOrder ?? 0,
        uploadMinGroup ?? 'power',
        browseMinGroup ?? 'all',
        JSON.stringify(subcats ?? []),
      ],
    );
    await invalidateCache();
    return reply.status(201).send({ ok: true });
  });

  // MUST come before /:id to avoid "reorder" matching as id param
  app.patch('/categories/reorder', { preHandler: preAdmin }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({
      items: z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })).min(1),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('items must be an array of {id, sortOrder}');

    const { items } = parsed.data;
    const ids = items.map(i => i.id);
    const cases = items.map(() => 'WHEN id = ? THEN ?').join(' ');
    const params: number[] = [];
    items.forEach(i => params.push(i.id, i.sortOrder));
    params.push(...ids);
    const placeholders = ids.map(() => '?').join(',');

    await execute(
      `UPDATE categories SET sort_order = CASE ${cases} END WHERE id IN (${placeholders})`,
      params,
    );
    await invalidateCache();
    return reply.send({ ok: true });
  });

  app.patch<{ Params: { id: string } }>('/categories/:id', { preHandler: preAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = CategoryBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const existing = await queryOne('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) throw new NotFoundError('Category not found');

    const d = parsed.data;
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (d.label !== undefined)          { sets.push('label = ?');           vals.push(d.label); }
    if (d.slug !== undefined)           { sets.push('slug = ?');            vals.push(d.slug); }
    if (d.icon !== undefined)           { sets.push('icon = ?');            vals.push(d.icon); }
    if (d.color !== undefined)          { sets.push('color = ?');           vals.push(d.color); }
    if (d.sortOrder !== undefined)      { sets.push('sort_order = ?');      vals.push(d.sortOrder); }
    if (d.enabled !== undefined)        { sets.push('enabled = ?');         vals.push(d.enabled ? 1 : 0); }
    if (d.uploadMinGroup !== undefined) { sets.push('upload_min_group = ?'); vals.push(d.uploadMinGroup); }
    if (d.browseMinGroup !== undefined) { sets.push('browse_min_group = ?'); vals.push(d.browseMinGroup); }
    if (d.subcats !== undefined)        { sets.push('subcats = ?');          vals.push(JSON.stringify(d.subcats)); }
    if (sets.length > 0) await execute(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);

    await invalidateCache();
    return reply.send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>('/categories/:id', { preHandler: preAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(req.params.id, 10);
    const row = await queryOne<{ torrentCount: number }>(
      'SELECT COUNT(*) AS torrentCount FROM torrents WHERE category_id = ?',
      [id],
    );
    const count = Number(row?.torrentCount ?? 0);
    if (count > 0) {
      return reply.status(409).send({
        error: 'CATEGORY_HAS_TORRENTS',
        message: `This category has ${count} torrent${count === 1 ? '' : 's'}. Migrate or delete them first.`,
      });
    }
    await execute('DELETE FROM categories WHERE id = ?', [id]);
    await invalidateCache();
    return reply.send({ ok: true });
  });
}
