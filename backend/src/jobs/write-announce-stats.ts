import { execute, executeAffected } from '../lib/db';
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

export async function writeAnnounceStats(data: WriteStatsPayload): Promise<void> {
  const { user_id, torrent_id, uploaded_delta, downloaded_delta, is_freeleech, event, peer_id, ip } = data;

  if (uploaded_delta > 0 || downloaded_delta > 0) {
    const affected = await executeAffected(
      'UPDATE users SET uploaded = uploaded + ?, downloaded = downloaded + ? WHERE id = ?',
      [uploaded_delta, downloaded_delta, user_id],
    );
    if (affected === 0) {
      logger.warn({ user_id }, 'writeAnnounceStats: user not found');
    }
  }

  await execute(
    `INSERT INTO announce_stats (user_id, torrent_id, uploaded_delta, downloaded_delta, is_freeleech, event, peer_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, torrent_id, uploaded_delta, downloaded_delta, is_freeleech, event, peer_id, ip],
  );
}
