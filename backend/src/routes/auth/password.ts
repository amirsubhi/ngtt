import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { queryOne, execute } from '../../lib/db';
import { ValidationError, AppError } from '../../lib/errors';
import { config } from '../../lib/config';
import { jobsQueue } from '../../lib/queues';

const BCRYPT_COST = 12;

const ForgotBody = z.object({ email: z.string().email() });
const ResetBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// 3 forgot-password requests per hour per IP
const forgotRateLimit = { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } };

export async function passwordRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/forgot-password', forgotRateLimit, async (req, reply) => {
    const parsed = ForgotBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { email } = parsed.data;

    const user = await queryOne<{ id: number; username: string }>(
      'SELECT id, username FROM users WHERE email = ? AND is_deleted = FALSE',
      [email],
    );

    // Always return 200 — don't leak whether the email exists
    if (!user) return reply.send({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [token, expires, user.id],
    );

    void jobsQueue.add('send-email', {
      to: email,
      template: 'password-reset',
      locale: 'en',
      vars: { username: user.username, reset_link: `${config.frontendUrl}/reset-password/${token}` },
    });

    return reply.send({ ok: true });
  });

  app.post('/api/auth/reset-password', async (req, reply) => {
    const parsed = ResetBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { token, password } = parsed.data;

    const user = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token],
    );
    if (!user) throw new AppError('Invalid or expired reset link', 400, 'INVALID_TOKEN');

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [passwordHash, user.id],
    );
    // Invalidate all existing sessions
    await execute('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

    return reply.send({ ok: true });
  });
}
