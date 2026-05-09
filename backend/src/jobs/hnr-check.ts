import { query, execute, queryOne } from '../lib/db';
import { jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';

interface ExpiredHnr {
  id: number;
  user_id: number;
  torrent_id: number;
  torrent_name: string;
}

export async function checkExpiredHnr(): Promise<void> {
  const expired = await query<ExpiredHnr>(
    `SELECT h.id, h.user_id, h.torrent_id, t.name AS torrent_name
     FROM hit_and_runs h
     JOIN torrents t ON t.id = h.torrent_id
     WHERE h.status = 'active' AND h.seed_deadline_at < NOW()`,
  );

  if (expired.length === 0) return;

  const warnSetting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'hnr_warn_threshold' LIMIT 1",
  );
  const banSetting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'hnr_ban_threshold' LIMIT 1",
  );
  const warnThreshold = parseInt(warnSetting?.value ?? '3', 10);
  const banThreshold = parseInt(banSetting?.value ?? '5', 10);

  for (const hnr of expired) {
    await execute("UPDATE hit_and_runs SET status = 'expired' WHERE id = ?", [hnr.id]);

    const countRow = await queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM hit_and_runs WHERE user_id = ? AND status = 'expired'",
      [hnr.user_id],
    );
    const expiredCount = countRow?.count ?? 0;

    if (expiredCount >= banThreshold) {
      await execute(
        'UPDATE users SET is_banned = TRUE, ban_reason = ? WHERE id = ? AND is_banned = FALSE',
        [`Auto-banned: ${expiredCount} expired H&Rs`, hnr.user_id],
      );
      void jobsQueue.add('send-notif', {
        user_id: hnr.user_id,
        title: 'Your account has been banned',
        body: `You have ${expiredCount} expired Hit & Runs. Your account has been automatically suspended.`,
        url: '/support',
      });
      void jobsQueue.add('send-email', {
        to_user_id: hnr.user_id,
        template: 'ban-notice',
        vars: { reason: `Auto-banned: ${expiredCount} expired Hit & Runs` },
      });
    } else if (expiredCount >= warnThreshold) {
      await execute(
        `INSERT INTO user_warnings (user_id, issued_by, reason, type)
         SELECT ?, u.id, ?, 'warning'
         FROM users u JOIN user_groups ug ON ug.id = u.group_id
         WHERE ug.slug = 'admin' AND u.is_deleted = FALSE LIMIT 1`,
        [hnr.user_id, `Automated H&R warning: ${expiredCount} expired H&Rs`],
      );
      void jobsQueue.add('send-notif', {
        user_id: hnr.user_id,
        title: 'Hit & Run Warning',
        body: `You have ${expiredCount} expired Hit & Runs. Further H&Rs may result in a ban.`,
        url: '/profile',
      });
      void jobsQueue.add('send-email', {
        to_user_id: hnr.user_id,
        template: 'hnr-warning',
        vars: { count: String(expiredCount) },
      });
    }

    void jobsQueue.add('send-notif', {
      user_id: hnr.user_id,
      title: 'H&R Expired',
      body: `Your seeding time for "${hnr.torrent_name}" has expired.`,
      url: `/profile`,
    });

    logger.info({ user_id: hnr.user_id, hnr_id: hnr.id, expired_count: expiredCount }, 'H&R expired');
  }

  logger.info({ expired: expired.length }, 'hnr-check complete');
}
