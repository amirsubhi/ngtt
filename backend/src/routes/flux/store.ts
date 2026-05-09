import { FastifyPluginAsync } from 'fastify';
import { query } from '../../lib/db';

interface StoreItem {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  type: 'invite_token' | 'freeleech_token' | 'upload_credit' | 'username_change';
  value: number;
  display_order: number;
}

export const fluxStoreRoutes: FastifyPluginAsync = async app => {
  app.get('/api/flux/store', async (_req, reply) => {
    const items = await query<StoreItem>(
      'SELECT id, name, description, cost, type, value, display_order FROM flux_store_items WHERE is_active = TRUE ORDER BY display_order ASC',
    );
    return reply.send({ items });
  });
};
