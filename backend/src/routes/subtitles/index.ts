import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, queryOne, execute, withTransaction } from '../../lib/db';
import { redis } from '../../lib/redis';
import { authenticate } from '../../middleware/auth';
import { requireFeature } from '../../middleware/featureFlag';
import { decrypt } from '../../lib/encrypt';
import { config } from '../../lib/config';
import { jobsQueue } from '../../lib/queues';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';

const OS_API_BASE = 'https://api.opensubtitles.com/api/v1';

const ALLOWED_FORMATS = ['srt', 'ass', 'ssa', 'vtt', 'sub', 'idx', 'sup'] as const;
type SubFormat = typeof ALLOWED_FORMATS[number];

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese', es: 'Spanish', pt: 'Portuguese',
  ar: 'Arabic',  ms: 'Malay',   fr: 'French',  de: 'German',
  ja: 'Japanese', ko: 'Korean', ru: 'Russian', it: 'Italian',
  pl: 'Polish',  nl: 'Dutch',   tr: 'Turkish', vi: 'Vietnamese',
  th: 'Thai',    id: 'Indonesian', hi: 'Hindi', sv: 'Swedish',
};

interface SubtitleRow {
  id: number;
  torrent_id: number;
  uploaded_by: number | null;
  uploader_username: string | null;
  language: string;
  language_label: string;
  format: string;
  filename: string;
  file_path: string;
  file_size: number;
  is_approved: boolean;
  download_count: number;
  is_machine_translated: boolean;
  source: string;
  notes: string | null;
  vote_score: number;
  created_at: string;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key` = ? LIMIT 1', [key]);
  return row?.value ?? fallback;
}

export const subtitleRoutes: FastifyPluginAsync = async app => {
  const ffSubtitles = requireFeature('subtitles_enabled');

  // 9a — Upload subtitle
  app.post<{ Params: { id: string } }>(
    '/api/torrents/:id/subtitles',
    { preHandler: [authenticate, ffSubtitles] },
    async (req, reply) => {
      const torrentId = parseInt(req.params.id, 10);
      const torrent = await queryOne<{ id: number; name: string }>(
        "SELECT id, name FROM torrents WHERE id = ? AND status = 'approved'", [torrentId],
      );
      if (!torrent) throw new NotFoundError('Torrent not found');

      const maxMb = parseInt(await getSetting('subtitle_max_size_mb', '2'), 10);
      const maxBytes = maxMb * 1024 * 1024;

      const data = await req.file();
      if (!data) throw new ValidationError('No file uploaded');

      const ext = path.extname(data.filename).slice(1).toLowerCase() as SubFormat;
      if (!ALLOWED_FORMATS.includes(ext)) {
        throw new ValidationError(`Unsupported format. Allowed: ${ALLOWED_FORMATS.join(', ')}`);
      }

      // Collect fields from multipart
      const fields = data.fields as Record<string, { value: string }>;
      const language = fields.language?.value ?? '';
      const notes = fields.notes?.value ?? null;
      const isMachineTranslated = fields.is_machine_translated?.value === 'true';

      if (!LANGUAGE_MAP[language]) {
        throw new ValidationError(`Unsupported language code '${language}'`);
      }

      const fileBuffer = await data.toBuffer();
      if (fileBuffer.byteLength > maxBytes) {
        throw new ValidationError(`File exceeds maximum size of ${maxMb} MB`);
      }

      const uuid = randomUUID();
      const savedFilename = `${uuid}.${ext}`;
      const subtitleDir = path.join(config.uploadPath, 'subtitles');
      if (!fs.existsSync(subtitleDir)) fs.mkdirSync(subtitleDir, { recursive: true });
      const filePath = path.join(subtitleDir, savedFilename);
      fs.writeFileSync(filePath, fileBuffer);

      const moderation = await getSetting('subtitle_moderation', 'false');
      const isApproved = moderation !== 'true';

      let subtitleId: number;
      await withTransaction(async conn => {
        const [insertResult] = await conn.execute<import('mysql2').ResultSetHeader>(
          `INSERT INTO subtitles (torrent_id, uploaded_by, language, language_label, format,
           filename, file_path, file_size, is_approved, is_machine_translated, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
          [torrentId, req.user.id, language, LANGUAGE_MAP[language], ext,
           data.filename, filePath, fileBuffer.byteLength, isApproved, isMachineTranslated, notes],
        );
        subtitleId = insertResult.insertId;

