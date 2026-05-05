import rateLimit from '@fastify/rate-limit';
import { redis } from '../lib/redis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function registerRateLimiter(app: any): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req: any) => req.ip as string,
    errorResponseBuilder: (_req: any, context: any) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${context.ttl}ms`,
    }),
  });
}

export const authRateLimit = {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
} as const;

export const announceRateLimit = {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
} as const;
