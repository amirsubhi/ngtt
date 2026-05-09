import { execute, queryOne } from '../lib/db';

interface WelcomePmPayload {
  user_id: number;
}

export async function sendWelcomePm(data: WelcomePmPayload): Promise<void> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'welcome_pm_enabled' LIMIT 1",
  );
  if (setting?.value !== 'true') return;

  const staffAccount = await queryOne<{ id: number }>(
    "SELECT id FROM users WHERE username = 'System' LIMIT 1",
  );
  if (!staffAccount) return;

  await execute(
    "INSERT INTO pm_messages (sender_id, recipient_id, subject, body) VALUES (?, ?, 'Welcome to NGTT', 'Welcome! Please read the rules before uploading.')",
    [staffAccount.id, data.user_id],
  );
}
