import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, executeInsert, execute } from '../../lib/db';
import { authenticate, requireStaff } from '../../middleware/auth';
import { requireFeature } from '../../middleware/featureFlag';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import { jobsQueue } from '../../lib/queues';

const PAGE_SIZE = 25;

async function renderMarkdown(text: string): Promise<string> {
  const { marked } = await import('marked');
  const html = await marked.parse(text, { async: false }) as string;
  // Strip dangerous tags — allow only safe subset
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '');
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200)
    + '-' + Date.now();
}

export const forumRoutes: FastifyPluginAsync = async app => {
  const ff = requireFeature('forum_enabled');

  // GET /api/forum/categories
  app.get('/api/forum/categories', { preHandler: [ff] }, async (_req, reply) => {
    const categories = await query(
      `SELECT id, name, slug, description, display_order, topic_count, post_count
       FROM forum_categories
       WHERE is_staff_only = FALSE
       ORDER BY display_order ASC`,
    );
    return reply.send({ categories });
  });

  // GET /api/forum/categories/:slug/topics
  app.get<{ Params: { slug: string }; Querystring: { page?: string } }>(
    '/api/forum/categories/:slug/topics',
    { preHandler: [ff] },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const page = Math.max(1, parseInt((req.query as { page?: string }).page ?? '1', 10));
      const offset = (page - 1) * PAGE_SIZE;

      const cat = await queryOne<{ id: number; name: string }>('SELECT id, name FROM forum_categories WHERE slug = ?', [slug]);
      if (!cat) throw new NotFoundError('Category not found');

      const topics = await query(
        `SELECT ft.id, ft.title, ft.slug, ft.is_pinned, ft.is_locked, ft.views,
                ft.reply_count, ft.created_at, ft.last_reply_at,
                u.username AS author, u2.username AS last_reply_by_username
         FROM forum_topics ft
         JOIN users u ON u.id = ft.user_id
         LEFT JOIN users u2 ON u2.id = ft.last_reply_by
         WHERE ft.category_id = ?
         ORDER BY ft.is_pinned DESC, ft.last_reply_at DESC
         LIMIT ? OFFSET ?`,
        [cat.id, PAGE_SIZE, offset],
      );
      return reply.send({ category: cat, topics, page, page_size: PAGE_SIZE });
    },
  );

  // GET /api/forum/topics/:id
  app.get<{ Params: { id: string }; Querystring: { page?: string } }>(
    '/api/forum/topics/:id',
    { preHandler: [ff] },
    async (req, reply) => {
      const topicId = parseInt((req.params as { id: string }).id, 10);
      const page = Math.max(1, parseInt((req.query as { page?: string }).page ?? '1', 10));
      const offset = (page - 1) * PAGE_SIZE;

      const topic = await queryOne(
        `SELECT ft.*, u.username AS author FROM forum_topics ft
         JOIN users u ON u.id = ft.user_id WHERE ft.id = ?`,
        [topicId],
      );
      if (!topic) throw new NotFoundError('Topic not found');

      void execute('UPDATE forum_topics SET views = views + 1 WHERE id = ?', [topicId]).catch(() => {});

      const rawPosts = await query<{ id: number; body: string; username: string; created_at: string; edited_at: string | null }>(
        `SELECT fp.id, fp.body, fp.created_at, fp.edited_at, u.username, u.avatar_url, u.uploaded, u.downloaded
         FROM forum_posts fp
         JOIN users u ON u.id = fp.user_id
         WHERE fp.topic_id = ?
         ORDER BY fp.created_at ASC
         LIMIT ? OFFSET ?`,
        [topicId, PAGE_SIZE, offset],
      );

      const posts = await Promise.all(rawPosts.map(async p => ({ ...p, body: await renderMarkdown(p.body) })));
      return reply.send({ topic, posts, page, page_size: PAGE_SIZE });
    },
  );

  // POST /api/forum/categories/:slug/topics
  app.post<{ Params: { slug: string } }>(
    '/api/forum/categories/:slug/topics',
    { preHandler: [ff, authenticate] },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const body = z.object({ title: z.string().min(3).max(500), body: z.string().min(1).max(50000) }).safeParse(req.body);
      if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Invalid');

      const cat = await queryOne<{ id: number }>('SELECT id FROM forum_categories WHERE slug = ?', [slug]);
      if (!cat) throw new NotFoundError('Category not found');

      const topicSlug = slugify(body.data.title);
      const topicId = await executeInsert(
        'INSERT INTO forum_topics (category_id, user_id, title, slug) VALUES (?, ?, ?, ?)',
        [cat.id, req.user.id, body.data.title, topicSlug],
      );
      await executeInsert(
        'INSERT INTO forum_posts (topic_id, user_id, body) VALUES (?, ?, ?)',
        [topicId, req.user.id, body.data.body],
      );
      void execute('UPDATE forum_categories SET topic_count = topic_count + 1 WHERE id = ?', [cat.id]).catch(() => {});

      return reply.status(201).send({ id: topicId, slug: topicSlug });
    },
  );

  // POST /api/forum/topics/:id/posts
  app.post<{ Params: { id: string } }>(
    '/api/forum/topics/:id/posts',
    { preHandler: [ff, authenticate] },
    async (req, reply) => {
      const topicId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({ body: z.string().min(1).max(50000) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid');

      const topic = await queryOne<{ id: number; user_id: number; is_locked: boolean }>(
        'SELECT id, user_id, is_locked FROM forum_topics WHERE id = ?', [topicId],
      );
      if (!topic) throw new NotFoundError('Topic not found');
      if (topic.is_locked && !req.user.is_staff) throw new ForbiddenError('Topic is locked');

      const postId = await executeInsert(
        'INSERT INTO forum_posts (topic_id, user_id, body) VALUES (?, ?, ?)',
        [topicId, req.user.id, parsed.data.body],
      );
      void execute(
        'UPDATE forum_topics SET reply_count = reply_count + 1, last_reply_at = NOW(), last_reply_by = ? WHERE id = ?',
        [req.user.id, topicId],
      ).catch(() => {});

      // Notify topic author
      if (topic.user_id !== req.user.id) {
        void jobsQueue.add('send-notif', {
          user_id: topic.user_id,
          title: 'New reply in your topic',
          body: `${req.user.username} replied to your forum topic`,
          url: `/forum/topic/${topicId}`,
        });
      }

      return reply.status(201).send({ id: postId });
    },
  );

  // PUT /api/forum/posts/:id
  app.put<{ Params: { id: string } }>(
    '/api/forum/posts/:id',
    { preHandler: [ff, authenticate] },
    async (req, reply) => {
      const postId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({ body: z.string().min(1).max(50000) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid');

      const post = await queryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM forum_posts WHERE id = ?', [postId],
      );
      if (!post) throw new NotFoundError('Post not found');
      if (post.user_id !== req.user.id && !req.user.is_staff) throw new ForbiddenError('Cannot edit this post');

      await execute(
        'UPDATE forum_posts SET body = ?, edited_at = NOW(), edited_by = ? WHERE id = ?',
        [parsed.data.body, req.user.id, postId],
      );
      return reply.send({ ok: true });
    },
  );

  // DELETE /api/forum/topics/:id (staff only)
  app.delete<{ Params: { id: string } }>(
    '/api/forum/topics/:id',
    { preHandler: [ff, authenticate, requireStaff] },
    async (req, reply) => {
      const topicId = parseInt((req.params as { id: string }).id, 10);
      await execute('DELETE FROM forum_topics WHERE id = ?', [topicId]);
      return reply.send({ ok: true });
    },
  );

  // PATCH /api/forum/topics/:id (staff: pin/lock)
  app.patch<{ Params: { id: string } }>(
    '/api/forum/topics/:id',
    { preHandler: [ff, authenticate, requireStaff] },
    async (req, reply) => {
      const topicId = parseInt((req.params as { id: string }).id, 10);
      const parsed = z.object({ is_pinned: z.boolean().optional(), is_locked: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Invalid');
      const { is_pinned, is_locked } = parsed.data;
      if (is_pinned !== undefined) await execute('UPDATE forum_topics SET is_pinned = ? WHERE id = ?', [is_pinned, topicId]);
      if (is_locked !== undefined) await execute('UPDATE forum_topics SET is_locked = ? WHERE id = ?', [is_locked, topicId]);
      return reply.send({ ok: true });
    },
  );
};
