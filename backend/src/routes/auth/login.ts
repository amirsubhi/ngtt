import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { verify as verifyOTP } from 'otplib';
import { queryOne, execute } from '../../lib/db';
import { redis } from '../../lib/redis';
import { verifyTurnstile } from '../../lib/turnstile';
import { ValidationError, UnauthorizedError, ForbiddenError, AppError } from '../../lib/errors';
import { config } from '../../lib/config';
import { authRateLimit } from '../../middleware/rateLimiter';
import { decrypt } from '../../lib/encrypt';

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const REFRESH_DAYS = 7;

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstile_response: z.string().optional(),
  totp_code: z.string().optional(),
});

interface UserRow {
  id: number;
  username: string;
  group_id: number;
  password_hash: string;
  email_verified: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  failed_login_count: number;
  locked_until: string | null;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
}

async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
  return row?.value ?? null;
}

// Constant-time dummy compare to prevent timing attacks on non-existent users
const DUMMY_HASH = '$2b$12$invalidhashtopreventtimingattackpadding000000000000000';

export async function loginRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', { config: authRateLimit.config }, async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { email, password, turnstile_response, totp_code } = parsed.data;
    const ip = req.ip ?? '0.0.0.0';

    const ipBan = await queryOne<{ id: number }>(
      'SELECT id FROM ip_bans WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > NOW())',
      [ip],
    );
    if (ipBan) throw new ForbiddenError('Your IP address is banned');

    const captchaRow = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM login_attempts WHERE ip_address = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
      [ip],
    );
    const recentAttempts = Number(captchaRow?.cnt ?? 0);
    const captchaThreshold = parseInt(await getSetting('captcha_on_login_after_fails') ?? '3', 10);
    if (recentAttempts >= captchaThreshold && await getSetting('captcha_on_login') === '1') {
      if (!turnstile_response) throw new ValidationError('Captcha required');
      if (!await verifyTurnstile(turnstile_response, ip)) throw new ValidationError('Captcha verification failed');
    }

    const user = await queryOne<UserRow>(
      `SELECT id, username, group_id, password_hash, email_verified, is_banned, ban_reason,
              failed_login_count, locked_until, two_factor_enabled, two_factor_secret
       FROM users WHERE email = ? AND is_deleted = FALSE`,
      [email],
    );

    if (!user) {
      await execute('INSERT INTO login_attempts (ip_address, username_tried) VALUES (?, ?)', [ip, null]);
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.is_banned) throw new ForbiddenError(user.ban_reason ?? 'Account is banned');
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is temporarily locked — try again later', 423, 'ACCOUNT_LOCKED');
    }
    if (!user.email_verified) throw new ForbiddenError('Please verify your email before logging in');

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      await execute('INSERT INTO login_attempts (ip_address, username_tried) VALUES (?, ?)', [ip, email]);
      const newCount = user.failed_login_count + 1;
      if (newCount >= MAX_FAILED) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
        await execute('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?', [newCount, lockedUntil, user.id]);
      } else {
        await execute('UPDATE users SET failed_login_count = ? WHERE id = ?', [newCount, user.id]);
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.two_factor_enabled) {
      if (!totp_code) return reply.status(200).send({ requires_2fa: true });

      const totpKey = `totp_attempts:${user.id}`;
      const attempts = parseInt(await redis.get(totpKey) ?? '0', 10);
      if (attempts >= 5) {
        throw new AppError('Too many 2FA attempts — try again in 15 minutes', 429, 'TOTP_LOCKED');
      }

      let plainSecret = '';
      if (user.two_factor_secret) {
        try { plainSecret = decrypt(user.two_factor_secret); } catch { plainSecret = user.two_factor_secret; }
      }
      const validTotp = plainSecret
        ? (await verifyOTP({ secret: plainSecret, token: totp_code })).valid
        : false;
      let validBackup = false;
      if (!validTotp) {
        const codeHash = crypto.createHash('sha256').update(totp_code).digest('hex');
        const backup = await queryOne<{ id: number }>(
          'SELECT id FROM user_backup_codes WHERE user_id = ? AND code_hash = ? AND used = FALSE',
          [user.id, codeHash],
        );
        if (backup) {
          validBackup = true;
          await execute('UPDATE user_backup_codes SET used = TRUE WHERE id = ?', [backup.id]);
        }
      }
      if (!validTotp && !validBackup) {
        const n = await redis.incr(totpKey);
        if (n === 1) await redis.expire(totpKey, 15 * 60);
        throw new UnauthorizedError('Invalid 2FA code');
      }
      await redis.del(totpKey);
    }

    await execute('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_seen_at = NOW() WHERE id = ?', [user.id]);

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessExpires as any },
    );
    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    const refreshExpires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshHash, refreshExpires],
    );

    reply.setCookie('refresh_token', rawRefresh, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.cookieSecure,
      path: '/',
      expires: refreshExpires,
    });

    reply.header('X-Powered-By', 'ngtt');
    return reply.send({
      token: accessToken,
      user: { id: user.id, username: user.username, group_id: user.group_id },
    });
  });
}
