import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { query, queryOne, execute, executeInsert, executeAffected } from '../lib/db';
import { sendMail } from '../lib/mail';
import { authenticate } from '../middleware/auth';
import { ValidationError, AppError, ForbiddenError } from '../lib/errors';
import { config } from '../lib/config';

const CreateInviteBody = z.object({ email: z.string().email().max(255) });

async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
  return row?.value ?? null;
}

interface InviteRow {
  id: number;
  receiver_email: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  // List my invites
  app.get('/api/invites', { preHandler: authenticate }, async (req, reply) => {
    const invites = await query<InviteRow>(
      'SELECT id, receiver_email, token, used, expires_at, created_at FROM invites WHERE sender_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );
    return reply.send(invites);
  });

  // Send an invite
  app.post('/api/invites', { preHandler: authenticate }, async (req, reply) => {
    if (await getSetting('invite_system_enabled') !== '1') {
      throw new AppError('Invite system is disabled', 403, 'INVITE_DISABLED');
    }

    const parsed = CreateInviteBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { email } = parsed.data;

    const sender = await queryOne<{ username: string; invite_tokens: number }>(
      'SELECT username, invite_tokens FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!sender || sender.invite_tokens <= 0) throw new ForbiddenError('No invite tokens remaining');

    const alreadyRegistered = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [email]);
    if (alreadyRegistered) throw new ValidationError('That email is already registered');

    const existingInvite = await queryOne<{ id: number }>(
      'SELECT id FROM invites WHERE sender_id = ? AND receiver_email = ? AND used = FALSE AND expires_at > NOW()',
      [req.user.id, email],
    );
    if (existingInvite) throw new ValidationError('You already have a pending invite for that email');

    const token = crypto.randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const inviteId = await executeInsert(
      'INSERT INTO invites (sender_id, receiver_email, token, expires_at) VALUES (?, ?, ?, ?)',
      [req.user.id, email, token, expires],
    );
    const affected = await executeAffected(
      'UPDATE users SET invite_tokens = invite_tokens - 1 WHERE id = ? AND invite_tokens > 0',
      [req.user.id],
    );
    if (affected === 0) throw new ForbiddenError('No invite tokens remaining');

    await sendMail(
      email,
      `${sender.username} invited you to NGTT`,
      `<p>You've been invited to join NGTT by ${sender.username}.</p>
       <p>Click <a href="${config.frontendUrl}/register/${token}">here</a> to create your account. This invite expires in 7 days.</p>`,
    );

    return reply.status(201).send({ id: inviteId, token });
  });

  // Validate an invite token (for the register page)
  app.get('/api/auth/validate-invite/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const invite = await queryOne<{ receiver_email: string }>(
      'SELECT receiver_email FROM invites WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token],
    );
    if (!invite) throw new AppError('Invalid or expired invite token', 400, 'INVALID_INVITE');
    return reply.send({ valid: true, email: invite.receiver_email });
  });
}
