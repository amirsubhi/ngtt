import { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import { queryOne, withTransaction } from '../../lib/db';
import { saveFile } from '../../lib/storage';
import { parseTorrentBuffer } from '../../lib/torrent-parser';
import { authenticate } from '../../middleware/auth';
import { requireFeature } from '../../middleware/featureFlag';
import { jobsQueue } from '../../lib/queues';
import { ValidationError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import mysql from 'mysql2/promise';

const VIDEO_SLUGS = new Set(['movies', 'tv', 'anime']);
const UPLOAD_AUTO_APPROVE_SLUGS = new Set(['uploader', 'power-user', 'vip', 'staff', 'admin', 'mod']);

const UploadFields = z.object({
  name: z.string().min(3).max(500).trim(),
  description: z.string().max(10000).optional().default(''),
  category_id: z.coerce.number().int().positive(),
  tags: z.union([z.string(), z.array(z.string())]).transform(v => (Array.isArray(v) ? v : [v])).optional().default([]),
  tmdb_id: z.coerce.number().int().positive().optional(),
  imdb_id: z.string().regex(/^tt\d+$/).optional(),
  nfo_content: z.string().max(500000).optional(),
});

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/torrents/upload',
    { preHandler: [authenticate, requireFeature('upload_enabled')] },
    async (req, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: MultipartFile | undefined = await (req as any).file();
      if (!data) throw new ValidationError('No file uploaded');

      const fileBuffer = await data.toBuffer();
      if (data.mimetype !== 'application/x-bittorrent' && !data.filename.endsWith('.torrent')) {
        throw new ValidationError('File must be a .torrent file');
      }

      let parsed;
      try {
        parsed = parseTorrentBuffer(fileBuffer);
      } catch {
        throw new ValidationError('Invalid or corrupt torrent file');
      }

      const fields = UploadFields.safeParse(data.fields);
      if (!fields.success) {
        throw new ValidationError(fields.error.issues[0]?.message ?? 'Invalid fields');
      }
      const { name, description, category_id, tags, tmdb_id, imdb_id, nfo_content } = fields.data;

      // Check duplicate info_hash
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM torrents WHERE info_hash = ? LIMIT 1',
        [parsed.infoHash],
      );
      if (existing) throw new ValidationError('This torrent already exists');

      // Validate category
      const category = await queryOne<{ id: number; slug: string }>(
        'SELECT id, slug FROM categories WHERE id = ? AND enabled = TRUE LIMIT 1',
        [category_id],
      );
      if (!category) throw new ValidationError('Invalid category');

      // Check uploader group for auto-approve
      const uploaderGroup = await queryOne<{ slug: string }>(
        'SELECT ug.slug FROM user_groups ug JOIN users u ON u.group_id = ug.id WHERE u.id = ? LIMIT 1',
        [req.user.id],
      );
      const autoApprove = uploaderGroup ? UPLOAD_AUTO_APPROVE_SLUGS.has(uploaderGroup.slug) || req.user.is_staff : false;
      const status = autoApprove ? 'approved' : 'pending';

      // Save .torrent file
      const torrentPath = `torrents/${parsed.infoHash}.torrent`;
      await saveFile(torrentPath, fileBuffer);

      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 590);

      const torrentId = await withTransaction(async (conn: mysql.PoolConnection) => {
        const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
          `INSERT INTO torrents (info_hash, name, slug, description, category_id, uploader_id,
            size, num_files, status, approved_by, approved_at, tmdb_id, imdb_id, nfo_content)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parsed.infoHash, name, slug, description, category_id, req.user.id,
            parsed.size, parsed.files.length, status,
            autoApprove ? req.user.id : null,
            autoApprove ? new Date() : null,
            tmdb_id ?? null, imdb_id ?? null, nfo_content ?? null,
          ],
        );
        const tid = insertResult.insertId;

        for (const file of parsed.files) {
          await conn.execute(
            'INSERT INTO torrent_files (torrent_id, path, size) VALUES (?, ?, ?)',
            [tid, file.path, file.size],
          );
        }

        // Tags
        for (const tagName of (tags as string[])) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          await conn.execute(
            `INSERT INTO tags (name, slug, created_by) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
            [tagName, tagSlug, req.user.id],
          );
          const [tagRows] = await conn.execute<mysql.RowDataPacket[]>(
            'SELECT id FROM tags WHERE slug = ? LIMIT 1',
            [tagSlug],
          );
          if (tagRows[0]) {
            await conn.execute(
              'INSERT IGNORE INTO torrent_tags (torrent_id, tag_id, added_by) VALUES (?, ?, ?)',
              [tid, tagRows[0].id, req.user.id],
            );
          }
        }

        return tid;
      });

      // Queue background jobs
      if (VIDEO_SLUGS.has(category.slug)) {
        void jobsQueue.add('parse-mediainfo', { torrent_id: torrentId, file_path: torrentPath });
      }

      if (tmdb_id) {
        void fetchTmdbMetadata(torrentId, tmdb_id);
      }

      if (autoApprove) {
        // Award flux for approved upload
        const fluxSetting = await queryOne<{ value: string }>(
          "SELECT value FROM site_settings WHERE `key` = 'flux_per_upload' LIMIT 1",
        );
        const fluxAmount = parseInt(fluxSetting?.value ?? '50', 10);
        void jobsQueue.add('flux-earn', { user_id: req.user.id, amount: fluxAmount, reason: 'Upload approved' });
        void jobsQueue.add('shoutbox-archive', { torrent_id: torrentId });
      }

      return reply.status(201).send({ id: torrentId, status });
    },
  );
}

async function fetchTmdbMetadata(torrentId: number, tmdbId: number): Promise<void> {
  const { execute, executeAffected } = await import('../../lib/db');
  const { config } = await import('../../lib/config');
  if (!config.tmdbApiKey) return;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${config.tmdbApiKey}`,
    );
    if (!res.ok) return;
    const movie = await res.json() as {
      poster_path?: string;
      release_date?: string;
    };
    const posterUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null;
    const releaseYear = movie.release_date
      ? parseInt(movie.release_date.slice(0, 4), 10)
      : null;

    await execute(
      'UPDATE torrents SET poster_url = ?, release_year = ? WHERE id = ?',
      [posterUrl, releaseYear, torrentId],
    );
  } catch (err) {
    logger.warn({ err, torrentId, tmdbId }, 'TMDB fetch failed');
  }
}
