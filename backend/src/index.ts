import 'dotenv/config';
import Fastify from 'fastify';
import { logger } from './lib/logger';
import { healthRoutes } from './routes/health';

const app = Fastify({ loggerInstance: logger });

app.register(healthRoutes);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    logger.error(err);
    process.exit(1);
  }
});
