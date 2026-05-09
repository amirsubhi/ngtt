import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { queryOne, execute } from '../../lib/db';
import { UnauthorizedError } from '../../lib/errors';
import { config } from '../../lib/config';

const REFRESH_DAYS = 7;

interface RefreshTokenRow {
  id: number;
  user_id: number;
  expires_at: string;
}

interface UserRow {
  id: number;
  username: string;
  group_id: number;
  is_banned: boolean;
  is_deleted: boolean;
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/refresh', async (req, reply) => {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) throw new UnauthorizedError('No refresh token');

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const stored = await queryOne<RefreshTokenRow>(
      'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash],
    );
    if (!stored) throw new UnauthorizedError('Invalid refresh token');
    if (new Date(stored.expires_at) < new Date()) {
      await execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await queryOne<UserRow>(
      'SELECT id, username, group_id, is_banned, is_deleted FROM users WHERE id = ?',
      [stored.user_id],
    );
    if (!user || user.is_deleted || user.is_banned) throw new UnauthorizedError();

    // Token rotation
    await execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    const newRaw = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
    const newExpires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, newHash, newExpires],
    );

    reply.setCookie('refresh_token', newRaw, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      path: '/',
      expires: newExpires,
    });

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessExpires as any },
    );
    return reply.send({ token: accessToken });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const rawToken = req.cookies?.refresh_token;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    }
    reply.clearCookie('refresh_token', { path: '/' });
    return reply.send({ ok: true });
  });
}
