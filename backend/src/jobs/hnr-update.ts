import { queryOne, execute } from '../lib/db';
import { logger } from '../lib/logger';

interface HnrUpdatePayload {
  user_id: number;
  torrent_id: number;
}

interface HnrRecord {
  id: number;
  seeded_time_mins: number;
  required_seed_mins: number;
  fulfilled: boolean;
}

export async function updateHnr(data: HnrUpdatePayload): Promise<void> {
  const { user_id, torrent_id } = data;

  const hnr = await queryOne<HnrRecord>(
    'SELECT id, seeded_time_mins, required_seed_mins, fulfilled FROM hnr_records WHERE user_id = ? AND torrent_id = ? LIMIT 1',
    [user_id, torrent_id],
  );

  if (!hnr) {
    // Create HnR record when download completes
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM site_settings WHERE `key` = 'hnr_seed_requirement_hours' LIMIT 1",
    );
    const requiredHours = parseFloat(setting?.value ?? '72');
    const requiredMins = Math.round(requiredHours * 60);

    await execute(
      `INSERT INTO hnr_records (user_id, torrent_id, required_seed_mins, fulfilled)
       VALUES (?, ?, ?, FALSE)
       ON DUPLICATE KEY UPDATE required_seed_mins = VALUES(required_seed_mins)`,
      [user_id, torrent_id, requiredMins],
    );
    return;
  }

  if (hnr.fulfilled) return;

  // Called periodically via announce — add announce interval worth of seed time
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'announce_interval' LIMIT 1",
  );
  const intervalMins = Math.round(parseInt(setting?.value ?? '1800', 10) / 60);

  const newSeededMins = hnr.seeded_time_mins + intervalMins;
  const fulfilled = newSeededMins >= hnr.required_seed_mins;

  await execute(
    'UPDATE hnr_records SET seeded_time_mins = ?, fulfilled = ? WHERE id = ?',
    [newSeededMins, fulfilled, hnr.id],
  );

  if (fulfilled) {
    logger.info({ user_id, torrent_id }, 'HnR fulfilled');
  }
}
