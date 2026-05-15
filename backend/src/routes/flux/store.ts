import { FastifyPluginAsync } from 'fastify';
import { query } from '../../lib/db';
import { redis } from '../../lib/redis';

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
    const cacheKey = 'flux:store';
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached) as object);

    const items = await query<StoreItem>(
      'SELECT id, name, description, cost, type, value, display_order FROM flux_store_items WHERE is_active = TRUE ORDER BY display_order ASC',
    );
    const result = { items };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return reply.send(result);
  });
};
