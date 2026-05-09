import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { decode, encodeToBytes } from 'bencodec';
import { queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { NotFoundError } from '../../lib/errors';
import { config } from '../../lib/config';
import { logger } from '../../lib/logger';

export async function downloadRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/torrents/:id/download',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { id: rawId } = req.params as { id: string };
      const id = parseInt(rawId, 10);
      if (isNaN(id)) throw new NotFoundError('Torrent not found');

      const torrent = await queryOne<{ info_hash: string; name: string; status: string }>(
        'SELECT info_hash, name, status FROM torrents WHERE id = ? LIMIT 1',
        [id],
      );
      if (!torrent || torrent.status !== 'approved') throw new NotFoundError('Torrent not found');

      const uploader = await queryOne<{ passkey: string }>(
        'SELECT passkey FROM users WHERE id = ? LIMIT 1',
        [req.user.id],
      );
      if (!uploader) throw new NotFoundError('User not found');

      const filePath = path.join(config.uploadPath, 'torrents', `${torrent.info_hash}.torrent`);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(filePath);
      } catch {
        throw new NotFoundError('Torrent file not found on disk');
      }

      // Rewrite announce URL with user's passkey
      const torrentData = decode(fileBuffer) as Record<string, unknown>;
      const announceUrl = `${config.frontendUrl.replace('3000', '4000')}/announce/${uploader.passkey}`;
      torrentData['announce'] = Buffer.from(announceUrl);
      // Remove announce-list to avoid leaking tracker URLs
      delete torrentData['announce-list'];

      const modified = Buffer.from(encodeToBytes(torrentData));

      // Non-blocking: increment download count and record snatch
      void execute('UPDATE torrents SET download_count = download_count + 1 WHERE id = ?', [id])
        .catch(err => logger.warn({ err, torrentId: id }, 'download_count increment failed'));
      void execute('INSERT IGNORE INTO torrent_snatches (user_id, torrent_id) VALUES (?, ?)', [req.user.id, id])
        .catch(err => logger.warn({ err, userId: req.user.id, torrentId: id }, 'snatch record failed'));

      const safeName = torrent.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      return reply
        .header('Content-Type', 'application/x-bittorrent')
        .header('Content-Disposition', `attachment; filename="${safeName}.torrent"`)
        .send(modified);
    },
  );

  app.get(
    '/api/torrents/:id/magnet',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { id: rawId } = req.params as { id: string };
      const id = parseInt(rawId, 10);
      if (isNaN(id)) throw new NotFoundError('Torrent not found');

      const torrent = await queryOne<{ info_hash: string; name: string; size: number; status: string; magnet_enabled: boolean }>(
        'SELECT info_hash, name, size, status, magnet_enabled FROM torrents WHERE id = ? LIMIT 1',
        [id],
      );
      if (!torrent || torrent.status !== 'approved') throw new NotFoundError('Torrent not found');

      // Check site setting
      const magnetSetting = await queryOne<{ value: string }>(
        "SELECT value FROM site_settings WHERE `key` = 'magnet_links_enabled' LIMIT 1",
      );
      if (magnetSetting?.value !== 'true' || !torrent.magnet_enabled) {
        return reply.status(403).send({ error: 'MAGNET_DISABLED', message: 'Magnet links are disabled' });
      }

      const uploader = await queryOne<{ passkey: string }>(
        'SELECT passkey FROM users WHERE id = ? LIMIT 1',
        [req.user.id],
      );
      if (!uploader) throw new NotFoundError('User not found');

      const announceUrl = `${config.frontendUrl.replace('3000', '4000')}/announce/${uploader.passkey}`;
      const magnet = [
        `magnet:?xt=urn:btih:${torrent.info_hash}`,
        `dn=${encodeURIComponent(torrent.name)}`,
        `xl=${torrent.size}`,
        `tr=${encodeURIComponent(announceUrl)}`,
      ].join('&');

      return reply.send({ magnet });
    },
  );
}
