import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { encrypt, decrypt } from '../../lib/encrypt';
import { ValidationError } from '../../lib/errors';

const OS_API_BASE = 'https://api.opensubtitles.com/api/v1';

const VerifySchema = z.object({
  api_key: z.string().min(10).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1),
});

export async function opensubtitlesRoutes(app: FastifyInstance): Promise<void> {
  // Verify and save OS credentials
  app.post('/api/users/me/integrations/opensubtitles/verify', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { api_key, username, password } = parsed.data;

    // Verify against OS API
    const loginRes = await fetch(`${OS_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': api_key, 'User-Agent': 'NGTT/1.0' },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) throw new ValidationError('Invalid OpenSubtitles credentials');

    const keyEnc = encrypt(api_key);
    await execute(
      'INSERT INTO user_preferences (user_id, os_api_key_enc, os_username, os_enabled, os_verified) VALUES (?, ?, ?, TRUE, TRUE) ON DUPLICATE KEY UPDATE os_api_key_enc = ?, os_username = ?, os_enabled = TRUE, os_verified = TRUE',
      [req.user.id, keyEnc, username, keyEnc, username],
    );

    return reply.send({ verified: true, username });
  });

  // Get remaining OS quota
  app.get('/api/users/me/integrations/opensubtitles/quota', { preHandler: [authenticate] }, async (req, reply) => {
    const prefs = await queryOne<{ os_api_key_enc: string | null; os_enabled: boolean }>(
      'SELECT os_api_key_enc, os_enabled FROM user_preferences WHERE user_id = ? LIMIT 1',
      [req.user.id],
    );
    if (!prefs?.os_enabled || !prefs.os_api_key_enc) {
      return reply.status(404).send({ error: 'NOT_CONNECTED', message: 'OpenSubtitles not connected' });
    }

    const apiKey = decrypt(prefs.os_api_key_enc);
    const res = await fetch(`${OS_API_BASE}/infos/user`, {
      headers: { 'Api-Key': apiKey, 'User-Agent': 'NGTT/1.0' },
    });
    if (!res.ok) return reply.status(502).send({ error: 'OS_ERROR', message: 'Could not reach OpenSubtitles' });

    const data = await res.json() as { data?: { remaining_downloads?: number } };
    return reply.send({ remaining_downloads: data.data?.remaining_downloads ?? null });
  });

  // Disconnect OS
  app.delete('/api/users/me/integrations/opensubtitles', { preHandler: [authenticate] }, async (req, reply) => {
    await execute(
      'UPDATE user_preferences SET os_api_key_enc = NULL, os_username = NULL, os_enabled = FALSE, os_verified = FALSE WHERE user_id = ?',
      [req.user.id],
    );
    return reply.send({ ok: true });
  });
}
