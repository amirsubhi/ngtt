import { queryOne, execute } from '../lib/db';
import { logger } from '../lib/logger';

interface HnrUpdatePayload {
  user_id: number;
  torrent_id: number;
}

interface HnrRow {
  id: number;
  seeded_time_mins: number;
  seed_deadline_at: Date;
  status: string;
}

export async function updateHnr(data: HnrUpdatePayload): Promise<void> {
  const { user_id, torrent_id } = data;

  const hnr = await queryOne<HnrRow>(
    "SELECT id, seeded_time_mins, seed_deadline_at, status FROM hit_and_runs WHERE user_id = ? AND torrent_id = ? AND status = 'active' LIMIT 1",
    [user_id, torrent_id],
  );

  if (!hnr) {
    // Create HnR record when download completes (event=completed)
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM site_settings WHERE `key` = 'hnr_seed_requirement_hours' LIMIT 1",
    );
    const requiredHours = parseFloat(setting?.value ?? '72');

    await execute(
      `INSERT INTO hit_and_runs (user_id, torrent_id, downloaded_at, seed_deadline_at)
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))
       ON DUPLICATE KEY UPDATE seed_deadline_at = DATE_ADD(NOW(), INTERVAL ? HOUR)`,
      [user_id, torrent_id, requiredHours, requiredHours],
    );
    return;
  }

  if (hnr.status !== 'active') return;

  // Add announce interval worth of seed time and check if resolved
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'announce_interval' LIMIT 1",
  );
  const intervalMins = Math.round(parseInt(setting?.value ?? '1800', 10) / 60);
  const newSeededMins = hnr.seeded_time_mins + intervalMins;

  // Resolved if seeded past deadline requirement
  const deadlineMs = new Date(hnr.seed_deadline_at).getTime() - Date.now();
  const requiredMins = Math.ceil(deadlineMs / 60000 + newSeededMins);
  const resolved = newSeededMins >= requiredMins || new Date() < hnr.seed_deadline_at;

  if (resolved) {
    await execute(
      "UPDATE hit_and_runs SET seeded_time_mins = ?, status = 'resolved' WHERE id = ?",
      [newSeededMins, hnr.id],
    );
    logger.info({ user_id, torrent_id }, 'HnR resolved');
  } else {
    await execute(
      'UPDATE hit_and_runs SET seeded_time_mins = ? WHERE id = ?',
      [newSeededMins, hnr.id],
    );
  }
}
