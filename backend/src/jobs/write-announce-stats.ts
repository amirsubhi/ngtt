import { execute, executeAffected, queryOne } from '../lib/db';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

interface WriteStatsPayload {
  user_id: number;
  torrent_id: number;
  uploaded_delta: number;
  downloaded_delta: number;
  is_freeleech: boolean;
  event: string | null;
  peer_id: string;
  ip: string;
}

const EVENT_CACHE_KEY = 'site:double_upload_active';
const EVENT_CACHE_TTL = 60; // seconds

async function isDoubleUploadActive(): Promise<boolean> {
  const cached = await redis.get(EVENT_CACHE_KEY);
  if (cached !== null) return cached === '1';

  const row = await queryOne<{ id: number }>(
    "SELECT id FROM upload_events WHERE type = 'double_upload' AND starts_at <= NOW() AND ends_at >= NOW() LIMIT 1",
  );
  const active = row !== null;
  await redis.set(EVENT_CACHE_KEY, active ? '1' : '0', 'EX', EVENT_CACHE_TTL);
  return active;
}

export async function writeAnnounceStats(data: WriteStatsPayload): Promise<void> {
  const { user_id, torrent_id, uploaded_delta, downloaded_delta, is_freeleech, event, peer_id, ip } = data;

  let effectiveUpload = uploaded_delta;
  if (uploaded_delta > 0) {
    const doubleActive = await isDoubleUploadActive();
    if (doubleActive) effectiveUpload = uploaded_delta * 2;
  }

  if (effectiveUpload > 0 || downloaded_delta > 0) {
    const affected = await executeAffected(
      'UPDATE users SET uploaded = uploaded + ?, downloaded = downloaded + ? WHERE id = ?',
      [effectiveUpload, downloaded_delta, user_id],
    );
    if (affected === 0) {
      logger.warn({ user_id }, 'writeAnnounceStats: user not found');
    }
  }

  // F-13: log effectiveUpload so forensic audits can reconcile against users.uploaded
  await execute(
    `INSERT INTO announce_stats (user_id, torrent_id, uploaded_delta, effective_uploaded_delta, downloaded_delta, is_freeleech, event, peer_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, torrent_id, uploaded_delta, effectiveUpload, downloaded_delta, is_freeleech, event, peer_id, ip],
  );
}
