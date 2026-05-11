import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryOne, withTransaction } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { ResultSetHeader } from 'mysql2';

const GiftBody = z.object({
  username: z.string().min(1).max(50),
  amount:   z.number().int().positive().max(1_000_000),
  note:     z.string().max(200).optional(),
});

export const fluxGiftRoutes: FastifyPluginAsync = async app => {
  app.post('/api/flux/gift', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = GiftBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const { username, amount, note } = parsed.data;
    const senderId = req.user.id;

    const recipient = await queryOne<{ id: number; username: string }>(
      'SELECT id, username FROM users WHERE username = ? AND is_deleted = FALSE AND is_banned = FALSE LIMIT 1',
      [username],
    );
    if (!recipient) throw new NotFoundError('User not found');
    if (recipient.id === senderId) throw new AppError('Cannot gift to yourself', 400, 'SELF_GIFT');

    const newBalance = await withTransaction(async conn => {
      const [deduct] = await conn.execute<ResultSetHeader>(
        'UPDATE users SET flux = flux - ? WHERE id = ? AND flux >= ?',
        [amount, senderId, amount],
      );
      if ((deduct as ResultSetHeader).affectedRows === 0) {
        throw new AppError('Insufficient FLX balance', 402, 'INSUFFICIENT_FLUX');
      }

      await conn.execute(
        'UPDATE users SET flux = flux + ? WHERE id = ?',
        [amount, recipient.id],
      );

      const desc = note ?? `Gift from ${req.user.username}`;
      await conn.execute(
        "INSERT INTO flux_transactions (user_id, amount, type, source, description) VALUES (?, ?, 'spend', 'gift', ?)",
        [senderId, amount, desc],
      );
      await conn.execute(
        "INSERT INTO flux_transactions (user_id, amount, type, source, description) VALUES (?, ?, 'earn', 'gift', ?)",
        [recipient.id, amount, desc],
      );

      const [[row]] = await conn.execute<any[]>('SELECT flux FROM users WHERE id = ?', [senderId]);
      return (row as { flux: number }).flux;
    });

    return reply.send({ balance: newBalance, sent_to: recipient.username, amount });
  });
};
