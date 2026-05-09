import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { ValidationError } from '../../lib/errors';

const VALID_THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand'] as const;
const VALID_LOCALES = ['en', 'zh-CN', 'es', 'pt-BR', 'ar', 'ms-MY'] as const;

const SettingsSchema = z.object({
  theme: z.enum(VALID_THEMES).optional(),
  locale: z.enum(VALID_LOCALES).optional(),
  about_me: z.string().max(2000).optional(),
  browse_view: z.enum(['table', 'card']).optional(),
  torrents_per_page: z.number().int().min(10).max(100).optional(),
  profile_private: z.boolean().optional(),
  show_online_status: z.boolean().optional(),
  hide_download_history: z.boolean().optional(),
  notify_hnr_warning: z.boolean().optional(),
  notify_ratio_low: z.boolean().optional(),
  notify_request_filled: z.boolean().optional(),
  notify_forum_reply: z.boolean().optional(),
  notify_pm_received: z.boolean().optional(),
  notify_promotion: z.boolean().optional(),
  notify_new_torrent: z.boolean().optional(),
  email_hnr_warning: z.boolean().optional(),
  email_pm_received: z.boolean().optional(),
  email_staff_message: z.boolean().optional(),
  forum_signature: z.string().max(500).optional(),
  os_preferred_langs: z.array(z.string()).optional(),
  os_auto_sync: z.boolean().optional(),
});

type SettingsData = z.infer<typeof SettingsSchema>;

function buildUpdate(fields: Record<string, unknown>): { sql: string; params: unknown[] } | null {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;
  return {
    sql: entries.map(([k]) => `${k} = ?`).join(', '),
    params: entries.map(([, v]) => (Array.isArray(v) ? JSON.stringify(v) : v)),
  };
}

export async function userSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/me/settings', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.user.id;
    const [user, prefs] = await Promise.all([
      queryOne<{ theme: string; locale: string; about_me: string | null; avatar_url: string | null; passkey: string; api_key: string | null; api_enabled: boolean }>(
        'SELECT theme, locale, about_me, avatar_url, passkey, api_key, api_enabled FROM users WHERE id = ? LIMIT 1',
        [userId],
      ),
      queryOne<Record<string, unknown>>(
        'SELECT browse_view, torrents_per_page, profile_private, show_online_status, hide_download_history, notify_hnr_warning, notify_ratio_low, notify_request_filled, notify_forum_reply, notify_pm_received, notify_promotion, notify_new_torrent, email_hnr_warning, email_pm_received, email_staff_message, forum_signature, os_enabled, os_auto_sync, os_preferred_langs, os_username, os_verified FROM user_preferences WHERE user_id = ? LIMIT 1',
        [userId],
      ),
    ]);
    return reply.send({ ...user, ...prefs });
  });

  app.put('/api/users/me/settings', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid settings');
    const data = parsed.data;
    const userId = req.user.id;

    const userFields = buildUpdate({
      theme: data.theme,
      locale: data.locale,
      about_me: data.about_me,
    });
    if (userFields) {
      await execute(`UPDATE users SET ${userFields.sql} WHERE id = ?`, [...userFields.params, userId]);
    }

    const prefFields = buildUpdate({
      browse_view: data.browse_view,
      torrents_per_page: data.torrents_per_page,
      profile_private: data.profile_private,
      show_online_status: data.show_online_status,
      hide_download_history: data.hide_download_history,
      notify_hnr_warning: data.notify_hnr_warning,
      notify_ratio_low: data.notify_ratio_low,
      notify_request_filled: data.notify_request_filled,
      notify_forum_reply: data.notify_forum_reply,
      notify_pm_received: data.notify_pm_received,
      notify_promotion: data.notify_promotion,
      notify_new_torrent: data.notify_new_torrent,
      email_hnr_warning: data.email_hnr_warning,
      email_pm_received: data.email_pm_received,
      email_staff_message: data.email_staff_message,
      forum_signature: data.forum_signature,
      os_preferred_langs: data.os_preferred_langs,
      os_auto_sync: data.os_auto_sync,
    });
    if (prefFields) {
      // Ensure row exists, then update
      await execute('INSERT IGNORE INTO user_preferences (user_id) VALUES (?)', [userId]);
      await execute(`UPDATE user_preferences SET ${prefFields.sql} WHERE user_id = ?`, [...prefFields.params, userId]);
    }

    return reply.send({ ok: true });
  });
}
