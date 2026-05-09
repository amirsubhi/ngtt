import { redis } from '../lib/redis';
import { query, queryOne, execute } from '../lib/db';
import { logger } from '../lib/logger';

// Batches flux awards for all active seeders — one UPDATE per user, not per torrent
export async function awardSeedingFlux(): Promise<void> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'flux_per_torrent_hour' LIMIT 1",
  );
  const fluxPerTorrentHour = parseFloat(setting?.value ?? '1.0');
  if (fluxPerTorrentHour <= 0) return;

  // Scan all peer hashes (Redis TTL ensures only active torrents remain)
  const peerKeys = await redis.keys('peers:*');
  if (peerKeys.length === 0) return;

  // Tally seeding counts per user_id
  const seederCounts = new Map<number, number>();
  for (const key of peerKeys) {
    const entries = await redis.hgetall(key);
    if (!entries) continue;
    for (const raw of Object.values(entries)) {
      try {
        const peer = JSON.parse(raw) as { user_id: number; seeder: boolean };
        if (peer.seeder && peer.user_id) {
          seederCounts.set(peer.user_id, (seederCounts.get(peer.user_id) ?? 0) + 1);
        }
      } catch { /* malformed entry */ }
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
