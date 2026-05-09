import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encode } from 'bencodec';
import { query, queryOne } from '../lib/db';
import { redis } from '../lib/redis';
import { statsQueue, jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';
import { config } from '../lib/config';
import { announceRateLimit } from '../middleware/rateLimiter';
import { updatePeer, removePeer, getPeers } from './peers';
import { compactPeers } from './bencode-compact';

const USER_CACHE_TTL = 300; // 5 min
const BANNED_CLIENT_CACHE_KEY = 'banned_clients_cache';
const BANNED_CLIENT_CACHE_TTL = 300;

interface AnnounceUser {
  id: number;
  is_banned: boolean;
  uploaded: number;
  downloaded: number;
}

interface AnnounceTorrent {
  id: number;
  status: string;
  is_freeleech: boolean;
  uploader_id: number;
}

function failure(msg: string): Buffer {
  return Buffer.from(encode({ 'failure reason': msg }));
}

// Parse raw binary info_hash from the request URL (percent-encoded Latin-1 bytes)
function parseInfoHash(rawUrl: string): string | null {
  const match = rawUrl.match(/[?&]info_hash=([^&]*)/);
  if (!match) return null;
  const encoded = match[1];
  try {
    const decoded = decodeURIComponent(encoded.replace(/\+/g, '%20'));
    return Buffer.from(decoded, 'latin1').toString('hex');
  } catch {
    return null;
  }
}

async function getUserByPasskey(passkey: string): Promise<AnnounceUser | null> {
  const cacheKey = `passkey:${passkey}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as AnnounceUser;

  const user = await queryOne<AnnounceUser>(
    'SELECT id, is_banned, uploaded, downloaded FROM users WHERE passkey = ? LIMIT 1',
    [passkey],
  );
  if (user) {
    await redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
  }
  return user;
}

async function getTorrentByHash(infoHash: string): Promise<AnnounceTorrent | null> {
  return queryOne<AnnounceTorrent>(
    'SELECT id, status, is_freeleech, uploader_id FROM torrents WHERE info_hash = ? LIMIT 1',
    [infoHash],
  );
}

async function isClientBanned(peerIdPrefix: string): Promise<boolean> {
  const cached = await redis.get(BANNED_CLIENT_CACHE_KEY);
  let banned: string[];
  if (cached) {
    banned = JSON.parse(cached) as string[];
  } else {
    const rows = await query<{ peer_id_prefix: string }>(
      'SELECT peer_id_prefix FROM banned_clients',
    );
    banned = rows.map(r => r.peer_id_prefix);
    await redis.setex(BANNED_CLIENT_CACHE_KEY, BANNED_CLIENT_CACHE_TTL, JSON.stringify(banned));
  }
  return banned.includes(peerIdPrefix);
}

async function isPersonalFreeleech(userId: number, torrentId: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM personal_freeleech
     WHERE user_id = ? AND (torrent_id = ? OR torrent_id IS NULL)
       AND expires_at > NOW() AND used = FALSE LIMIT 1`,
    [userId, torrentId],
  );
  return row !== null;
}

