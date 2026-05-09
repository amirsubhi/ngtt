import { query, queryOne, execute } from '../lib/db';
import { jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';

interface PruneSetting { value: string }

async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await queryOne<PruneSetting>('SELECT value FROM site_settings WHERE `key` = ? LIMIT 1', [key]);
  return row?.value ?? fallback;
}

export async function pruneUsers(): Promise<void> {
  const warnDays   = parseInt(await getSetting('inactivity_warn_days',   '150'), 10);
  const pruneDays  = parseInt(await getSetting('inactivity_prune_days',  '180'), 10);
  const deleteDays = parseInt(await getSetting('inactivity_delete_days', '210'), 10);
  const exemptRaw  = await getSetting('prune_exempt_classes', '["vip","uploader","moderator","admin"]');

  let exemptSlugs: string[] = [];
  try { exemptSlugs = JSON.parse(exemptRaw) as string[]; } catch { /* fallback to empty */ }

  const exemptPlaceholders = exemptSlugs.length
    ? `AND ug.slug NOT IN (${exemptSlugs.map(() => '?').join(',')})`
    : '';

  // Step 1 — warn users inactive >= warnDays but not yet warned
  const toWarn = await query<{ id: number; email: string; username: string }>(
    `SELECT u.id, u.email, u.username
     FROM users u
     JOIN user_groups ug ON ug.id = u.group_id
     LEFT JOIN user_preferences up ON up.user_id = u.id
     WHERE u.is_deleted = FALSE
       AND u.is_banned = FALSE
       AND u.last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND u.last_seen_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND (up.inactivity_warned_at IS NULL)
       ${exemptPlaceholders}`,
    [warnDays, pruneDays, ...exemptSlugs],
  );

  for (const user of toWarn) {
    void jobsQueue.add('send-email', {
      to_user_id: user.id,
      template: 'inactivity-warning',
      vars: { days: String(warnDays), prune_days: String(pruneDays) },
    });
    await execute(
      'INSERT INTO user_preferences (user_id, inactivity_warned_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE inactivity_warned_at = NOW()',
      [user.id],
    );
    logger.info({ user_id: user.id }, 'inactivity warning sent');
  }

  // Step 2 — soft-disable users inactive >= pruneDays
  const toDisable = await query<{ id: number }>(
    `SELECT u.id
     FROM users u
     JOIN user_groups ug ON ug.id = u.group_id
     WHERE u.is_deleted = FALSE
       AND u.is_banned = FALSE
       AND u.last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       ${exemptPlaceholders}`,
    [pruneDays, ...exemptSlugs],
  );

  for (const user of toDisable) {
    await execute(
      "UPDATE users SET is_banned = TRUE, ban_reason = 'Inactive' WHERE id = ? AND is_banned = FALSE",
      [user.id],
    );
    logger.info({ user_id: user.id }, 'user disabled for inactivity');
  }

  // Step 3 — delete users inactive >= deleteDays who were soft-banned for inactivity
  const toDelete = await query<{ id: number }>(
    `SELECT u.id
     FROM users u
     JOIN user_groups ug ON ug.id = u.group_id
     WHERE u.is_banned = TRUE
       AND u.ban_reason = 'Inactive'
       AND u.last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       ${exemptPlaceholders}`,
    [deleteDays, ...exemptSlugs],
  );

  for (const user of toDelete) {
    // Anonymize their uploads before deleting
    await execute('UPDATE torrents SET uploader_id = NULL WHERE uploader_id = ?', [user.id]);
    await execute('DELETE FROM users WHERE id = ?', [user.id]);
    logger.info({ user_id: user.id }, 'inactive user deleted');
  }

  logger.info({
    warned: toWarn.length,
    disabled: toDisable.length,
    deleted: toDelete.length,
  }, 'prune-users complete');
}
