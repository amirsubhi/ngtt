import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

// Redis TTL handles expiry automatically (EXPIRE 2700 on each announce).
// This job logs peer counts for monitoring only.
export async function logPeerCounts(): Promise<void> {
  const keys = await redis.keys('peers:*');
  let totalPeers = 0;
  for (const key of keys) {
    const count = await redis.hlen(key);
    totalPeers += count;
  }
  logger.info({ torrent_count: keys.length, total_peers: totalPeers }, 'peer count snapshot');
}
