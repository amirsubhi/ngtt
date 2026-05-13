import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encode } from 'bencodec';
import { query, queryOne, execute } from '../lib/db';
import { redis } from '../lib/redis';
import { statsQueue, jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';
import { config } from '../lib/config';
import { announceRateLimit } from '../middleware/rateLimiter';
import { updatePeer, removePeer, getSwarmData } from './peers';
import { compactPeers, compactPeers6 } from './bencode-compact';

const USER_CACHE_TTL = 300; // 5 min — ban endpoint deletes this key immediately on ban
const TORRENT_CACHE_TTL = 60; // 1 min — invalidate on edit/takedown
const BANNED_CLIENT_CACHE_KEY = 'banned_clients_cache';
const BANNED_CLIENT_CACHE_TTL = 300;

const VALID_EVENTS = new Set(['started', 'completed', 'stopped', '']);

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

// F-5: Guard against NaN/negative from client query params
function parseIntParam(val: string | undefined, def: number): number {
  const n = parseInt(val ?? String(def), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
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

// F-4: Cache torrent metadata — changes rarely; 60s TTL is safe
async function getTorrentByHash(infoHash: string): Promise<AnnounceTorrent | null> {
  const cacheKey = `torrent:meta:${infoHash}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as AnnounceTorrent;

  const torrent = await queryOne<AnnounceTorrent>(
    'SELECT id, status, is_freeleech, uploader_id FROM torrents WHERE info_hash = ? LIMIT 1',
    [infoHash],
  );
  if (torrent) {
    await redis.setex(cacheKey, TORRENT_CACHE_TTL, JSON.stringify(torrent));
  }
  return torrent;
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
  // `used` column is never set to TRUE — freeleech is unlimited within the 24-hour window
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM personal_freeleech
     WHERE user_id = ? AND (torrent_id = ? OR torrent_id IS NULL)
       AND expires_at > NOW() LIMIT 1`,
    [userId, torrentId],
  );
  return row !== null;
}

async function getSiteSetting(key: string): Promise<string | null> {
  const cacheKey = `site_setting:${key}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key` = ? LIMIT 1', [key]);
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
      const port = parseIntParam(query_['port'], 0);
      const uploaded = parseIntParam(query_['uploaded'], 0);
      const downloaded = parseIntParam(query_['downloaded'], 0);
      const left = parseIntParam(query_['left'], 0);
      // F-7: whitelist event values — reject anything outside the spec
      const event = VALID_EVENTS.has(query_['event'] ?? '') ? (query_['event'] ?? '') : '';
      const numwant = Math.min(parseIntParam(query_['numwant'], 50), 200);
      const compact = query_['compact'] !== '0';
      const ip = req.ip.split(',')[0].trim();

      if (!peerId || port < 1 || port > 65535) {
        return reply.send(failure('missing required params'));
      }

      // User lookup
      const user = await getUserByPasskey(passkey);
      if (!user) return reply.send(failure('passkey not found'));

      // Ban check
      if (user.is_banned) return reply.send(failure('user is banned'));

      // Torrent lookup (F-4: cached)
      const torrent = await getTorrentByHash(infoHash);
      if (!torrent || torrent.status !== 'approved') {
        return reply.send(failure('torrent not found or not approved'));
      }

      // Client ban check
      if (await isClientBanned(peerId.slice(0, 8))) {
        return reply.send(failure('client is banned'));
      }

      // Anti-cheat: speed spike detection (fire-and-forget)
      const prevRaw = await redis.hget(`peers:${infoHash}`, peerId);
      if (prevRaw) {
        const prev = JSON.parse(prevRaw) as { uploaded: number; updated_at: number };
        const uploadedDelta = uploaded - prev.uploaded;
        const timeDelta = (Date.now() - prev.updated_at) / 1000;
        if (timeDelta > 0 && uploadedDelta > 0) {
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

      // F-1: When there's no previous Redis state (first announce OR TTL expired), use
      // the current cumulative values as the baseline so the delta is 0 rather than
      // awarding the entire cumulative total as a fresh delta.
      const prev = prevRaw
        ? JSON.parse(prevRaw) as { uploaded: number; downloaded: number }
        : { uploaded: uploaded, downloaded: downloaded };
      const uploadedDelta   = Math.max(0, uploaded   - prev.uploaded);
      const downloadedDelta = Math.max(0, downloaded - prev.downloaded);

      // Effective download (freeleech)
      const globalFreeleech = (await getSiteSetting('global_freeleech')) === 'true';
      const freeleech = globalFreeleech || torrent.is_freeleech || await isPersonalFreeleech(user.id, torrent.id);
      const effectiveDownload = freeleech ? 0 : downloadedDelta;

      // Update peer in Redis
      if (event !== 'stopped') {
        await updatePeer(infoHash, peerId, {
          ip, port,
          uploaded, downloaded, left,
          seeder: left === 0,
          user_id: user.id,
          peer_id: peerId,
          updated_at: Date.now(),
        });
      } else {
        await removePeer(infoHash, peerId);
      }

      // Queue stat write (never await — keep announce path lean)
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

      // H&R accumulation and snatch record
      if (left === 0) {
        void jobsQueue.add('hnr-update', {
          user_id: user.id,
          torrent_id: torrent.id,
          is_freeleech: freeleech,
          info_hash: infoHash,
          completed: event === 'completed',
        });
        if (event === 'completed') {
          // F-6: use already-imported execute directly — no dynamic import needed
          void execute(
            'INSERT IGNORE INTO torrent_snatches (user_id, torrent_id) VALUES (?, ?)',
            [user.id, torrent.id],
          ).catch(err => logger.error(err, 'snatch upsert failed'));
        }
      }

      // Single HGETALL pass for all swarm data (P-1)
      const { peers: allPeers, seeders, leechers } = await getSwarmData(infoHash, numwant);

      const announceInterval = parseIntParam(await getSiteSetting('announce_interval') ?? undefined, config.announceInterval);
      const minInterval = parseIntParam(await getSiteSetting('min_announce_interval') ?? undefined, config.minAnnounceInterval);

      const response: Record<string, unknown> = {
        interval: announceInterval,
        'min interval': minInterval,
        complete: seeders,
        incomplete: leechers,
      };

      if (compact) {
        response['peers'] = compactPeers(allPeers);
        // F-3/BEP 7: include peers6 when IPv6 peers exist so IPv6-only clients can connect
        const p6 = compactPeers6(allPeers);
        if (p6.length > 0) response['peers6'] = p6;
      } else {
        // F-8: use the actual peer_id reported by the client, not the internal user_id
        response['peers'] = allPeers.map(p => ({
          'peer id': p.peer_id,
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
