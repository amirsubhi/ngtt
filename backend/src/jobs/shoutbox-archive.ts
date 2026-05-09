import { execute } from '../lib/db';
import { logger } from '../lib/logger';

interface ShoutboxArchivePayload {
  user_id: number | null;
  username: string;
  group_color: string;
  content: string;
  is_system: boolean;
}

export async function archiveShoutboxMsg(data: ShoutboxArchivePayload): Promise<void> {
  const { user_id, username, group_color, content, is_system } = data;
  await execute(
    'INSERT INTO shoutbox_archive (user_id, username, group_color, content, is_system) VALUES (?, ?, ?, ?, ?)',
    [user_id, username, group_color, content.slice(0, 1000), is_system],
  );
  logger.debug({ username }, 'shoutbox archived');
}
