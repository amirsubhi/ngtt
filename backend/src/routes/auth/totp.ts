import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateSecret, generateURI, verify as verifyOTP } from 'otplib';
import qrcode from 'qrcode';
import { queryOne, execute } from '../../lib/db';
import { get as redisGet, setEx as redisSetEx, del as redisDel } from '../../lib/redis';
import { authenticate } from '../../middleware/auth';
import { ValidationError, AppError } from '../../lib/errors';

const SETUP_TTL = 300; // 5 minutes
const BACKUP_CODE_COUNT = 8;

const SetupBody = z.object({ password: z.string().min(1) });
const VerifyBody = z.object({ code: z.string().length(6) });
const DisableBody = z.object({ code: z.string().min(1) });

function setupKey(userId: number): string {
  return `2fa_setup:${userId}`;
}

function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    plain.push(code);
    hashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }
  return { plain, hashes };
}

export async function totpRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/2fa/setup', { preHandler: authenticate }, async (req, reply) => {
    const parsed = SetupBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = await queryOne<{ password_hash: string; two_factor_enabled: boolean }>(
      'SELECT password_hash, two_factor_enabled FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (user.two_factor_enabled) throw new AppError('2FA is already enabled', 409, 'ALREADY_ENABLED');

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordOk) throw new ValidationError('Incorrect password');

    const secret = generateSecret();
    await redisSetEx(setupKey(req.user.id), SETUP_TTL, secret);

    const otpAuthUrl = generateURI({ secret, label: req.user.username, issuer: 'NGTT' });
    const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

    return reply.send({ secret, qr_code_url: qrDataUrl });
  });

  app.post('/api/auth/2fa/verify', { preHandler: authenticate }, async (req, reply) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const secret = await redisGet(setupKey(req.user.id));
    if (!secret) throw new AppError('2FA setup session expired — start setup again', 400, 'SETUP_EXPIRED');

    const result = await verifyOTP({ secret, token: parsed.data.code });
    if (!result.valid) throw new ValidationError('Invalid 2FA code');

    await execute(
      'UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = ? WHERE id = ?',
      [secret, req.user.id],
    );
    await redisDel(setupKey(req.user.id));

    const { plain, hashes } = generateBackupCodes();
    for (const hash of hashes) {
      await execute('INSERT INTO user_backup_codes (user_id, code_hash) VALUES (?, ?)', [req.user.id, hash]);
    }

    return reply.send({ backup_codes: plain });
  });

  app.post('/api/auth/2fa/disable', { preHandler: authenticate }, async (req, reply) => {
    const parsed = DisableBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = await queryOne<{ two_factor_enabled: boolean; two_factor_secret: string | null }>(
      'SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!user?.two_factor_enabled) throw new AppError('2FA is not enabled', 400, 'NOT_ENABLED');

    let valid = false;
    if (user.two_factor_secret) {
      const result = await verifyOTP({ secret: user.two_factor_secret, token: parsed.data.code });
      valid = result.valid;
    }
    if (!valid) {
      const codeHash = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
      const backup = await queryOne<{ id: number }>(
        'SELECT id FROM user_backup_codes WHERE user_id = ? AND code_hash = ? AND used = FALSE',
        [req.user.id, codeHash],
      );
      valid = backup !== null;
    }

    if (!valid) throw new ValidationError('Invalid 2FA code');

    await execute(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?',
      [req.user.id],
    );
    await execute('DELETE FROM user_backup_codes WHERE user_id = ?', [req.user.id]);

    return reply.send({ ok: true });
  });
}
