import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, executeInsert, execute } from '../../lib/db';
import { authenticate, requireStaff } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../lib/errors';

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 250)
    + '-' + Date.now();
}

export const newsRoutes: FastifyPluginAsync = async app => {
  // GET /api/news
  app.get('/api/news', async (req, reply) => {
    const page = Math.max(1, parseInt(((req.query as { page?: string }).page ?? '1'), 10));
    const offset = (page - 1) * 10;
    const items = await query(
      `SELECT n.id, n.title, n.slug, n.is_pinned, n.published_at, u.username AS author
       FROM news n JOIN users u ON u.id = n.author_id
       ORDER BY n.is_pinned DESC, n.published_at DESC
       LIMIT 10 OFFSET ?`,
      [offset],
    );
    return reply.send({ news: items, page });
  });

  // GET /api/news/:slug
  app.get<{ Params: { slug: string } }>('/api/news/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const item = await queryOne(
      `SELECT n.*, u.username AS author FROM news n JOIN users u ON u.id = n.author_id WHERE n.slug = ?`,
      [slug],
    );
    if (!item) throw new NotFoundError('News article not found');
    return reply.send(item);
  });

  // POST /api/news (staff only)
  app.post('/api/news', { preHandler: [authenticate, requireStaff] }, async (req, reply) => {
    const parsed = z.object({
      title: z.string().min(3).max(255),
      body: z.string().min(1),
      is_pinned: z.boolean().default(false),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid');

    const { title, body, is_pinned } = parsed.data;
    const slug = slugify(title);
    const id = await executeInsert(
      'INSERT INTO news (title, slug, body, author_id, is_pinned) VALUES (?, ?, ?, ?, ?)',
      [title, slug, body, req.user.id, is_pinned],
    );
    return reply.status(201).send({ id, slug });
  });

  // PUT /api/news/:id (staff only)
  app.put<{ Params: { id: string } }>(
    '/api/news/:id',
    { preHandler: [authenticate, requireStaff] },
    async (req, reply) => {
      const newsId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({
        title: z.string().min(3).max(255).optional(),
        body: z.string().min(1).optional(),
        is_pinned: z.boolean().optional(),
      }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Invalid');
      const { title, body, is_pinned } = parsed.data;
      if (title) await execute('UPDATE news SET title = ? WHERE id = ?', [title, newsId]);
      if (body) await execute('UPDATE news SET body = ? WHERE id = ?', [body, newsId]);
      if (is_pinned !== undefined) await execute('UPDATE news SET is_pinned = ? WHERE id = ?', [is_pinned, newsId]);
      return reply.send({ ok: true });
    },
  );

  // GET /api/pages/:slug
  app.get<{ Params: { slug: string } }>('/api/pages/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const page = await queryOne(
      'SELECT title, slug, body FROM custom_pages WHERE slug = ? AND is_published = TRUE', [slug],
    );
    if (!page) throw new NotFoundError('Page not found');
    return reply.send(page);
  });

  // POST /api/admin/pages (admin only)
  app.post('/api/admin/pages', { preHandler: [authenticate, requireStaff] }, async (req, reply) => {
    const parsed = z.object({
      title: z.string().min(1).max(255),
      slug: z.string().min(1).max(300),
      body: z.string(),
      show_in_nav: z.boolean().default(false),
      display_order: z.number().default(0),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid');
    const { title, slug, body, show_in_nav, display_order } = parsed.data;
    const id = await executeInsert(
      'INSERT INTO custom_pages (title, slug, body, show_in_nav, display_order, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, body, show_in_nav, display_order, req.user.id],
    );
    return reply.status(201).send({ id });
  });

  // PUT /api/admin/pages/:id
  app.put<{ Params: { id: string } }>(
    '/api/admin/pages/:id',
    { preHandler: [authenticate, requireStaff] },
    async (req, reply) => {
      const pageId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({ title: z.string().optional(), body: z.string().optional(), is_published: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Invalid');
      const { title, body, is_published } = parsed.data;
      if (title) await execute('UPDATE custom_pages SET title = ? WHERE id = ?', [title, pageId]);
      if (body) await execute('UPDATE custom_pages SET body = ? WHERE id = ?', [body, pageId]);
      if (is_published !== undefined) await execute('UPDATE custom_pages SET is_published = ? WHERE id = ?', [is_published, pageId]);
      return reply.send({ ok: true });
    },
  );
};
