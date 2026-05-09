import { execute, executeAffected } from '../lib/db';
import { logger } from '../lib/logger';

interface FluxEarnPayload {
  user_id: number;
  amount: number;
  reason: string;
}

export async function earnFlux(data: FluxEarnPayload): Promise<void> {
  const { user_id, amount, reason } = data;

  const affected = await executeAffected(
    'UPDATE users SET flux = flux + ? WHERE id = ?',
    [amount, user_id],
  );

  if (affected === 0) {
    logger.warn({ user_id }, 'earnFlux: user not found');
    return;
  }

  await execute(
    "INSERT INTO flux_transactions (user_id, amount, type, source) VALUES (?, ?, 'earn', ?)",
    [user_id, amount, reason],
  );
}
