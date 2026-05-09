import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

// Redis TTL handles expiry automatically (EXPIRE 2700 on each announce).
// This job logs peer counts for monitoring only.
export async function logPeerCounts(): Promise<void> {
  const peerKeys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'peers:*', 'COUNT', 100);
    cursor = nextCursor;
    peerKeys.push(...keys);
  } while (cursor !== '0');

  let totalPeers = 0;
  for (const key of peerKeys) {
    const count = await redis.hlen(key);
    totalPeers += count;
  }
  logger.info({ torrent_count: peerKeys.length, total_peers: totalPeers }, 'peer count snapshot');
}
