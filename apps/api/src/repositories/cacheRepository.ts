import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

export class CacheRepository {
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue) {
      if (memoryValue.expiresAt > Date.now()) {
        return JSON.parse(memoryValue.value) as T;
      }

      this.memoryCache.delete(key);
    }

    if (redis.status !== 'ready') {
      return null;
    }

    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }

      this.memoryCache.set(key, { value, expiresAt: Date.now() + 30_000 });
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn({ error, key }, 'Cache read failed');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    this.memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });

    if (redis.status !== 'ready') {
      return;
    }

    try {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ error, key }, 'Cache write failed');
    }
  }
}

export const cacheRepository = new CacheRepository();