async function getSiteSetting(key: string): Promise<string | null> {
  const cacheKey = `site_setting:${key}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE key = ? LIMIT 1', [key]);
  if (row) {
    await redis.setex(cacheKey, 60, row.value);
    return row.value;
  }
  return null;
}

export async function announceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/announce/:passkey', { config: announceRateLimit.config }, async (req: FastifyRequest<{ Params: { passkey: string } }>, reply: FastifyReply) => {
    reply.header('Content-Type', 'text/plain');

    try {
      const { passkey } = req.params;
      const rawUrl = (req.raw.url ?? '');
      const query_ = req.query as Record<string, string | undefined>;

      const infoHash = parseInfoHash(rawUrl);
      if (!infoHash || infoHash.length !== 40) {
        return reply.send(failure('invalid info_hash'));
      }

      const peerId = query_['peer_id'];
      const port = parseInt(query_['port'] ?? '0', 10);
      const uploaded = parseInt(query_['uploaded'] ?? '0', 10);
      const downloaded = parseInt(query_['downloaded'] ?? '0', 10);
      const left = parseInt(query_['left'] ?? '0', 10);
      const event = query_['event'] ?? '';
      const numwant = Math.min(parseInt(query_['numwant'] ?? '50', 10), 200);
      const compact = query_['compact'] !== '0';
      const ip = (query_['ip'] ?? req.ip).split(',')[0].trim();

      if (!peerId || port < 1 || port > 65535) {
        return reply.send(failure('missing required params'));
      }

      // 2. User lookup
      const user = await getUserByPasskey(passkey);
      if (!user) return reply.send(failure('passkey not found'));

      // 3. Ban check
      if (user.is_banned) return reply.send(failure('user is banned'));

      // 5. Torrent lookup
      const torrent = await getTorrentByHash(infoHash);
      if (!torrent || torrent.status !== 'approved') {
        return reply.send(failure('torrent not found or not approved'));
      }

      // 6. Client ban check
      if (await isClientBanned(peerId.slice(0, 8))) {
        return reply.send(failure('client is banned'));
      }

      // 7. Anti-cheat: speed spike (never block — just queue signal)
      const prevRaw = await redis.hget(`peers:${infoHash}`, peerId);
      if (prevRaw) {
        const prev = JSON.parse(prevRaw) as { uploaded: number; updated_at: number };
        const uploadedDelta = uploaded - prev.uploaded;
        const timeDelta = (Date.now() - prev.updated_at) / 1000;
        if (timeDelta > 0) {
          const speedBps = (uploadedDelta * 8) / timeDelta;
          if (speedBps > 1_000_000_000) {
            void jobsQueue.add('flag-cheat', {
              user_id: user.id,
              torrent_id: torrent.id,
              type: 'speed_spike',
              speed_bps: speedBps,
              uploaded_delta: uploadedDelta,
              time_delta: timeDelta,
              peer_id: peerId,
              ip,
            });
          }
        }
      }

      // Compute deltas vs previous announce (or from-zero for first announce)
      const prev = prevRaw ? JSON.parse(prevRaw) as { uploaded: number; downloaded: number } : { uploaded: 0, downloaded: 0 };
      const uploadedDelta = Math.max(0, uploaded - prev.uploaded);
      const downloadedDelta = Math.max(0, downloaded - prev.downloaded);

      // 8. Effective download (freeleech)
      const globalFreeleech = (await getSiteSetting('global_freeleech')) === 'true';
      const freeleech = globalFreeleech || torrent.is_freeleech || await isPersonalFreeleech(user.id, torrent.id);
      const effectiveDownload = freeleech ? 0 : downloadedDelta;

      // 9. Update peer in Redis
      if (event !== 'stopped') {
        await updatePeer(infoHash, peerId, {
          ip, port,
          uploaded, downloaded, left,
          seeder: left === 0,
          user_id: user.id,
          updated_at: Date.now(),
        });
      } else {
        // 10. Remove peer on stopped
        await removePeer(infoHash, peerId);
      }

      // 11. Queue stats (never await)
      void statsQueue.add('write-stats', {
        user_id: user.id,
        torrent_id: torrent.id,
        uploaded_delta: uploadedDelta,
        downloaded_delta: effectiveDownload,
        is_freeleech: freeleech,
        event: event || null,
        peer_id: peerId,
        ip,
      });

      // 12. Seeding — fire H&R update on every seeder announce
      if (left === 0) {
        void jobsQueue.add('hnr-update', {
          user_id: user.id,
          torrent_id: torrent.id,
          is_freeleech: freeleech,
          info_hash: infoHash,
        });
        if (event === 'completed') {
          // Upsert snatch record once
          void import('../lib/db').then(({ execute }) =>
            execute(
              'INSERT IGNORE INTO torrent_snatches (user_id, torrent_id) VALUES (?, ?)',
              [user.id, torrent.id],
            ).catch(err => logger.error(err, 'snatch upsert failed')),
          );
        }
      }

      // 13-14. Collect peers and counts
      const allPeers = await getPeers(infoHash, numwant);
      const seeders = allPeers.filter(p => p.seeder).length;
      const leechers = allPeers.filter(p => !p.seeder).length;

      const announceInterval = parseInt((await getSiteSetting('announce_interval')) ?? String(config.announceInterval), 10);
      const minInterval = parseInt((await getSiteSetting('min_announce_interval')) ?? String(config.minAnnounceInterval), 10);

      // 15. Return bencoded response
      const response: Record<string, unknown> = {
        interval: announceInterval,
        'min interval': minInterval,
        complete: seeders,
        incomplete: leechers,
      };

      if (compact) {
        response['peers'] = compactPeers(allPeers);
      } else {
        response['peers'] = allPeers.map(p => ({
          'peer id': p.user_id,
          ip: p.ip,
          port: p.port,
        }));
      }

      return reply.send(Buffer.from(encode(response)));
    } catch (err) {
      logger.error(err, 'announce handler error');
      return reply.send(failure('internal error'));
    }
  });
}
