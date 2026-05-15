import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { redis } from '../lib/redis';

const PUBLIC_KEYS = [
  'site_name', 'site_description', 'site_logo_url', 'site_favicon_url',
  'login_message', 'announcement_enabled', 'announcement_text', 'announcement_level',
  'footer_text', 'registration_open', 'default_theme', 'default_locale',
];

export const publicRoutes: FastifyPluginAsync = async app => {
  app.get('/api/public/settings', async (_req, reply) => {
    const cacheKey = 'public:settings';
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached) as object);

    const rows = await query<{ key: string; value: string }>(
      'SELECT `key`, value FROM site_settings WHERE `key` IN (?)',
      [PUBLIC_KEYS],
    );
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    const result = { settings };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    return reply.send(result);
  });
};
