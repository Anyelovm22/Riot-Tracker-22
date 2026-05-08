import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  timeout: 60000
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = error.response?.data?.error;
    const message =
      apiError?.message ??
      (error.response ? error.message : 'No se pudo conectar con la API. Revisa que npm run dev:api este corriendo y que RIOT_API_KEY exista.');
    return Promise.reject(new Error(message));
  }
);
