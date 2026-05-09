import { execute } from '../lib/db';

interface SendNotifPayload {
  user_id: number;
  type: string;
  title: string;
  body?: string;
  url?: string;
}

export async function createNotification(data: SendNotifPayload): Promise<void> {
  await execute(
    'INSERT INTO notifications (user_id, type, title, body, url) VALUES (?, ?, ?, ?, ?)',
    [data.user_id, data.type, data.title, data.body ?? null, data.url ?? null],
  );
}
