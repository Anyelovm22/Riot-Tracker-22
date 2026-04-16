import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { riotRoutes } from './routes/riotRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './config/logger.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'riot-tracker-api' });
});

app.use('/api/riot', riotRoutes);
app.use(errorHandler);
