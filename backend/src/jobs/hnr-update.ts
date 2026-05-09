import { queryOne, execute } from '../lib/db';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

interface HnrUpdatePayload {
  user_id: number;
  torrent_id: number;
  is_freeleech: boolean;
  info_hash: string;
}

const ANNOUNCE_INTERVAL_MINS = 30;

async function isUserSeeding(infoHash: string, userId: number): Promise<boolean> {
  const entries = await redis.hgetall(`peers:${infoHash}`);
  if (!entries) return false;
  return Object.values(entries).some(raw => {
    try {
      const p = JSON.parse(raw) as { user_id: number; seeder: boolean };
      return p.user_id === userId && p.seeder;
    } catch { return false; }
  });
}

export async function updateHnr(data: HnrUpdatePayload): Promise<void> {
  const { user_id, torrent_id, is_freeleech, info_hash } = data;

  // 8e: skip H&R entirely for freeleech
  if (is_freeleech) return;

  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'hnr_grace_hours' LIMIT 1",
  );
  const graceHours = parseFloat(setting?.value ?? '72');
  const requiredMins = graceHours * 60;

  const hnr = await queryOne<{ id: number; seeded_time_mins: number; status: string }>(
    "SELECT id, seeded_time_mins, status FROM hit_and_runs WHERE user_id = ? AND torrent_id = ? LIMIT 1",
    [user_id, torrent_id],
  );

  if (!hnr) {
    // First completion — create the record
    await execute(
      `INSERT INTO hit_and_runs (user_id, torrent_id, downloaded_at, seed_deadline_at)
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))
       ON DUPLICATE KEY UPDATE downloaded_at = downloaded_at`,
      [user_id, torrent_id, graceHours],
    );
    return;
  }

  if (hnr.status !== 'active') return;

  // Only increment if user is currently seeding
  const seeding = await isUserSeeding(info_hash, user_id);
  if (!seeding) return;

  const newMins = hnr.seeded_time_mins + ANNOUNCE_INTERVAL_MINS;

  if (newMins >= requiredMins) {
    await execute(
      "UPDATE hit_and_runs SET seeded_time_mins = ?, status = 'resolved' WHERE id = ?",
      [newMins, hnr.id],
    );
    logger.info({ user_id, torrent_id }, 'HnR resolved');
  } else {
    await execute('UPDATE hit_and_runs SET seeded_time_mins = ? WHERE id = ?', [newMins, hnr.id]);
  }
}
