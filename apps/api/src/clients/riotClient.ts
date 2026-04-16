import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class RiotClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: env.REQUEST_TIMEOUT_MS,
      headers: {
        'X-Riot-Token': env.RIOT_API_KEY
      }
    });
  }

  async get<T>(url: string, query?: Record<string, unknown>): Promise<T> {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const { data } = await this.http.get<T>(url, { params: query });
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

        if (status === 429) {
          const retryAfter = Number(axiosError.response?.headers['retry-after'] ?? 1);
          if (attempt === MAX_RETRIES) {
            throw new AppError('Rate limit alcanzado en Riot API', 429, 'RIOT_RATE_LIMIT');
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
