import { FastifyPluginAsync } from 'fastify';
import { query, queryOne } from '../lib/db';
import { redis } from '../lib/redis';

const HOME_CACHE_KEY = 'home:data';
const HOME_TTL = 60;

interface HomeNews {
  id: number;
  title: string;
  slug: string;
  published_at: string;
  author: string;
}

interface HomeBirthday {
  username: string;
  avatar_url: string | null;
}

interface HomeTopTorrent {
  id: number;
  name: string;
  slug: string;
  size: number;
  download_count: number;
  category: string;
}

export const homeRoutes: FastifyPluginAsync = async app => {
  app.get('/api/home', async (_req, reply) => {
    const cached = await redis.get(HOME_CACHE_KEY);
    if (cached) return reply.send(JSON.parse(cached) as object);

    const [stats, newsRows, birthdayRows, topTorrentRows] = await Promise.all([
      queryOne<{
        torrent_count: number;
        user_count: number;
        total_uploaded: number;
        total_downloaded: number;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM torrents WHERE status='approved') AS torrent_count,
          (SELECT COUNT(*) FROM users WHERE is_deleted=FALSE AND is_banned=FALSE) AS user_count,
          (SELECT COALESCE(SUM(uploaded),0) FROM users WHERE is_deleted=FALSE) AS total_uploaded,
          (SELECT COALESCE(SUM(downloaded),0) FROM users WHERE is_deleted=FALSE) AS total_downloaded`,
      ),

      query<HomeNews>(
        `SELECT n.id, n.title, n.slug, n.published_at, u.username AS author
         FROM news n JOIN users u ON u.id = n.author_id
         ORDER BY n.is_pinned DESC, n.published_at DESC LIMIT 5`,
      ),

      query<HomeBirthday>(
        `SELECT username, avatar_url FROM users
         WHERE DATE(birth_date) = CURDATE()
           AND show_birthday = TRUE
           AND is_deleted = FALSE AND is_banned = FALSE`,
      ),

      query<HomeTopTorrent>(
        `SELECT t.id, t.name, t.slug, t.size, t.download_count, c.name AS category
         FROM torrents t
         JOIN categories c ON c.id = t.category_id
         WHERE t.status = 'approved'
         ORDER BY t.download_count DESC
         LIMIT 10`,
      ),
    ]);

    const result = {
      stats: stats ?? { torrent_count: 0, user_count: 0, total_uploaded: 0, total_downloaded: 0 },
      news: newsRows,
      birthdays: birthdayRows,
      topTorrents: topTorrentRows,
    };
    await redis.set(HOME_CACHE_KEY, JSON.stringify(result), 'EX', HOME_TTL);
    return reply.send(result);
  });
};
