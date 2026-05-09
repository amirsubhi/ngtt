import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../lib/db';
import { redis } from '../../lib/redis';
import { getSeederCount, getLeecherCount } from '../../announce/peers';

const VALID_SORTS = ['created_at', 'name', 'size', 'seeders', 'leechers'] as const;
const VALID_ORDERS = ['asc', 'desc'] as const;

function heatClass(peers: number): string {
  if (peers === 0) return 'dead';
  if (peers < 5) return 'cold';
  if (peers < 25) return 'warm';
  if (peers < 100) return 'hot';
  return 'burning';
}

const QueryParams = z.object({
  q: z.string().max(200).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  tag: z.string().optional(),
  freeleech: z.enum(['true', 'false']).optional(),
  resolution: z.string().optional(),
  codec: z.string().optional(),
  source: z.string().optional(),
  uploader: z.string().optional(),
  sort: z.enum(VALID_SORTS).optional().default('created_at'),
  order: z.enum(VALID_ORDERS).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

interface TorrentRow {
  id: number;
  info_hash: string;
  name: string;
  slug: string;
  category_id: number;
  category_name: string;
  uploader_id: number;
  uploader_username: string;
  size: number;
  num_files: number;
  is_freeleech: boolean;
  status: string;
  created_at: string;
  poster_url: string | null;
  thank_count: number;
  download_count: number;
}

export async function browseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/torrents', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = QueryParams.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_PARAMS', message: parsed.error.issues[0]?.message ?? 'Invalid params' });
    const { q, category_id, tag, freeleech, resolution, codec, source, uploader, sort, order, page, limit } = parsed.data;

    const conditions: string[] = ["t.status = 'approved'"];
    const params: unknown[] = [];

    if (q) {
      conditions.push('MATCH(t.name) AGAINST(? IN BOOLEAN MODE)');
      params.push(`${q}*`);
    }
    if (category_id) { conditions.push('t.category_id = ?'); params.push(category_id); }
    if (freeleech === 'true') { conditions.push('t.is_freeleech = TRUE'); }
    if (uploader) {
      conditions.push('u.username = ?');
      params.push(uploader);
    }
    if (resolution) { conditions.push('mi.resolution = ?'); params.push(resolution); }
    if (codec) { conditions.push('mi.video_codec = ?'); params.push(codec); }
    if (source) { conditions.push('mi.source = ?'); params.push(source); }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    let joinClause = `
      JOIN categories c ON c.id = t.category_id
      JOIN users u ON u.id = t.uploader_id`;
    if (tag) {
      joinClause += `
      JOIN torrent_tags tt ON tt.torrent_id = t.id
      JOIN tags tg ON tg.id = tt.tag_id AND tg.slug = ?`;
      params.unshift(tag); // tag join before WHERE params
    }
    if (resolution || codec || source) {
      joinClause += '\n      LEFT JOIN torrent_mediainfo mi ON mi.torrent_id = t.id';
    } else {
      joinClause += '\n      LEFT JOIN torrent_mediainfo mi ON mi.torrent_id = t.id';
    }

    const sortCol = sort === 'seeders' || sort === 'leechers' ? 't.created_at' : `t.${sort}`;
    const sql = `
      SELECT t.id, t.info_hash, t.name, t.slug, t.category_id, c.name AS category_name,
             t.uploader_id, u.username AS uploader_username,
             t.size, t.num_files, t.is_freeleech, t.status,
             t.created_at, t.poster_url, t.thank_count, t.download_count
      FROM torrents t
      ${joinClause}
      WHERE ${where}
      ORDER BY ${sortCol} ${order}
      LIMIT ${limit} OFFSET ${offset}`;

    const torrents = await query<TorrentRow>(sql, params);

    const countSql = `SELECT COUNT(*) AS total FROM torrents t ${joinClause} WHERE ${where}`;
    const countParams = params.slice(0, params.length - 2);
    const countRow = await queryOne<{ total: number }>(countSql, countParams);
    const total = countRow?.total ?? 0;

    // Attach Redis peer counts
    const enriched = await Promise.all(torrents.map(async t => {
      const [seeders, leechers] = await Promise.all([
        getSeederCount(t.info_hash),
        getLeecherCount(t.info_hash),
      ]);
      return { ...t, seeders, leechers, heat: heatClass(seeders + leechers) };
    }));

    return reply.send({ data: enriched, total, page, limit });
  });
}
