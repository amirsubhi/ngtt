import { redis } from '../lib/redis';
import { queryOne, execute } from '../lib/db';
import { logger } from '../lib/logger';

// Batches flux awards for all active seeders — one UPDATE per user, not per torrent
export async function awardSeedingFlux(): Promise<void> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'flux_per_torrent_hour' LIMIT 1",
  );
  const fluxPerTorrentHour = parseFloat(setting?.value ?? '1.0');
  if (fluxPerTorrentHour <= 0) return;

  // SCAN instead of KEYS to avoid blocking Redis
  const peerKeys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'peers:*', 'COUNT', 100);
    cursor = nextCursor;
    peerKeys.push(...keys);
  } while (cursor !== '0');

  if (peerKeys.length === 0) return;

  // Tally seeding counts per user_id
  const seederCounts = new Map<number, number>();
  for (const key of peerKeys) {
    const entries = await redis.hgetall(key);
    if (!entries) continue;
    for (const [, raw] of Object.entries(entries)) {
      try {
        const peer = JSON.parse(raw) as { user_id: number; seeder: boolean };
        if (peer.seeder && peer.user_id) {
          seederCounts.set(peer.user_id, (seederCounts.get(peer.user_id) ?? 0) + 1);
        }
      } catch (err) {
        logger.warn({ err, key, raw }, 'seed-rewards: malformed peer entry, skipping');
      }
    }
  }

  if (seederCounts.size === 0) return;

  let awarded = 0;
  for (const [userId, count] of seederCounts) {
    const amount = parseFloat((count * fluxPerTorrentHour).toFixed(2));
    await execute('UPDATE users SET flux = flux + ? WHERE id = ? AND is_deleted = FALSE', [amount, userId]);
    await execute(
      "INSERT INTO flux_transactions (user_id, amount, type, source, description) VALUES (?, ?, 'earn', 'seeding', ?)",
      [userId, amount, `Seeding ${count} torrent${count > 1 ? 's' : ''}`],
    );
    awarded++;
  }

  logger.info({ users_awarded: awarded, torrent_keys: peerKeys.length }, 'seed-rewards job complete');
}