        if (isApproved) {
          const fluxReward = parseInt(await getSetting('flux_per_subtitle', '20'), 10);
          if (fluxReward > 0) {
            await conn.execute(
              'UPDATE users SET flux = flux + ? WHERE id = ?',
              [fluxReward, req.user.id],
            );
            await conn.execute(
              "INSERT INTO flux_transactions (user_id, amount, source, reference_id) VALUES (?, ?, 'subtitle_upload', ?)",
              [req.user.id, fluxReward, subtitleId],
            );
          }
        }
      });

      return reply.status(201).send({ id: subtitleId!, approved: isApproved });
    },
  );

  // 9b — List subtitles grouped by language
  app.get<{ Params: { id: string } }>(
    '/api/torrents/:id/subtitles',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const torrentId = parseInt(req.params.id, 10);
      const rows = await query<SubtitleRow>(
        `SELECT s.id, s.torrent_id, s.uploaded_by, u.username AS uploader_username,
                s.language, s.language_label, s.format, s.filename, s.file_path,
                s.file_size, s.is_approved, s.download_count, s.is_machine_translated,
                s.source, s.notes, s.created_at,
                COALESCE(SUM(CASE WHEN sv.vote='up' THEN 1 WHEN sv.vote='down' THEN -1 ELSE 0 END), 0) AS vote_score
         FROM subtitles s
         LEFT JOIN users u ON u.id = s.uploaded_by
         LEFT JOIN subtitle_votes sv ON sv.subtitle_id = s.id
         WHERE s.torrent_id = ? AND s.is_approved = TRUE
         GROUP BY s.id
         ORDER BY s.language, vote_score DESC`,
        [torrentId],
      );

      // Group by language
      const grouped: Record<string, SubtitleRow[]> = {};
      for (const row of rows) {
        if (!grouped[row.language]) grouped[row.language] = [];
        grouped[row.language].push(row);
      }

      return reply.send({ subtitles: grouped });
    },
  );

  // 9c — Download subtitle
  app.get<{ Params: { id: string } }>(
    '/api/subtitles/:id/download',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const subtitleId = parseInt(req.params.id, 10);
      const sub = await queryOne<{ file_path: string; filename: string }>(
        'SELECT file_path, filename FROM subtitles WHERE id = ? AND is_approved = TRUE', [subtitleId],
      );
      if (!sub) throw new NotFoundError('Subtitle not found');
      if (!fs.existsSync(sub.file_path)) throw new NotFoundError('Subtitle file missing');

      void execute('UPDATE subtitles SET download_count = download_count + 1 WHERE id = ?', [subtitleId]);

      const stream = fs.createReadStream(sub.file_path);
      return reply
        .header('Content-Disposition', `attachment; filename="${sub.filename}"`)
        .header('Content-Type', 'application/octet-stream')
        .send(stream);
    },
  );

  // 9d — Vote on subtitle
  app.post<{ Params: { id: string } }>(
    '/api/subtitles/:id/vote',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const subtitleId = parseInt(req.params.id, 10);
      const parsed = z.object({ vote: z.enum(['up', 'down']) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('vote must be "up" or "down"');

      const sub = await queryOne<{ id: number }>(
        'SELECT id FROM subtitles WHERE id = ? AND is_approved = TRUE', [subtitleId],
      );
      if (!sub) throw new NotFoundError('Subtitle not found');

      await execute(
        'INSERT INTO subtitle_votes (subtitle_id, user_id, vote) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote = ?',
        [subtitleId, req.user.id, parsed.data.vote, parsed.data.vote],
      );
      return reply.send({ ok: true });
    },
  );

  // 9e — Report subtitle
  app.post<{ Params: { id: string } }>(
    '/api/subtitles/:id/report',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const subtitleId = parseInt(req.params.id, 10);
      const parsed = z.object({ reason: z.string().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Reason required');

      const sub = await queryOne<{ torrent_id: number }>(
        'SELECT torrent_id FROM subtitles WHERE id = ? LIMIT 1', [subtitleId],
      );
      if (!sub) throw new NotFoundError('Subtitle not found');

      // Store in the generic reports table with target_type='torrent'
      await execute(
        "INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, 'torrent', ?, ?)",
        [req.user.id, sub.torrent_id, `[Subtitle #${subtitleId}] ${parsed.data.reason}`],
      );

      // Notify staff
      const staffUsers = await query<{ id: number }>(
        "SELECT u.id FROM users u JOIN user_groups g ON g.id = u.group_id WHERE g.is_staff = TRUE AND u.is_banned = FALSE",
      );
      for (const staffUser of staffUsers) {
        void jobsQueue.add('send-notif', {
          user_id: staffUser.id,
          title: 'Subtitle Report',
          body: `Subtitle #${subtitleId} has been reported: ${parsed.data.reason.slice(0, 100)}`,
          url: `/staff`,
        });
      }

      return reply.send({ ok: true });
    },
  );

  // 9f — OpenSubtitles sync
  app.post<{ Params: { id: string } }>(
    '/api/torrents/:id/subtitles/sync',
    { preHandler: [authenticate, ffSubtitles] },
    async (req, reply) => {
      const torrentId = parseInt(req.params.id, 10);

      const prefs = await queryOne<{
        os_api_key_enc: string | null;
        os_enabled: boolean;
        os_verified: boolean;
        os_preferred_langs: string;
        os_auto_sync: boolean;
      }>(
        'SELECT os_api_key_enc, os_enabled, os_verified, os_preferred_langs, os_auto_sync FROM user_preferences WHERE user_id = ? LIMIT 1',
        [req.user.id],
      );

      if (!prefs?.os_enabled || !prefs.os_verified || !prefs.os_api_key_enc) {
        throw new ForbiddenError('OpenSubtitles not connected');
      }

      // 24h cooldown check
      const cooldownKey = `os-sync:${req.user.id}:${torrentId}`;
      const cooldown = await redis.get(cooldownKey);
      if (cooldown) throw new ForbiddenError('Already synced in the last 24 hours');

      const torrent = await queryOne<{ id: number; name: string; imdb_id: string | null }>(
        "SELECT id, name, imdb_id FROM torrents WHERE id = ? AND status = 'approved'", [torrentId],
      );
      if (!torrent) throw new NotFoundError('Torrent not found');

      const apiKey = decrypt(prefs.os_api_key_enc);
      const preferredLangs: string[] = JSON.parse(prefs.os_preferred_langs || '[]');

      // Search OpenSubtitles
      const searchParams = new URLSearchParams();
      if (torrent.imdb_id) {
        searchParams.set('imdb_id', torrent.imdb_id.replace('tt', ''));
      } else {
        searchParams.set('query', torrent.name);
      }
      if (preferredLangs.length > 0) searchParams.set('languages', preferredLangs.join(','));

      const searchRes = await fetch(`${OS_API_BASE}/subtitles?${searchParams.toString()}`, {
        headers: { 'Api-Key': apiKey, 'User-Agent': 'NGTT/1.0', 'Content-Type': 'application/json' },
      });
      if (!searchRes.ok) throw new ForbiddenError('OpenSubtitles API error');

      const searchData = await searchRes.json() as {
        data?: Array<{
          id: string;
          attributes: {
            language: string;
            machine_translated: boolean;
            files: Array<{ file_id: number; file_name: string }>;
          };
        }>;
      };

      const results = searchData.data ?? [];
      const subtitleDir = path.join(config.uploadPath, 'subtitles');
      if (!fs.existsSync(subtitleDir)) fs.mkdirSync(subtitleDir, { recursive: true });

      let syncedCount = 0;

      for (const result of results) {
        const lang = result.attributes.language;
        const isMachine = result.attributes.machine_translated;
        const fileEntry = result.attributes.files[0];
        if (!fileEntry) continue;

        // Skip if not in preferred langs
        if (preferredLangs.length > 0 && !preferredLangs.includes(lang)) continue;

        // Skip if already synced for this language
        const exists = await queryOne<{ id: number }>(
          "SELECT id FROM subtitles WHERE torrent_id = ? AND language = ? AND source = 'opensubtitles_sync' LIMIT 1",
          [torrentId, lang],
        );
        if (exists) continue;

        // Download subtitle file
        const dlRes = await fetch(`${OS_API_BASE}/download`, {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'User-Agent': 'NGTT/1.0', 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileEntry.file_id }),
        });
        if (!dlRes.ok) continue;

        const dlData = await dlRes.json() as { link?: string };
        if (!dlData.link) continue;

        const fileRes = await fetch(dlData.link);
        if (!fileRes.ok) continue;

        const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
        const originalName = fileEntry.file_name || `subtitle_${lang}.srt`;
        const ext = path.extname(originalName).slice(1).toLowerCase() || 'srt';
        if (!ALLOWED_FORMATS.includes(ext as SubFormat)) continue;

        const uuid = randomUUID();
        const savedFilename = `${uuid}.${ext}`;
        const filePath = path.join(subtitleDir, savedFilename);
        fs.writeFileSync(filePath, fileBuffer);

        await withTransaction(async conn => {
          const [insertResult] = await conn.execute<import('mysql2').ResultSetHeader>(
            `INSERT INTO subtitles (torrent_id, uploaded_by, language, language_label, format,
             filename, file_path, file_size, is_approved, is_machine_translated,
             source, synced_by, os_subtitle_id)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, TRUE, ?, 'opensubtitles_sync', ?, ?)`,
            [torrentId, lang, LANGUAGE_MAP[lang] ?? lang, ext, originalName,
             filePath, fileBuffer.byteLength, isMachine, req.user.id, result.id],
          );
          const newSubId = insertResult.insertId;

          // Award 5 FLX per synced subtitle
          await conn.execute('UPDATE users SET flux = flux + 5 WHERE id = ?', [req.user.id]);
          await conn.execute(
            "INSERT INTO flux_transactions (user_id, amount, source, reference_id) VALUES (?, 5, 'os_sync', ?)",
            [req.user.id, newSubId],
          );
        });
        syncedCount++;
      }

      // Set 24h cooldown
      await redis.set(cooldownKey, '1', 'EX', 86400);

      // Get remaining quota
      const quotaRes = await fetch(`${OS_API_BASE}/infos/user`, {
        headers: { 'Api-Key': apiKey, 'User-Agent': 'NGTT/1.0' },
      });
      let remainingDownloads: number | null = null;
      if (quotaRes.ok) {
        const quotaData = await quotaRes.json() as { data?: { remaining_downloads?: number } };
        remainingDownloads = quotaData.data?.remaining_downloads ?? null;
      }

      return reply.send({ synced_count: syncedCount, remaining_downloads: remainingDownloads });
    },
  );
};
