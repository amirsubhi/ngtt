import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encode } from 'bencodec';
import { queryOne } from '../lib/db';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { getSeederCount, getLeecherCount } from './peers';

const USER_CACHE_TTL = 300;

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
  }
  return hashes;
}

export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/scrape/:passkey', async (req: FastifyRequest<{ Params: { passkey: string } }>, reply: FastifyReply) => {
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

      const files: Record<string, unknown> = {};
      for (const hash of hashes) {
        const [complete, incomplete] = await Promise.all([
          getSeederCount(hash),
          getLeecherCount(hash),
        ]);
        const row = await queryOne<{ times_completed: number }>(
          `SELECT COUNT(*) AS times_completed FROM torrent_snatches
           WHERE torrent_id = (SELECT id FROM torrents WHERE info_hash = ? LIMIT 1)`,
          [hash],
        );
        files[hash] = { complete, incomplete, downloaded: row?.times_completed ?? 0 };
      }

      return reply.send(Buffer.from(encode({ files })));
    } catch (err) {
      logger.error(err, 'scrape handler error');
      return reply.send(failure('internal error'));
    }
  });
}
