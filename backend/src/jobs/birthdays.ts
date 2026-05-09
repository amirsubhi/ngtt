import { query, execute } from '../lib/db';
import { jobsQueue } from '../lib/queues';
import { logger } from '../lib/logger';
import { queryOne } from '../lib/db';

export async function awardBirthdayFlux(): Promise<void> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'birthdays_enabled' LIMIT 1",
  );
  if (setting?.value !== 'true') return;

  const rewardSetting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'flux_birthday_reward' LIMIT 1",
  );
  const reward = parseFloat(rewardSetting?.value ?? '100');
  if (reward <= 0) return;

  const users = await query<{ id: number; username: string }>(
    `SELECT id, username FROM users
     WHERE DATE(birth_date) = CURDATE()
       AND show_birthday = TRUE
       AND is_deleted = FALSE
       AND is_banned = FALSE`,
  );

  if (users.length === 0) return;

  for (const user of users) {
    await execute('UPDATE users SET flux = flux + ? WHERE id = ?', [reward, user.id]);
    await execute(
      "INSERT INTO flux_transactions (user_id, amount, type, source, description) VALUES (?, ?, 'earn', 'birthday', 'Happy Birthday!')",
      [user.id, reward],
    );
    void jobsQueue.add('send-notif', {
      user_id: user.id,
      title: 'Happy Birthday!',
      body: `You've received ${reward} FLX as a birthday gift!`,
      url: '/bonus',
    });
  }

  const names = users.map(u => u.username).join(', ');
  void jobsQueue.add('shoutbox-archive', {
    user_id: null,
    username: 'System',
    group_color: '#6366f1',
    content: `🎂 Happy Birthday to: ${names}!`,
    is_system: true,
  });

  logger.info({ count: users.length }, 'birthday flux awarded');
}
