import fs from 'fs/promises';
import path from 'path';
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { decode, encodeToBytes } from 'bencodec';
import { query, queryOne, execute } from '../../lib/db';
import { getSeederCount, getLeecherCount } from '../../announce/peers';
import { config } from '../../lib/config';
import { NotFoundError, UnauthorizedError, ForbiddenError, ValidationError } from '../../lib/errors';

// Category slug → Newznab standard ID
const NEWZNAB_CAT: Record<string, number> = {
  movies: 2000, tv: 5000, music: 3000, games: 4000,
  software: 8000, books: 7000, anime: 5000, other: 8000,
};
// Newznab cat param → SQL slugs
const CAT_TO_SLUGS: Record<number, string[]> = {
  2000: ['movies'],
  5000: ['tv', 'anime'],
  3000: ['music'],
  4000: ['games'],
  7000: ['books'],
  8000: ['software', 'other'],
};

interface ApiUser {
  id: number; username: string; passkey: string; api_key: string | null;
  api_enabled: boolean; group_id: number; is_banned: boolean; is_staff: boolean; slug: string;
}

function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function resolveApiUser(req: FastifyRequest): Promise<ApiUser> {
  const q = req.query as Record<string, string>;
  const apiKey = q.apikey ?? q.api_key;
  if (!apiKey) throw new UnauthorizedError('API key required');

  const enabled = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'api_enabled' LIMIT 1",
  );
  if (enabled?.value !== 'true') throw new ForbiddenError('API is disabled');

  const user = await queryOne<ApiUser>(
    `SELECT u.id, u.username, u.passkey, u.api_key, u.api_enabled, u.group_id, u.is_banned,
            ug.is_staff, ug.slug
     FROM users u JOIN user_groups ug ON ug.id = u.group_id
     WHERE u.api_key = ? AND u.is_deleted = FALSE LIMIT 1`,
    [apiKey],
  );
  if (!user) throw new UnauthorizedError('Invalid API key');
  if (user.is_banned) throw new ForbiddenError('Account is banned');
  if (!user.api_enabled) throw new ForbiddenError('API access not enabled for this account');
  return user;
}

