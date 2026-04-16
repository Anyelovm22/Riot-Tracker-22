import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { redis } from './config/redis.js';

const start = async () => {
  try {
    await redis.connect();
  } catch (error) {
    logger.warn({ error }, 'Redis no disponible, continuando sin caché persistente');
  }

  app.listen(env.API_PORT, () => {
    logger.info(`API escuchando en puerto ${env.API_PORT}`);
  });
};

start();
