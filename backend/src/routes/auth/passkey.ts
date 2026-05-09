import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';

export async function passkeyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/rotate-passkey', { preHandler: authenticate }, async (req, reply) => {
    const newPasskey = crypto.randomBytes(16).toString('hex');
    await execute('UPDATE users SET passkey = ? WHERE id = ?', [newPasskey, req.user.id]);
    return reply.send({ passkey: newPasskey });
  });
}
