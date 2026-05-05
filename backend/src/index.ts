import { buildApp } from './server';
import { config } from './lib/config';
import { logger } from './lib/logger';

buildApp().then((app) => {
  app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
  });
});
