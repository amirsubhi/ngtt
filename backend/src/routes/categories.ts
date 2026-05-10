import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../lib/db';
import { authenticate } from '../middleware/auth';
import { redis } from '../lib/redis';
import { NotFoundError } from '../lib/errors';

const CACHE_KEY = 'categories:enabled';
const CACHE_TTL = 60;

interface CategoryRow {
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
}

function toCategory(row: CategoryRow) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    uploadMinGroup: row.upload_min_group,
    browseMinGroup: row.browse_min_group,
    subcats: Array.isArray(row.subcats) ? row.subcats : JSON.parse(row.subcats ?? '[]') as string[],
    createdAt: row.created_at,
  };
}

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/categories', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return reply.send(JSON.parse(cached));

    const rows = await query<CategoryRow>(
      'SELECT * FROM categories WHERE enabled = 1 ORDER BY sort_order',
    );
    const result = rows.map(toCategory);
    await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL);
    return reply.send(result);
  });

  app.get<{ Params: { slug: string } }>(
    '/api/categories/:slug',
    { preHandler: [authenticate] },
    async (req: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const row = await queryOne<CategoryRow>(
        'SELECT * FROM categories WHERE slug = ?',
        [req.params.slug],
      );
      if (!row) throw new NotFoundError('Category not found');
      return reply.send(toCategory(row));
    },
  );
}
