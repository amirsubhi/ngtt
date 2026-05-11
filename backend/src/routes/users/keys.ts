import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { NotFoundError } from '../../lib/errors';

const randHex = (bytes: number) => crypto.randomBytes(bytes).toString('hex');

export async function userKeysRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/me/keys', { preHandler: [authenticate] }, async (req, reply) => {
    const row = await queryOne<{ passkey: string; api_key: string | null; api_enabled: boolean; rss_key: string }>(
      'SELECT passkey, api_key, api_enabled, rss_key FROM users WHERE id = ? LIMIT 1',
      [req.user.id],
    );
    if (!row) throw new NotFoundError('User not found');
    return reply.send(row);
  });

  app.post('/api/users/me/keys/passkey', { preHandler: [authenticate] }, async (req, reply) => {
    const passkey = randHex(16);
    await execute('UPDATE users SET passkey = ? WHERE id = ?', [passkey, req.user.id]);
    return reply.send({ passkey });
  });

  app.post('/api/users/me/keys/api', { preHandler: [authenticate] }, async (req, reply) => {
    const api_key = randHex(32);
    await execute('UPDATE users SET api_key = ?, api_enabled = TRUE WHERE id = ?', [api_key, req.user.id]);
    return reply.send({ api_key, api_enabled: true });
  });

  app.post('/api/users/me/keys/api/toggle', { preHandler: [authenticate] }, async (req, reply) => {
    const user = await queryOne<{ api_enabled: boolean }>(
      'SELECT api_enabled FROM users WHERE id = ? LIMIT 1',
      [req.user.id],
    );
    if (!user) throw new NotFoundError('User not found');
    const api_enabled = !user.api_enabled;
    await execute('UPDATE users SET api_enabled = ? WHERE id = ?', [api_enabled, req.user.id]);
    return reply.send({ api_enabled });
  });

  app.post('/api/users/me/keys/rss', { preHandler: [authenticate] }, async (req, reply) => {
    const rss_key = randHex(16);
    await execute('UPDATE users SET rss_key = ? WHERE id = ?', [rss_key, req.user.id]);
    return reply.send({ rss_key });
  });
}
