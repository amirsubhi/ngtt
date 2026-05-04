import { FastifyInstance } from 'fastify';
import { pool } from '../lib/db';
import { redis } from '../lib/redis';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    reply.send({ status: 'ok', pid: process.pid });
  });

  app.get('/ready', async (_req, reply) => {
    let db = false;
    let redisOk = false;

    try {
      const conn = await pool.getConnection();
      await conn.execute('SELECT 1');
      conn.release();
      db = true;
    } catch { /* stays false */ }

    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch { /* stays false */ }

    const ready = db && redisOk;
    reply
      .status(ready ? 200 : 503)
      .send({ status: ready ? 'ready' : 'unavailable', db, redis: redisOk });
  });
}
