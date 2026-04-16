import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

export class CacheRepository {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn({ error, key }, 'Cache read failed');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ error, key }, 'Cache write failed');
    }
  }
}

export const cacheRepository = new CacheRepository();
