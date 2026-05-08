import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const riotKeyPattern = /^RGAPI-[A-Za-z0-9_-]+$/;
const REQUEST_SPACING_MS = 80;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let requestChain: Promise<void> = Promise.resolve();

const scheduleRiotRequest = async <T>(task: () => Promise<T>) => {
  const run = requestChain.then(async () => {
    await sleep(REQUEST_SPACING_MS);
    return task();
  });

  requestChain = run.then(
    () => undefined,
    () => undefined
  );

  return run;
};

const getRequestKey = (url: string, query?: Record<string, unknown>) => `${url}:${JSON.stringify(query ?? {})}`;

class RiotClient {
  private readonly http: AxiosInstance;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor() {
    this.http = axios.create({
      timeout: env.REQUEST_TIMEOUT_MS,
      headers: {
        'X-Riot-Token': env.RIOT_API_KEY
      }
    });
  }

  async get<T>(url: string, query?: Record<string, unknown>): Promise<T> {
    if (!riotKeyPattern.test(env.RIOT_API_KEY) || env.RIOT_API_KEY === 'RGAPI-your-key') {
      throw new AppError('RIOT_API_KEY no esta configurada. Genera una key en developer.riotgames.com, ponla en .env y reinicia la API.', 401, 'RIOT_AUTH_ERROR');
    }

    const requestKey = getRequestKey(url, query);
    const activeRequest = this.inFlight.get(requestKey);
    if (activeRequest) {
      return activeRequest as Promise<T>;
    }

    const request = this.requestWithRetry<T>(url, query).finally(() => {
      this.inFlight.delete(requestKey);
    });

    this.inFlight.set(requestKey, request);
    return request;
  }

  private async requestWithRetry<T>(url: string, query?: Record<string, unknown>): Promise<T> {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const { data } = await scheduleRiotRequest(() => this.http.get<T>(url, { params: query }));
        return data;
      } catch (error) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        if (!status) {
          if (attempt === MAX_RETRIES) {
            throw new AppError('No se pudo conectar con Riot API', 503, 'RIOT_UNAVAILABLE');
          }

          attempt += 1;
          await sleep(150 * 2 ** attempt);
          continue;
        }

        if (status === 404) {
          throw new AppError('Jugador no encontrado', 404, 'PLAYER_NOT_FOUND');
        }

        if (status === 401) {
          throw new AppError('RIOT_API_KEY invalida o expirada. Genera una nueva key de Riot, actualiza .env y reinicia la API.', status, 'RIOT_AUTH_ERROR');
        }

        if (status === 403) {
          throw new AppError('Riot rechazo esta consulta. La key existe, pero no tiene acceso a ese recurso o Riot devolvio Forbidden temporalmente.', status, 'RIOT_FORBIDDEN');
        }

        if (status === 429) {
          const retryAfter = Number(axiosError.response?.headers['retry-after'] ?? 1);
          if (attempt === MAX_RETRIES) {
            throw new AppError('Riot API esta limitando demasiadas consultas. Espera unos segundos y vuelve a intentar.', 429, 'RIOT_RATE_LIMIT');
          }

          attempt += 1;
          await sleep(retryAfter * 1000);
          continue;
        }

        if (RETRYABLE_STATUS.has(status)) {
          if (attempt === MAX_RETRIES) {
            throw new AppError('Riot API no disponible temporalmente', 503, 'RIOT_TEMPORARY_ERROR');
          }

          attempt += 1;
          await sleep(200 * 2 ** attempt);
          continue;
        }

        throw new AppError('Error inesperado de Riot API', status, 'RIOT_ERROR');
      }
    }

    throw new AppError('Error desconocido en Riot API', 500, 'RIOT_UNKNOWN');
  }
}

export const riotClient = new RiotClient();
