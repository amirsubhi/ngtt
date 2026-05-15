import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../lib/db';
import { authenticate } from '../middleware/auth';
import { redis } from '../lib/redis';

const STATS_CACHE_KEY = 'site:stats';
const STATS_TTL = 300; // 5 minutes

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats', { preHandler: [authenticate] }, async (_req, reply) => {
    const cached = await redis.get(STATS_CACHE_KEY);
    if (cached) return reply.send(JSON.parse(cached) as object);

    const [totals, topUploaders, topSnatched, topRatio] = await Promise.all([
      // Site totals
      queryOne<{ total_torrents: number; total_users: number; total_size: string }>(
        `SELECT
           (SELECT COUNT(*) FROM torrents WHERE status = 'approved') AS total_torrents,
           (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE AND is_banned = FALSE) AS total_users,
           (SELECT COALESCE(SUM(size), 0) FROM torrents WHERE status = 'approved') AS total_size`,
      ),

      // Top 10 uploaders by data volume
      query<{ username: string; uploaded: number; upload_count: number }>(
        `SELECT u.username, u.uploaded, COUNT(t.id) AS upload_count
         FROM users u
         LEFT JOIN torrents t ON t.uploader_id = u.id AND t.status = 'approved'
         WHERE u.is_deleted = FALSE AND u.is_banned = FALSE
         GROUP BY u.id, u.username, u.uploaded
         ORDER BY u.uploaded DESC
         LIMIT 10`,
      ),

      // Top 10 most snatched torrents
      query<{ id: number; name: string; slug: string; download_count: number; category_label: string; category_icon: string }>(
        `SELECT t.id, t.name, t.slug, t.download_count, c.label AS category_label, c.icon AS category_icon
         FROM torrents t JOIN categories c ON c.id = t.category_id
         WHERE t.status = 'approved'
         ORDER BY t.download_count DESC
         LIMIT 10`,
      ),

      // Top 10 ratio holders (min 10 GB uploaded, non-staff)
      query<{ username: string; uploaded: number; downloaded: number }>(
        `SELECT u.username, u.uploaded, u.downloaded
         FROM users u
         JOIN user_groups g ON g.id = u.group_id
         WHERE u.is_deleted = FALSE AND u.is_banned = FALSE
           AND u.uploaded > 10737418240
           AND u.downloaded > 0
         ORDER BY (u.uploaded / u.downloaded) DESC
         LIMIT 10`,
      ),
    ]);

    const result = { totals, topUploaders, topSnatched, topRatio };
    await redis.set(STATS_CACHE_KEY, JSON.stringify(result), 'EX', STATS_TTL);
    return reply.send(result);
  });
}
