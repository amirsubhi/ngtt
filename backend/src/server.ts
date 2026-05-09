import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { logger } from './lib/logger';
import { config } from './lib/config';
import { AppError } from './lib/errors';
import { healthRoutes } from './routes/health';
import { settingsRoutes } from './routes/settings';
import { authRoutes } from './routes/auth';
import { inviteRoutes } from './routes/invites';
import { announceRoutes } from './announce/announce';
import { scrapeRoutes } from './announce/scrape';
import { torrentRoutes } from './routes/torrents/index';
import { userRoutes } from './routes/users/index';
import { fluxRoutes } from './routes/flux/index';
import { forumRoutes } from './routes/forum/index';
import { messagesRoutes } from './routes/messages/index';
import { notificationsRoutes } from './routes/notifications/index';
import { newsRoutes } from './routes/news/index';
import { hnrRoutes } from './routes/hnr/index';
import { subtitleRoutes } from './routes/subtitles/index';
import { updateLastSeen } from './middleware/lastSeen';
import { registerRateLimiter } from './middleware/rateLimiter';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function buildApp() {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(multipart, { attachFieldsToBody: false });

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
  await app.register(settingsRoutes);
  await app.register(authRoutes);
  await app.register(inviteRoutes);
  await app.register(announceRoutes);
  await app.register(scrapeRoutes);
  await app.register(torrentRoutes);
  await app.register(userRoutes);
  await app.register(fluxRoutes);
  await app.register(forumRoutes);
  await app.register(messagesRoutes);
  await app.register(notificationsRoutes);
  await app.register(newsRoutes);
  await app.register(hnrRoutes);
  await app.register(subtitleRoutes);

  // Debounced last_seen_at update for authenticated requests
  app.addHook('onRequest', updateLastSeen);

  return app;
}