async function buildTorrentFile(torrentId: number, userId: number): Promise<{ buffer: Buffer; name: string }> {
  const torrent = await queryOne<{ info_hash: string; name: string; status: string }>(
    "SELECT info_hash, name, status FROM torrents WHERE id = ? AND status = 'approved' LIMIT 1",
    [torrentId],
  );
  if (!torrent) throw new NotFoundError('Torrent not found');

  const user = await queryOne<{ passkey: string }>('SELECT passkey FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!user) throw new NotFoundError('User not found');

  const filePath = path.join(config.uploadPath, 'torrents', `${torrent.info_hash}.torrent`);
  const fileBuffer = await fs.readFile(filePath).catch(() => { throw new NotFoundError('Torrent file missing'); });

  const torrentData = decode(fileBuffer) as Record<string, unknown>;
  const announceUrl = `${config.frontendUrl.replace('3000', '4000')}/announce/${user.passkey}`;
  torrentData['announce'] = Buffer.from(announceUrl);
  delete torrentData['announce-list'];

  return { buffer: Buffer.from(encodeToBytes(torrentData)), name: torrent.name };
}

const baseUrl = config.frontendUrl.includes('3000')
  ? config.frontendUrl.replace('3000', '4000')
  : config.frontendUrl;

export const apiRoutes: FastifyPluginAsync = async app => {
  // Passkey-authenticated torrent download (used in RSS + autobrr + Torznab enclosures)
  app.get<{ Params: { passkey: string; id: string } }>(
    '/dl/:passkey/:id',
    async (req, reply) => {
      const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE passkey = ? AND is_deleted = FALSE LIMIT 1', [req.params.passkey]);
      if (!user) throw new UnauthorizedError('Invalid passkey');
      const torrentId = parseInt(req.params.id, 10);
      const { buffer, name } = await buildTorrentFile(torrentId, user.id);
      void execute('UPDATE torrents SET download_count = download_count + 1 WHERE id = ?', [torrentId]);
      void execute('INSERT IGNORE INTO torrent_snatches (user_id, torrent_id) VALUES (?, ?)', [user.id, torrentId]);
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      return reply
        .header('Content-Type', 'application/x-bittorrent')
        .header('Content-Disposition', `attachment; filename="${safeName}.torrent"`)
        .send(buffer);
    },
  );

  // 11a — Torznab
  app.get('/api/torznab', async (req, reply) => {
    const user = await resolveApiUser(req);
    const q = req.query as Record<string, string>;
    const t = q.t ?? 'search';

    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');

    if (t === 'caps') {
      const categories = await query<{ slug: string; label: string }>('SELECT slug, label FROM categories WHERE enabled = TRUE');
      const catXml = categories.map(c => {
        const id = NEWZNAB_CAT[c.slug] ?? 8000;
        return `<category id="${id}" name="${xmlEscape(c.label)}"/>`;
      }).join('\n          ');
      return reply.send(`<?xml version="1.0" encoding="UTF-8"?>
<caps>
  <server title="NGTT"/>
  <limits max="100" default="50"/>
  <searching>
    <search available="yes" supportedParams="q,cat,limit,offset"/>
    <movie-search available="yes" supportedParams="q,imdbid,tmdbid,cat"/>
    <tv-search available="yes" supportedParams="q,season,ep,cat"/>
    <music-search available="yes" supportedParams="q,artist,album,cat"/>
  </searching>
  <categories>
    ${catXml}
  </categories>
</caps>`);
    }

    // Build search query
    const limit = Math.min(100, parseInt(q.limit ?? '50', 10));
    const offset = parseInt(q.offset ?? '0', 10);
    const conditions: string[] = ["t.status = 'approved'"];
    const params: (string | number)[] = [];

    if (q.q) { conditions.push('MATCH(t.name) AGAINST(? IN BOOLEAN MODE)'); params.push(`${q.q}*`); }
    if (q.imdbid) { conditions.push('t.imdb_id = ?'); params.push(q.imdbid.startsWith('tt') ? q.imdbid : `tt${q.imdbid}`); }
    if (q.tmdbid) { conditions.push('t.tmdb_id = ?'); params.push(parseInt(q.tmdbid, 10)); }
    if (q.cat) {
      const catId = parseInt(q.cat, 10);
      const slugs = CAT_TO_SLUGS[catId];
      if (slugs?.length) {
        conditions.push(`c.slug IN (${slugs.map(() => '?').join(',')})`);
        params.push(...slugs);
      }
    }

    const where = conditions.join(' AND ');
    const torrents = await query<{
      id: number; name: string; info_hash: string; size: number;
      is_freeleech: boolean; created_at: string; imdb_id: string | null;
      category_slug: string;
    }>(
      `SELECT t.id, t.name, t.info_hash, t.size, t.is_freeleech, t.created_at, t.imdb_id, c.slug AS category_slug
       FROM torrents t JOIN categories c ON c.id = t.category_id WHERE ${where}
       ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const items = await Promise.all(torrents.map(async t => {
      const [seeders, leechers] = await Promise.all([getSeederCount(t.info_hash), getLeecherCount(t.info_hash)]);
      const catId = NEWZNAB_CAT[t.category_slug] ?? 8000;
      const dlUrl = `${baseUrl}/dl/${user.passkey}/${t.id}`;
      const detailUrl = `${config.frontendUrl}/torrent/${t.id}`;
      const pubDate = new Date(t.created_at).toUTCString();
      return `  <item>
    <title>${xmlEscape(t.name)}</title>
    <guid isPermaLink="false">${t.info_hash}</guid>
    <pubDate>${pubDate}</pubDate>
    <size>${t.size}</size>
    <link>${xmlEscape(detailUrl)}</link>
    <enclosure url="${xmlEscape(dlUrl)}" length="${t.size}" type="application/x-bittorrent"/>
    <torznab:attr name="category" value="${catId}"/>
    <torznab:attr name="size" value="${t.size}"/>
    <torznab:attr name="seeders" value="${seeders}"/>
    <torznab:attr name="leechers" value="${leechers}"/>
    <torznab:attr name="infohash" value="${t.info_hash}"/>
    <torznab:attr name="downloadvolumefactor" value="${t.is_freeleech ? '0' : '1'}"/>
    <torznab:attr name="uploadvolumefactor" value="1"/>${t.imdb_id ? `\n    <torznab:attr name="imdbid" value="${t.imdb_id}"/>` : ''}
  </item>`;
    }));

    return reply.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>NGTT</title>
    <description>NGTT Torznab Feed</description>
${items.join('\n')}
  </channel>
</rss>`);
  });

  // 11b — autobrr JSON feed
  app.get('/api/torrents/latest', async (req, reply) => {
    const user = await resolveApiUser(req);
    const torrents = await query<{
      id: number; name: string; info_hash: string; size: number;
      is_freeleech: boolean; created_at: string; imdb_id: string | null;
      tmdb_id: number | null; category_name: string; category_slug: string;
    }>(
      `SELECT t.id, t.name, t.info_hash, t.size, t.is_freeleech, t.created_at,
              t.imdb_id, t.tmdb_id, c.label AS category_name, c.slug AS category_slug
       FROM torrents t JOIN categories c ON c.id = t.category_id
       WHERE t.status = 'approved'
       ORDER BY t.created_at DESC LIMIT 50`,
    );

    const results = await Promise.all(torrents.map(async t => {
      const [seeders, leechers] = await Promise.all([getSeederCount(t.info_hash), getLeecherCount(t.info_hash)]);
      return {
        id: t.id,
        name: t.name,
        info_hash: t.info_hash,
        size: t.size,
        category: t.category_name,
        seeders,
        leechers,
        is_freeleech: t.is_freeleech,
        imdb_id: t.imdb_id,
        tmdb_id: t.tmdb_id,
        download_url: `${baseUrl}/dl/${user.passkey}/${t.id}`,
        details_url: `${config.frontendUrl}/torrent/${t.id}`,
        uploaded_at: t.created_at,
      };
    }));

    return reply.send(results);
  });

  // 11d — REST v1 endpoints (Bearer OR ?api_key=)
  async function resolveV1User(req: FastifyRequest): Promise<ApiUser> {
    const q = req.query as Record<string, string>;
    const apiKey = q.api_key ?? q.apikey;
    if (apiKey) {
      return resolveApiUser(req);
    }
    // Bearer token fallback — reuse api_key stored on user
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
    const apiKeyFromBearer = header.slice(7);
    const user = await queryOne<ApiUser>(
      `SELECT u.id, u.username, u.passkey, u.api_key, u.api_enabled, u.group_id, u.is_banned,
              ug.is_staff, ug.slug
       FROM users u JOIN user_groups ug ON ug.id = u.group_id
       WHERE u.api_key = ? AND u.is_deleted = FALSE LIMIT 1`,
      [apiKeyFromBearer],
    );
    if (!user) throw new UnauthorizedError('Invalid API key');
    if (user.is_banned) throw new ForbiddenError('Account is banned');
    if (!user.api_enabled) throw new ForbiddenError('API access not enabled');
    return user;
  }

  app.get('/api/v1/torrents', async (req, reply) => {
    const user = await resolveV1User(req);
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const offset = (page - 1) * 50;
    const conditions: string[] = ["t.status = 'approved'"];
    const params: (string | number)[] = [];
    if (q.q) { conditions.push('MATCH(t.name) AGAINST(? IN BOOLEAN MODE)'); params.push(`${q.q}*`); }
    if (q.category) { conditions.push('c.slug = ?'); params.push(q.category); }
    const torrents = await query<{ id: number; name: string; info_hash: string; size: number; is_freeleech: boolean; created_at: string; category_name: string }>(
      `SELECT t.id, t.name, t.info_hash, t.size, t.is_freeleech, t.created_at, c.label AS category_name
       FROM torrents t JOIN categories c ON c.id = t.category_id WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC LIMIT 50 OFFSET ${offset}`, params,
    );
    return reply.send({ torrents, page, download_base: `${baseUrl}/dl/${user.passkey}` });
  });

  app.get<{ Params: { id: string } }>('/api/v1/torrents/:id', async (req, reply) => {
    await resolveV1User(req);
    const torrent = await queryOne(
      `SELECT t.id, t.name, t.info_hash, t.size, t.is_freeleech, t.description,
              t.imdb_id, t.tmdb_id, t.created_at, c.label AS category_name, u.username AS uploader
       FROM torrents t JOIN categories c ON c.id=t.category_id JOIN users u ON u.id=t.uploader_id
       WHERE t.id = ? AND t.status = 'approved'`, [parseInt(req.params.id, 10)],
    );
    if (!torrent) throw new NotFoundError('Torrent not found');
    return reply.send(torrent);
  });

  app.get<{ Params: { id: string } }>('/api/v1/torrent/:id/download', async (req, reply) => {
    const user = await resolveV1User(req);
    const torrentId = parseInt(req.params.id, 10);
    const { buffer, name } = await buildTorrentFile(torrentId, user.id);
    void execute('UPDATE torrents SET download_count = download_count + 1 WHERE id = ?', [torrentId]);
    void execute('INSERT IGNORE INTO torrent_snatches (user_id, torrent_id) VALUES (?, ?)', [user.id, torrentId]);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return reply
      .header('Content-Type', 'application/x-bittorrent')
      .header('Content-Disposition', `attachment; filename="${safeName}.torrent"`)
      .send(buffer);
  });

  app.get('/api/v1/user/me', async (req, reply) => {
    const user = await resolveV1User(req);
    const row = await queryOne(
      `SELECT u.id, u.username, u.uploaded, u.downloaded,
              CASE WHEN u.downloaded = 0 THEN NULL ELSE ROUND(u.uploaded / u.downloaded, 3) END AS ratio,
              u.created_at, u.last_seen_at, g.name AS group_name
       FROM users u JOIN user_groups g ON g.id=u.group_id WHERE u.id = ?`, [user.id],
    );
    return reply.send(row);
  });

  app.get('/api/v1/user/me/hnr', async (req, reply) => {
    const user = await resolveV1User(req);
    const rows = await query(
      `SELECT h.id, h.torrent_id, t.name AS torrent_name, h.status,
              h.seeded_time_mins, h.seed_deadline_at
       FROM hit_and_runs h JOIN torrents t ON t.id=h.torrent_id
       WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 50`, [user.id],
    );
    return reply.send({ hnr: rows });
  });

  app.get('/api/v1/user/me/flux', async (req, reply) => {
    const user = await resolveV1User(req);
    const balance = await queryOne<{ flux: number }>('SELECT flux FROM users WHERE id = ?', [user.id]);
    const transactions = await query(
      'SELECT amount, source, created_at FROM flux_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [user.id],
    );
    return reply.send({ balance: balance?.flux ?? 0, transactions });
  });

  app.get('/api/v1/user/me/snatches', async (req, reply) => {
    const user = await resolveV1User(req);
    const rows = await query(
      `SELECT s.torrent_id, t.name, s.completed_at
       FROM torrent_snatches s JOIN torrents t ON t.id=s.torrent_id
       WHERE s.user_id = ? ORDER BY s.completed_at DESC LIMIT 50`, [user.id],
    );
    return reply.send({ snatches: rows });
  });

  app.get('/api/v1/requests', async (req, reply) => {
    await resolveV1User(req);
    const rows = await query(
      `SELECT r.id, r.title, r.description, r.bounty_flux, r.is_filled, r.created_at,
              u.username, c.label AS category_name
       FROM torrent_requests r JOIN users u ON u.id=r.user_id LEFT JOIN categories c ON c.id=r.category_id
       WHERE r.is_filled = FALSE ORDER BY r.bounty_flux DESC LIMIT 50`,
    );
    return reply.send({ requests: rows });
  });

  app.post('/api/v1/requests', async (req, reply) => {
    const user = await resolveV1User(req);
    const parsed = z.object({
      title: z.string().min(3).max(500),
      description: z.string().max(5000).optional(),
      category_id: z.number().int().positive().optional(),
      bounty_flux: z.number().min(0).default(0),
    }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    await execute(
      'INSERT INTO torrent_requests (user_id, title, description, category_id, bounty_flux) VALUES (?,?,?,?,?)',
      [user.id, parsed.data.title, parsed.data.description ?? null, parsed.data.category_id ?? null, parsed.data.bounty_flux],
    );
    return reply.status(201).send({ ok: true });
  });
};
