import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  RIOT_API_KEY: z.string().min(1),
  RIOT_BASE_URL: z.string().url().default('https://americas.api.riotgames.com'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().default(120),
  LOG_LEVEL: z.string().default('info')
});

export const env = envSchema.parse(process.env);
