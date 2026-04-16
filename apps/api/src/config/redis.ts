import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true
});

redis.on('error', (error) => {
  logger.error({ error }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});
