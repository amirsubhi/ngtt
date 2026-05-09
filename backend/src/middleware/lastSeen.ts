import { FastifyRequest, FastifyReply } from 'fastify';
import { execute } from '../lib/db';
import { logger } from '../lib/logger';

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
const lastSeenCache = new Map<number, number>(); // userId → last update timestamp

export async function updateLastSeen(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user?.id) return;

  const userId = req.user.id;
  const now = Date.now();
  const last = lastSeenCache.get(userId) ?? 0;
  if (now - last < DEBOUNCE_MS) return;

  lastSeenCache.set(userId, now);
  void execute('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [userId]).catch(err =>
    logger.warn({ err, userId }, 'lastSeen update failed'),
  );
}
