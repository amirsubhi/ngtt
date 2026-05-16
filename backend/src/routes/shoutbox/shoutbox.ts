import { Namespace } from 'socket.io';
import { redis } from '../../lib/redis';
import { execute, queryOne } from '../../lib/db';
import { logger } from '../../lib/logger';
import { verifySocketToken } from '../../lib/socket';
import { jobsQueue } from '../../lib/queues';
import { filterBadWords } from '../../lib/badwords';

const SHOUTBOX_KEY = 'shoutbox';
const MAX_MSGS = 200;
const MAX_CONTENT = 500;

function bbToHtml(raw: string): string {
  return raw
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[b\](.*?)\[\/b\]/gis, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/gis, '<em>$1</em>')
    .replace(/\[url=(https?:\/\/[^"'\]\s]{1,500})\](.*?)\[\/url\]/gis,
      (_, url, text) => `<a href="${url}" rel="noopener noreferrer" target="_blank">${text}</a>`);
}

export function setupShoutbox(ns: Namespace): void {
  ns.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      const payload = verifySocketToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  ns.on('connection', async socket => {
    const { userId, username } = socket.data as { userId: number; username: string };

    // Join user room for targeted emits (PM alerts, notif counts)
    void socket.join(`user:${userId}`);

    // Send last 200 messages from Redis
    try {
      const raw = await redis.lrange(SHOUTBOX_KEY, 0, MAX_MSGS - 1);
      const history = raw.map(r => JSON.parse(r)).reverse();
      socket.emit('history', history);
    } catch { /* non-fatal */ }

    socket.on('message', async (content: unknown) => {
      if (typeof content !== 'string') return;
      const trimmed = await filterBadWords(content.trim().slice(0, MAX_CONTENT));
      if (!trimmed) return;

      try {
        // Check shoutbox ban (active user_warning of type shoutbox_ban)
        const ban = await queryOne<{ id: number }>(
          `SELECT id FROM user_warnings
           WHERE user_id = ? AND type = 'shoutbox_ban' AND is_active = TRUE
             AND (expires_at IS NULL OR expires_at > NOW())
           LIMIT 1`,
          [userId],
        );
        if (ban) { socket.emit('error', 'You are banned from the shoutbox'); return; }

        const user = await queryOne<{ is_banned: boolean; group_color: string }>(
          `SELECT u.is_banned, ug.color AS group_color
           FROM users u JOIN user_groups ug ON ug.id = u.group_id
           WHERE u.id = ? AND u.is_deleted = FALSE`,
          [userId],
        );
        if (!user || user.is_banned) { socket.emit('error', 'Account is banned'); return; }

        const msg = {
          id: Date.now(),
          user_id: userId,
          username,
          group_color: user.group_color,
          content: bbToHtml(trimmed),
          created_at: new Date().toISOString(),
          is_system: false,
        };

        await redis.lpush(SHOUTBOX_KEY, JSON.stringify(msg));
        await redis.ltrim(SHOUTBOX_KEY, 0, MAX_MSGS - 1);

        ns.emit('message', msg);

        void jobsQueue.add('shoutbox-archive', {
          user_id: userId,
          username,
          group_color: user.group_color,
          content: trimmed,
          is_system: false,
        });
      } catch (err) {
        logger.error(err, 'shoutbox message error');
      }
    });
  });
}

export async function emitSystemShoutbox(content: string): Promise<void> {
  const msg = {
    id: Date.now(),
    user_id: null,
    username: 'System',
    group_color: '#6366f1',
    content,
    created_at: new Date().toISOString(),
    is_system: true,
  };
  try {
    const { getIo } = await import('../../lib/socket');
    const ns = getIo().of('/ws');
    await redis.lpush(SHOUTBOX_KEY, JSON.stringify(msg));
    await redis.ltrim(SHOUTBOX_KEY, 0, MAX_MSGS - 1);
    ns.emit('message', msg);
    void jobsQueue.add('shoutbox-archive', {
      user_id: null,
      username: 'System',
      group_color: '#6366f1',
      content,
      is_system: true,
    });
  } catch { /* server may not have socket.io in worker context */ }
}
