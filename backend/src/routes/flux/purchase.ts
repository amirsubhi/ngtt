import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { withTransaction, queryOne } from '../../lib/db';
import { AppError } from '../../lib/errors';
import { ResultSetHeader } from 'mysql2';

const ITEM_TYPES = ['invite_token', 'freeleech_token', 'upload_credit', 'username_change'] as const;
type ItemType = (typeof ITEM_TYPES)[number];

interface StoreItem {
  id: number;
  cost: number;
  type: ItemType;
  value: number;
  is_active: boolean;
}

export const fluxPurchaseRoutes: FastifyPluginAsync = async app => {
  app.post<{ Params: { itemId: string } }>(
    '/api/flux/purchase/:itemId',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const itemId = parseInt((req.params as { itemId: string }).itemId, 10);
      if (isNaN(itemId)) throw new AppError('Invalid item ID', 400, 'INVALID_ITEM');

      const item = await queryOne<StoreItem>(
        'SELECT id, cost, type, value, is_active FROM flux_store_items WHERE id = ?',
        [itemId],
      );
      if (!item || !item.is_active) throw new AppError('Item not found', 404, 'NOT_FOUND');

      const userId = req.user!.id;

      const newBalance = await withTransaction(async conn => {
        // Atomic deduct — aborts if insufficient flux
        const [deductResult] = await conn.execute<ResultSetHeader>(
          'UPDATE users SET flux = flux - ? WHERE id = ? AND flux >= ? AND is_deleted = FALSE',
          [item.cost, userId, item.cost],
        );
        if (deductResult.affectedRows === 0) {
          throw new AppError('Not enough FLX', 402, 'INSUFFICIENT_FLUX');
        }

        await conn.execute(
          "INSERT INTO flux_transactions (user_id, amount, type, source, description) VALUES (?, ?, 'spend', 'store', ?)",
          [userId, item.cost, item.type.replace(/_/g, ' ')],
        );

        // Apply item effect
        switch (item.type) {
          case 'invite_token':
            await conn.execute('UPDATE users SET invite_tokens = invite_tokens + 1 WHERE id = ?', [userId]);
            break;
          case 'freeleech_token':
            await conn.execute(
              "INSERT INTO personal_freeleech (user_id, torrent_id, expires_at) VALUES (?, NULL, DATE_ADD(NOW(), INTERVAL 24 HOUR))",
              [userId],
            );
            break;
          case 'upload_credit':
            await conn.execute('UPDATE users SET uploaded = uploaded + ? WHERE id = ?', [item.value, userId]);
            break;
          case 'username_change':
            await conn.execute('UPDATE users SET username_change_credits = username_change_credits + 1 WHERE id = ?', [userId]);
            break;
        }

        const [[balRow]] = await conn.execute<any[]>(
          'SELECT flux FROM users WHERE id = ?',
          [userId],
        );
        return (balRow as { flux: number }).flux;
      });

      return reply.send({ balance: newBalance });
    },
  );
};
