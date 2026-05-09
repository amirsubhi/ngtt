import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { queryOne, withTransaction } from '../../lib/db';
import { sendMail } from '../../lib/mail';
import { verifyTurnstile } from '../../lib/turnstile';
import { ValidationError, AppError } from '../../lib/errors';
import { config } from '../../lib/config';
import { authRateLimit } from '../../middleware/rateLimiter';

const BCRYPT_COST = 12;
const MIN_FORM_MS = 3000;

const RegisterBody = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  invite_token: z.string().optional(),
  turnstile_response: z.string().optional(),
  _hp: z.string().optional(),
  form_loaded_at: z.number().optional(),
});

async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
  return row?.value ?? null;
}

export async function registerRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', { config: authRateLimit.config }, async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { username, email, password, invite_token, turnstile_response, _hp, form_loaded_at } = parsed.data;

    if (_hp) return reply.status(200).send({ ok: true });
    if (form_loaded_at !== undefined && Date.now() - form_loaded_at < MIN_FORM_MS) {
      return reply.status(200).send({ ok: true });
    }

    if (await getSetting('registration_open') !== '1') {
      throw new AppError('Registration is closed', 403, 'REGISTRATION_CLOSED');
    }

    let inviteRow: { id: number; sender_id: number } | null = null;
    if (await getSetting('invite_system_enabled') === '1') {
      if (!invite_token) throw new ValidationError('An invite token is required');
      inviteRow = await queryOne<{ id: number; sender_id: number }>(
        'SELECT id, sender_id FROM invites WHERE token = ? AND used = FALSE AND expires_at > NOW()',
        [invite_token],
      );
      if (!inviteRow) throw new ValidationError('Invalid or expired invite token');
    }

    if (await getSetting('captcha_on_register') === '1') {
      if (!turnstile_response) throw new ValidationError('Captcha response is required');
      if (!await verifyTurnstile(turnstile_response, req.ip ?? '')) {
        throw new ValidationError('Captcha verification failed');
      }
    }

    const blacklist = await getSetting('email_domain_blacklist');
    if (blacklist) {
      const domain = email.split('@')[1]?.toLowerCase();
      const banned = blacklist.split(',').map(d => d.trim().toLowerCase());
      if (domain && banned.includes(domain)) throw new ValidationError('Email domain is not allowed');
    }

    const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) throw new ValidationError('Username or email already taken');

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const passkey = crypto.randomBytes(16).toString('hex');
    const rssKey = crypto.randomBytes(16).toString('hex');
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const userId = await withTransaction(async (conn: mysql.PoolConnection) => {
      const [result] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO users
           (username, email, password_hash, passkey, rss_key,
            email_verify_token, email_verify_expires, group_id, invited_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [username, email, passwordHash, passkey, rssKey, verifyToken, verifyExpires, inviteRow?.sender_id ?? null],
      );
      const uid = result.insertId;
      await conn.execute('INSERT INTO user_preferences (user_id) VALUES (?)', [uid]);
      if (inviteRow) {
        await conn.execute('UPDATE invites SET used = TRUE, used_by = ? WHERE id = ?', [uid, inviteRow.id]);
      }
      return uid;
    });

    // TODO(batch-3): queue welcome-pm via jobsQueue
    await sendMail(
      email,
      'Verify your NGTT account',
      `<p>Click <a href="${config.frontendUrl}/verify-email/${verifyToken}">here</a> to verify your email. Link expires in 24 hours.</p>`,
    );

    return reply.status(201).send({ id: userId });
  });

  app.get('/api/auth/verify-email/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const user = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE email_verify_token = ? AND email_verify_expires > NOW() AND email_verified = FALSE',
      [token],
    );
    if (!user) throw new AppError('Invalid or expired verification link', 400, 'INVALID_TOKEN');
    await queryOne(
      'UPDATE users SET email_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL WHERE id = ?',
      [user.id],
    );
    return reply.send({ ok: true });
  });
}
