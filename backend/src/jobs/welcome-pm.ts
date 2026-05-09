import { execute, queryOne } from '../lib/db';

interface WelcomePmPayload {
  user_id: number;
}

export async function sendWelcomePm(data: WelcomePmPayload): Promise<void> {
  const enabledRow = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'welcome_pm_enabled' LIMIT 1",
  );
  if (enabledRow?.value !== 'true') return;

  const systemUser = await queryOne<{ id: number }>(
    "SELECT id FROM users WHERE username = 'System' LIMIT 1",
  );
  if (!systemUser) return;

  const subjectRow = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'welcome_pm_subject' LIMIT 1",
  );
  const bodyRow = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'welcome_pm_body' LIMIT 1",
  );

  const subject = subjectRow?.value ?? 'Welcome to NGTT';
  const body = bodyRow?.value ?? 'Welcome! Please read the rules before uploading.';

  await execute(
    'INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?)',
    [systemUser.id, data.user_id, subject, body],
  );
}
