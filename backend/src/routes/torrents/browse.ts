import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { getSeederCount, getLeecherCount } from '../../announce/peers';

const SORT_MAP: Record<string, string> = {
  newest:   't.created_at DESC',
  name:     't.name ASC',
  size:     't.size DESC',
  snatched: 't.download_count DESC',
  seeders:  't.created_at DESC',
};

const QueryParams = z.object({
  q:        z.string().max(200).optional(),
  catId:    z.coerce.number().int().positive().optional(),
  subcat:   z.string().max(64).optional(),
  fl:       z.enum(['true', 'false']).optional(),
  hdr:      z.enum(['true', 'false']).optional(),
  internal: z.enum(['true', 'false']).optional(),
  res:      z.union([z.string(), z.array(z.string())]).optional(),
  src:      z.union([z.string(), z.array(z.string())]).optional(),
  yr:       z.union([z.coerce.number().int(), z.array(z.coerce.number().int())]).optional(),
  lang:     z.string().optional(),
  sort:     z.enum(['seeders', 'newest', 'size', 'name', 'snatched']).optional().default('newest'),
  page:     z.coerce.number().int().min(1).optional().default(1),
  limit:    z.coerce.number().int().min(1).max(100).optional().default(25),
});

const SuggestParams = z.object({
  q: z.string().min(2).max(100),
});

interface TorrentRow {
  id: number;
  name: string;
  slug: string;
  category_id: number;
  category_icon: string;
  category_color: string;
  category_label: string;
  subcat: string | null;
  size: number;
  uploader_id: number;
  uploader_name: string;
  is_freeleech: boolean;
  is_internal: boolean;
  download_count: number;
  created_at: string;
  resolution: string | null;
  source: string | null;
  codec: string | null;
  hdr: string | null;
  info_hash: string;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export async function browseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/torrents', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = QueryParams.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_PARAMS', message: parsed.error.issues[0]?.message ?? 'Invalid params' });
    const { q, catId, subcat, fl, hdr, internal, res, src, yr, lang, sort, page, limit } = parsed.data;

    // req.user.slug is the user_group slug (set by authenticate middleware)
    const groupSlug = req.user.slug;

    const conditions: string[] = [
      "t.status = 'approved'",
      `(c.browse_min_group = 'all' OR (c.browse_min_group = 'user' AND ? IN ('newbie','member','power-user','vip','uploader','moderator','admin')) OR (c.browse_min_group = 'power' AND ? IN ('power-user','vip','uploader','moderator','admin')) OR (c.browse_min_group = 'staff' AND ? IN ('moderator','admin')))`,
    ];
    const params: unknown[] = [groupSlug, groupSlug, groupSlug];
    let needsMediainfo = false;

    if (q && q.length >= 3) {
      conditions.push('MATCH(t.name) AGAINST(? IN BOOLEAN MODE)');
      params.push(`${q}*`);
    } else if (q) {
      conditions.push('t.name LIKE ?');
      params.push(`%${q}%`);
    }
    if (catId)    { conditions.push('t.category_id = ?'); params.push(catId); }
    if (subcat)   { conditions.push('t.subcat = ?');      params.push(subcat); }
    if (fl === 'true')       conditions.push('t.is_freeleech = TRUE');
    if (internal === 'true') conditions.push('t.is_internal = TRUE');

    const resArr = toArray(res);
    if (resArr.length > 0) {
      conditions.push(`mi.resolution IN (${resArr.map(() => '?').join(',')})`);
      params.push(...resArr);
      needsMediainfo = true;
    }
    const srcArr = toArray(src);
    if (srcArr.length > 0) {
      conditions.push(`mi.source IN (${srcArr.map(() => '?').join(',')})`);
      params.push(...srcArr);
      needsMediainfo = true;
    }
    if (hdr === 'true') {
      conditions.push("mi.hdr != 'none'");
      needsMediainfo = true;
    }
    const yrArr = toArray(yr);
    if (yrArr.length > 0) {
      conditions.push(`t.release_year IN (${yrArr.map(() => '?').join(',')})`);
      params.push(...yrArr);
    }
    if (lang) {
      conditions.push('JSON_CONTAINS(mi.audio_langs, ?)');
      params.push(JSON.stringify(lang));
      needsMediainfo = true;
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    const orderBy = SORT_MAP[sort] ?? 't.created_at DESC';
    const miJoin = needsMediainfo
      ? 'JOIN torrent_mediainfo mi ON mi.torrent_id = t.id'
      : 'LEFT JOIN torrent_mediainfo mi ON mi.torrent_id = t.id';

    const sql = `
      SELECT
        t.id, t.name, t.slug,
        t.category_id, c.icon AS category_icon, c.color AS category_color, c.label AS category_label,
        t.subcat, t.size, t.is_freeleech, t.is_internal,
        t.uploader_id, u.username AS uploader_name,
        t.download_count, t.created_at, t.info_hash,
        mi.resolution, mi.source, mi.video_codec AS codec, mi.hdr
      FROM torrents t
      JOIN categories c ON c.id = t.category_id
      JOIN users u ON u.id = t.uploader_id
      ${miJoin}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM torrents t
      JOIN categories c ON c.id = t.category_id
      JOIN users u ON u.id = t.uploader_id
      ${miJoin}
      WHERE ${where}`;

    const [rows, countRow] = await Promise.all([
      query<TorrentRow>(sql, params),
      queryOne<{ total: number }>(countSql, params),
    ]);

    const total = Number(countRow?.total ?? 0);

    const enriched = await Promise.all(rows.map(async t => {
      const [seeders, leechers] = await Promise.all([
        getSeederCount(t.info_hash),
        getLeecherCount(t.info_hash),
      ]);
      return {
        id:            t.id,
        name:          t.name,
        slug:          t.slug,
        categoryId:    t.category_id,
        categoryIcon:  t.category_icon,
        categoryColor: t.category_color,
        categoryLabel: t.category_label,
        subcat:        t.subcat,
        size:          t.size,
        seeders,
        leechers,
        snatched:      t.download_count,
        uploadedAt:    t.created_at,
        uploaderId:    t.uploader_id,
        uploaderName:  t.uploader_name,
        freeleech:     t.is_freeleech,
        hdr:           t.hdr !== null && t.hdr !== 'none',
        internal:      t.is_internal,
        resolution:    t.resolution,
        source:        t.source,
        codec:         t.codec,
        // infoHash intentionally omitted — download via /download endpoint
      };
    }));

    return reply.send({ data: enriched, total, page, pages: Math.ceil(total / limit) });
  });

  app.get('/api/torrents/suggest', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = SuggestParams.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_PARAMS', message: 'q must be at least 2 characters' });
    const { q } = parsed.data;

    const groupSlug = req.user.slug;
    const rows = await query<{ name: string; icon: string; label: string }>(
      `SELECT DISTINCT t.name, c.icon, c.label
       FROM torrents t
       JOIN categories c ON t.category_id = c.id
       WHERE t.name LIKE CONCAT(?, '%') AND t.status = 'approved'
         AND (c.browse_min_group = 'all'
           OR (c.browse_min_group = 'user'  AND ? IN ('newbie','member','power-user','vip','uploader','moderator','admin'))
           OR (c.browse_min_group = 'power' AND ? IN ('power-user','vip','uploader','moderator','admin'))
           OR (c.browse_min_group = 'staff' AND ? IN ('moderator','admin')))
       LIMIT 8`,
      [q, groupSlug, groupSlug, groupSlug],
    );
    return reply.send(rows.map(r => ({ name: r.name, categoryIcon: r.icon, categoryLabel: r.label })));
  });
}
