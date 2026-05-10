import { FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../lib/db';
import { redis } from '../lib/redis';
import { ForbiddenError } from '../lib/errors';

const TTL_SECONDS = 60;

async function isEnabled(flag: string): Promise<boolean> {
  const cacheKey = `feature_flag:${flag}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === 'true';

  const row = await queryOne<{ value: string }>(
    'SELECT value FROM site_settings WHERE `key` = ?',
    [flag],
  );
  const value = row?.value === 'true';
  await redis.setex(cacheKey, TTL_SECONDS, value ? 'true' : 'false');
  return value;
}

export function requireFeature(flag: string) {
  return async (_req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const enabled = await isEnabled(flag);
    if (!enabled) throw new ForbiddenError(`Feature '${flag}' is disabled`);
  };
}
