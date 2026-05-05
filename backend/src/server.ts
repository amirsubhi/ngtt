import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { logger } from './lib/logger';
import { config } from './lib/config';
import { AppError } from './lib/errors';
import { healthRoutes } from './routes/health';
import { registerRateLimiter } from './middleware/rateLimiter';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function buildApp() {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await registerRateLimiter(app);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: err.code,
        message: err.message,
      });
    }
    logger.error(err, 'unhandled error');
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  await app.register(healthRoutes);

  return app;
}
