import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { NotFoundError } from '../../lib/errors';

interface PublicProfile {
  id: number;
  username: string;
  group_name: string;
  group_color: string;
  uploaded: number;
  downloaded: number;
  flux: number;
  avatar_url: string | null;
  about_me: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/:username', { preHandler: [authenticate] }, async (req, reply) => {
    const { username } = req.params as { username: string };

    const user = await queryOne<PublicProfile & { profile_private: boolean; show_online_status: boolean }>(
      `SELECT u.id, u.username, ug.name AS group_name, ug.color AS group_color,
              u.uploaded, u.downloaded, u.flux,
              u.avatar_url, u.about_me, u.created_at, u.last_seen_at,
              COALESCE(up.profile_private, FALSE) AS profile_private,
              COALESCE(up.show_online_status, TRUE) AS show_online_status
       FROM users u
       JOIN user_groups ug ON ug.id = u.group_id
       LEFT JOIN user_preferences up ON up.user_id = u.id
       WHERE u.username = ? AND u.is_deleted = FALSE AND u.is_banned = FALSE
       LIMIT 1`,
      [username],
    );
    if (!user) throw new NotFoundError('User not found');

    const isSelf = req.user.id === user.id;
    if (user.profile_private && !isSelf && !req.user.is_staff) {
      return reply.send({
        id: user.id, username: user.username, group_name: user.group_name,
        group_color: user.group_color, avatar_url: user.avatar_url,
        created_at: user.created_at, private: true,
      });
    }

    const ratio = user.downloaded > 0 ? user.uploaded / user.downloaded : null;

    const [uploadCount, thankCount, activeHnr, warnCount, snatchCount] = await Promise.all([
      queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM torrents WHERE uploader_id = ? AND status = ?', [user.id, 'approved']),
      queryOne<{ cnt: number }>('SELECT SUM(thank_count) AS cnt FROM torrents WHERE uploader_id = ?', [user.id]),
      queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM hit_and_runs WHERE user_id = ? AND status = 'active'", [user.id]),
      queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users WHERE id = ? AND warned = TRUE', [user.id]),
      queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM torrent_snatches WHERE user_id = ?', [user.id]),
    ]);

    return reply.send({
      id: user.id,
      username: user.username,
      group_name: user.group_name,
      group_color: user.group_color,
      uploaded: user.uploaded,
      downloaded: user.downloaded,
      ratio,
      flux: isSelf ? user.flux : undefined,
      avatar_url: user.avatar_url,
      about_me: user.about_me,
      created_at: user.created_at,
      last_seen_at: user.show_online_status ? user.last_seen_at : null,
      upload_count: uploadCount?.cnt ?? 0,
      thank_count_received: thankCount?.cnt ?? 0,
      active_hnr_count: activeHnr?.cnt ?? 0,
      warned: (warnCount?.cnt ?? 0) > 0,
      snatch_count: snatchCount?.cnt ?? 0,
    });
  });

  // User stats: uploads, snatches, bookmarks
  app.get('/api/users/:username/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const { username } = req.params as { username: string };

    const user = await queryOne<{ id: number; profile_private: boolean; hide_download_history: boolean }>(
      `SELECT u.id, COALESCE(up.profile_private, FALSE) AS profile_private,
              COALESCE(up.hide_download_history, FALSE) AS hide_download_history
       FROM users u LEFT JOIN user_preferences up ON up.user_id = u.id
       WHERE u.username = ? AND u.is_deleted = FALSE LIMIT 1`,
      [username],
    );
    if (!user) throw new NotFoundError('User not found');

    const isSelf = req.user.id === user.id;
    if (user.profile_private && !isSelf && !req.user.is_staff) {
      throw new NotFoundError('User not found');
    }

    const uploads = await query<{ id: number; name: string; created_at: string; status: string; download_count: number }>(
      "SELECT id, name, created_at, status, download_count FROM torrents WHERE uploader_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 50",
      [user.id],
    );

    const showSnatches = isSelf || (!user.hide_download_history && !user.profile_private);
    const snatches = showSnatches
      ? await query<{ torrent_id: number; name: string; completed_at: string }>(
          'SELECT ts.torrent_id, t.name, ts.completed_at FROM torrent_snatches ts JOIN torrents t ON t.id = ts.torrent_id WHERE ts.user_id = ? ORDER BY ts.completed_at DESC LIMIT 50',
          [user.id],
        )
      : [];

    const bookmarks = isSelf
      ? await query<{ torrent_id: number; name: string; created_at: string }>(
          'SELECT tb.torrent_id, t.name, tb.created_at FROM torrent_bookmarks tb JOIN torrents t ON t.id = tb.torrent_id WHERE tb.user_id = ? ORDER BY tb.created_at DESC LIMIT 50',
          [user.id],
        )
      : [];

    return reply.send({ uploads, snatches, bookmarks });
  });
}
