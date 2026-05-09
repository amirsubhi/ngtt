import { execute } from '../lib/db';

interface SendNotifPayload {
  user_id: number;
  type: string;
  message: string;
  link?: string;
}

export async function createNotification(data: SendNotifPayload): Promise<void> {
  await execute(
    'INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)',
    [data.user_id, data.type, data.message, data.link ?? null],
  );
}
