import { FastifyPluginAsync } from 'fastify';
import { query, queryOne } from '../lib/db';

interface HomeTorrent {
  id: number;
  name: string;
  category_name: string | null;
  size: number;
  seeders: number;
  leechers: number;
  is_freeleech: boolean;
  created_at: string;
  uploader: string;
}

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

export const homeRoutes: FastifyPluginAsync = async app => {
  app.get('/api/home', async (_req, reply) => {
    const [stats, newsRows, torrentRows, birthdayRows] = await Promise.all([
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
         ORDER BY n.is_pinned DESC, n.published_at DESC LIMIT 3`,
      ),

      query<HomeTorrent>(
        `SELECT t.id, t.name, c.name AS category_name, t.size,
                0 AS seeders, 0 AS leechers, t.is_freeleech, t.created_at,
                u.username AS uploader
         FROM torrents t
         LEFT JOIN categories c ON c.id = t.category_id
         JOIN users u ON u.id = t.uploader_id
         WHERE t.status = 'approved'
         ORDER BY t.created_at DESC LIMIT 10`,
      ),

      query<HomeBirthday>(
        `SELECT username, avatar_url FROM users
         WHERE DATE(birth_date) = CURDATE()
           AND show_birthday = TRUE
           AND is_deleted = FALSE AND is_banned = FALSE`,
      ),
    ]);

    return reply.send({
      stats: stats ?? { torrent_count: 0, user_count: 0, total_uploaded: 0, total_downloaded: 0 },
      news: newsRows,
      newest_torrents: torrentRows,
      birthdays: birthdayRows,
    });
  });
};
