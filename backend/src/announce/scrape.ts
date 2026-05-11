import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encode } from 'bencodec';
import { query, queryOne } from '../lib/db';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { announceRateLimit } from '../middleware/rateLimiter';
import { getSwarmData } from './peers';

const USER_CACHE_TTL = 300;
const MAX_SCRAPE_HASHES = 50;

function failure(msg: string): Buffer {
  return Buffer.from(encode({ 'failure reason': msg }));
}

function parseInfoHashes(rawUrl: string): string[] {
  const hashes: string[] = [];
  const regex = /[?&]info_hash=([^&]*)/g;
  let match;
  while ((match = regex.exec(rawUrl)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1].replace(/\+/g, '%20'));
      const hex = Buffer.from(decoded, 'latin1').toString('hex');
      if (hex.length === 40) hashes.push(hex);
    } catch {
      // skip malformed
    }
    if (hashes.length >= MAX_SCRAPE_HASHES) break;
  }
  return hashes;
}

export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/scrape/:passkey', { config: announceRateLimit.config }, async (req: FastifyRequest<{ Params: { passkey: string } }>, reply: FastifyReply) => {
    reply.header('Content-Type', 'text/plain');

    try {
      const { passkey } = req.params;

      const cacheKey = `passkey:${passkey}`;
      const cached = await redis.get(cacheKey);
      let valid = !!cached;
      if (!valid) {
        const user = await queryOne<{ id: number }>(
          'SELECT id FROM users WHERE passkey = ? AND is_banned = FALSE LIMIT 1',
          [passkey],
        );
        if (user) {
          await redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
          valid = true;
        }
      }
      if (!valid) return reply.send(failure('passkey not found'));

      const rawUrl = req.raw.url ?? '';
      const hashes = parseInfoHashes(rawUrl);
      if (hashes.length === 0) return reply.send(failure('no info_hash'));

      // Batch torrent lookup + snatch counts — 2 queries total regardless of hash count
      // Unknown hashes are silently omitted from files{} (downloaded: 0) per BEP 48 spec
      const torrentRows = await query<{ info_hash: string; id: number }>(
        `SELECT info_hash, id FROM torrents WHERE info_hash IN (${hashes.map(() => '?').join(',')})`,
        hashes,
      );
      const torrentIdByHash = new Map(torrentRows.map(r => [r.info_hash, r.id]));
      const torrentIds = torrentRows.map(r => r.id);

      const snatchMap = new Map<number, number>();
      if (torrentIds.length > 0) {
        const snatchRows = await query<{ torrent_id: number; cnt: number }>(
          `SELECT torrent_id, COUNT(*) AS cnt FROM torrent_snatches WHERE torrent_id IN (${torrentIds.map(() => '?').join(',')}) GROUP BY torrent_id`,
          torrentIds,
        );
        for (const row of snatchRows) snatchMap.set(row.torrent_id, Number(row.cnt));
      }

      // Parallel Redis reads — all independent
      const files: Record<string, unknown> = {};
      await Promise.all(hashes.map(async hash => {
        const { seeders, leechers } = await getSwarmData(hash, 0);
        const torrentId = torrentIdByHash.get(hash);
        files[hash] = {
          complete: seeders,
          incomplete: leechers,
          downloaded: torrentId !== undefined ? (snatchMap.get(torrentId) ?? 0) : 0,
        };
      }));

      return reply.send(Buffer.from(encode({ files })));
    } catch (err) {
      logger.error(err, 'scrape handler error');
      return reply.send(failure('internal error'));
    }
  });
}
