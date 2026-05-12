import axios from 'axios';

const apiTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 90000);
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:1000/api';

export const apiClient = axios.create({
  baseURL,
  timeout: Number.isFinite(apiTimeout) ? apiTimeout : 90000
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = error.response?.data?.error;
    const isTimeout = error.code === 'ECONNABORTED' || String(error.message ?? '').toLowerCase().includes('timeout');
    const isNetworkError = error.code === 'ERR_NETWORK' || (!error.response && !isTimeout);
    const message =
      apiError?.message ??
      (isTimeout
        ? 'La consulta tardo demasiado. Intenta una region especifica o una muestra mas pequena; la API local puede seguir procesando Riot.'
        : isNetworkError
          ? `No se pudo conectar con la API local en ${baseURL}. Revisa que npm run dev:api este corriendo.`
          : error.message);
    return Promise.reject(new Error(message));
  }
);
