import { query, queryOne, execute } from '../lib/db';
import { jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';

interface UserToCheck {
  id: number;
  uploaded: number;
  downloaded: number;
  created_at: string;
}

interface GroupRequirements {
  id: number;
  slug: string;
  min_ratio: number;
  min_upload: number;
  min_age_days: number;
}

export async function promoteUsers(): Promise<void> {
  const powerUser = await queryOne<GroupRequirements>(
    "SELECT id, slug, min_ratio, min_upload, min_age_days FROM user_groups WHERE slug = 'power-user' LIMIT 1",
  );
  if (!powerUser) return;

  const memberGroup = await queryOne<{ id: number }>(
    "SELECT id FROM user_groups WHERE slug = 'member' LIMIT 1",
  );
  if (!memberGroup) return;

  const candidates = await query<UserToCheck>(
    'SELECT id, uploaded, downloaded, created_at FROM users WHERE group_id = ? AND is_deleted = FALSE AND is_banned = FALSE',
    [memberGroup.id],
  );

  let promoted = 0;
  for (const user of candidates) {
    const ratio = user.downloaded > 0 ? user.uploaded / user.downloaded : null;
    const ageDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);

    const meetsRatio = powerUser.min_ratio === 0 || (ratio !== null && ratio >= powerUser.min_ratio);
    const meetsUpload = powerUser.min_upload === 0 || user.uploaded >= powerUser.min_upload;
    const meetsAge = powerUser.min_age_days === 0 || ageDays >= powerUser.min_age_days;

    if (meetsRatio && meetsUpload && meetsAge) {
      await execute('UPDATE users SET group_id = ? WHERE id = ?', [powerUser.id, user.id]);
      void jobsQueue.add('send-notif', {
        user_id: user.id,
        type: 'promotion',
        title: 'Congratulations! You have been promoted to Power User.',
        url: '/settings',
      });
      void jobsQueue.add('send-email', {
        to_user_id: user.id,
        template: 'promotion',
        vars: { group_name: 'Power User' },
      });
      promoted++;
      logger.info({ user_id: user.id }, 'User promoted to Power User');
    }
  }

  if (promoted > 0) {
    logger.info({ promoted }, 'User promotion job complete');
  }
}
