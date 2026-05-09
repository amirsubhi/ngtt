// Copyright (c) 2026 amirsubhi — MIT License
import { buildApp } from './server';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { initSocket } from './lib/socket';
import { setupShoutbox } from './routes/shoutbox/shoutbox';

buildApp().then((app) => {
  app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
    const io = initSocket(app.server);
    setupShoutbox(io.of('/ws'));
    logger.info(`Server running on port ${config.port}`);
  });
});
