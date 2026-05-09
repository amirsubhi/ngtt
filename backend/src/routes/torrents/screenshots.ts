import { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import sharp from 'sharp';
import { queryOne, executeInsert } from '../../lib/db';
import { saveFile, getFileUrl } from '../../lib/storage';
import { authenticate } from '../../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../../lib/errors';

const MAX_SCREENSHOTS = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_WIDTH = 1920;

export async function screenshotRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/torrents/:id/screenshots',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const torrentId = parseInt((req.params as { id: string }).id, 10);
      if (isNaN(torrentId)) throw new NotFoundError('Torrent not found');

      const torrent = await queryOne<{ id: number; status: string; uploader_id: number }>(
        'SELECT id, status, uploader_id FROM torrents WHERE id = ? LIMIT 1',
        [torrentId],
      );
      if (!torrent || torrent.status !== 'approved') throw new NotFoundError('Torrent not found');

      if (torrent.uploader_id !== req.user.id && !req.user.is_staff) {
        throw new ForbiddenError('Only the uploader can add screenshots');
      }

      const countRow = await queryOne<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM torrent_screenshots WHERE torrent_id = ?',
        [torrentId],
      );
      if ((countRow?.cnt ?? 0) >= MAX_SCREENSHOTS) {
        throw new ValidationError(`Maximum ${MAX_SCREENSHOTS} screenshots allowed`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: MultipartFile | undefined = await (req as any).file({ limits: { fileSize: MAX_BYTES } });
      if (!data) throw new ValidationError('No file uploaded');
      if (!ALLOWED_MIMES.has(data.mimetype)) throw new ValidationError('Only jpg, png, webp allowed');

      const rawBuffer = await data.toBuffer();
      const resized = await sharp(rawBuffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const filename = `screenshots/${torrentId}/${Date.now()}.jpg`;
      await saveFile(filename, resized);
      const url = getFileUrl(filename);

      const screenshotId = await executeInsert(
        'INSERT INTO torrent_screenshots (torrent_id, uploaded_by, url, display_order) VALUES (?, ?, ?, ?)',
        [torrentId, req.user.id, url, countRow?.cnt ?? 0],
      );

      return reply.status(201).send({ id: screenshotId, url });
    },
  );
}
