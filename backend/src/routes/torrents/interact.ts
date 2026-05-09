import { FastifyInstance } from 'fastify';
import { queryOne, execute, withTransaction } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { jobsQueue } from '../../lib/queues';

export async function interactRoutes(app: FastifyInstance): Promise<void> {
  // Thank
  app.post(
    '/api/torrents/:id/thank',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const torrentId = parseInt((req.params as { id: string }).id, 10);
      if (isNaN(torrentId)) throw new NotFoundError('Torrent not found');

      const torrent = await queryOne<{ id: number; uploader_id: number; status: string }>(
        'SELECT id, uploader_id, status FROM torrents WHERE id = ? LIMIT 1',
        [torrentId],
      );
      if (!torrent || torrent.status !== 'approved') throw new NotFoundError('Torrent not found');
      if (torrent.uploader_id === req.user.id) throw new ValidationError('Cannot thank your own torrent');

      const existing = await queryOne<{ user_id: number }>(
        'SELECT user_id FROM torrent_thanks WHERE user_id = ? AND torrent_id = ? LIMIT 1',
        [req.user.id, torrentId],
      );
      if (existing) throw new ValidationError('Already thanked');

      await withTransaction(async conn => {
        await conn.execute('INSERT INTO torrent_thanks (user_id, torrent_id) VALUES (?, ?)', [req.user.id, torrentId]);
        await conn.execute('UPDATE torrents SET thank_count = thank_count + 1 WHERE id = ?', [torrentId]);
      });

      const fluxSetting = await queryOne<{ value: string }>(
        "SELECT value FROM site_settings WHERE `key` = 'flux_per_thank' LIMIT 1",
      );
      const fluxAmount = parseInt(fluxSetting?.value ?? '5', 10);
      void jobsQueue.add('flux-earn', { user_id: torrent.uploader_id, amount: fluxAmount, reason: 'Torrent thanked' });
      void jobsQueue.add('send-notif', {
        user_id: torrent.uploader_id,
        type: 'thank',
        title: 'Someone thanked your torrent!',
        url: `/torrent/${torrentId}`,
      });

      return reply.send({ thanked: true });
    },
  );

  // Bookmark toggle
  app.post(
    '/api/torrents/:id/bookmark',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const torrentId = parseInt((req.params as { id: string }).id, 10);
      if (isNaN(torrentId)) throw new NotFoundError('Torrent not found');

      const existing = await queryOne<{ user_id: number }>(
        'SELECT user_id FROM torrent_bookmarks WHERE user_id = ? AND torrent_id = ? LIMIT 1',
        [req.user.id, torrentId],
      );

      if (existing) {
        await execute('DELETE FROM torrent_bookmarks WHERE user_id = ? AND torrent_id = ?', [req.user.id, torrentId]);
        return reply.send({ bookmarked: false });
      } else {
        await execute('INSERT IGNORE INTO torrent_bookmarks (user_id, torrent_id) VALUES (?, ?)', [req.user.id, torrentId]);
        return reply.send({ bookmarked: true });
      }
    },
  );
}
