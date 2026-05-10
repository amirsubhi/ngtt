import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { query, queryOne } from '../../lib/db';

interface TxRow {
  id: number;
  amount: number;
  type: 'earn' | 'spend';
  source: string;
  description: string | null;
  created_at: string;
}

export const fluxBalanceRoutes: FastifyPluginAsync = async app => {
  app.get('/api/users/me/flux', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user!;
    const row = await queryOne<{ flux: number }>(
      'SELECT flux FROM users WHERE id = ? AND is_deleted = FALSE',
      [user.id],
    );
    const transactions = await query<TxRow>(
      'SELECT id, amount, type, source, description, created_at FROM flux_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [user.id],
    );
    return reply.send({ balance: parseFloat(String(row?.flux ?? 0)), transactions });
  });
};
