import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

const configDir = __dirname;
const apiRoot = path.resolve(configDir, '../..');
const repoRoot = path.resolve(apiRoot, '../..');

dotenv.config({
  path: [path.resolve(repoRoot, '.env'), path.resolve(apiRoot, '.env'), path.resolve(process.cwd(), '.env')]
});

const resolvedPort = process.env.API_PORT ?? process.env.PORT ?? 1000;
const normalizeEnvValue = (value?: string) => value?.trim();
const isUsableRiotKey = (value?: string) => Boolean(value && value !== 'RGAPI-your-key');
const resolvedRiotApiKey =
  [normalizeEnvValue(process.env.RIOT_API_KEY), normalizeEnvValue(process.env.RIOT_API_TOKEN)].find(isUsableRiotKey) ??
  normalizeEnvValue(process.env.RIOT_API_KEY) ??
  normalizeEnvValue(process.env.RIOT_API_TOKEN);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(1000),
  RIOT_API_KEY: z
    .string()
    .min(1, 'RIOT_API_KEY es requerido. Configúralo en tu archivo .env con una API key válida de Riot.'),
  RIOT_BASE_URL: z.string().url().default('https://americas.api.riotgames.com'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().default(120),
  LOG_LEVEL: z.string().default('info')
});

export const env = envSchema.parse({
  ...process.env,
  API_PORT: resolvedPort,
  RIOT_API_KEY: resolvedRiotApiKey
});
