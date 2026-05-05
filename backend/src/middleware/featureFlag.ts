import { FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../lib/db';
import { ForbiddenError } from '../lib/errors';

const cache = new Map<string, { value: boolean; expiresAt: number }>();
const TTL_MS = 60_000;

async function isEnabled(flag: string): Promise<boolean> {
  const cached = cache.get(flag);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const row = await queryOne<{ value: string }>(
    'SELECT value FROM site_settings WHERE `key` = ?',
    [flag],
  );
  const value = row?.value === 'true';
  cache.set(flag, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function requireFeature(flag: string) {
  return async (_req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const enabled = await isEnabled(flag);
    if (!enabled) throw new ForbiddenError(`Feature '${flag}' is disabled`);
  };
}
