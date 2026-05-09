import { FastifyInstance } from 'fastify';
import { query } from '../lib/db';

const PUBLIC_KEYS = [
  'captcha_on_register',
  'captcha_on_login',
  'captcha_on_login_after_fails',
  'turnstile_site_key',
  'registration_open',
  'invite_system_enabled',
  'two_factor_available',
] as const;

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings/categories', async (_req, reply) => {
    const categories = await query<{ id: number; name: string; slug: string; icon: string | null }>(
      'SELECT id, name, slug, icon FROM categories WHERE is_active = TRUE ORDER BY display_order',
    );
    return reply.send(categories);
  });

  app.get('/api/settings/public', async (_req, reply) => {
    const rows = await query<{ key: string; value: string }>(
      `SELECT \`key\`, value FROM site_settings WHERE \`key\` IN (${PUBLIC_KEYS.map(() => '?').join(',')})`,
      [...PUBLIC_KEYS],
    );
    const out: Record<string, string> = {};
    for (const row of rows) out[row.key] = row.value;
    return reply.send(out);
  });
}
