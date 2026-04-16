import { Router } from 'express';
import { riotController } from '../controllers/riotController.js';
import { validateRegion } from '../middleware/requestValidator.js';

export const riotRoutes = Router();

riotRoutes.get('/profile/:region/:gameName/:tagLine', validateRegion, riotController.profile);
riotRoutes.get('/ranked/:region/:puuid', validateRegion, riotController.ranked);
riotRoutes.get('/history/:region/:puuid', validateRegion, riotController.history);
riotRoutes.get('/match/:region/:matchId', validateRegion, riotController.match);
riotRoutes.get('/live/:region/:puuid', validateRegion, riotController.live);
riotRoutes.get('/mastery/:region/:puuid', validateRegion, riotController.mastery);
riotRoutes.get('/summary/:region/:gameName/:tagLine', validateRegion, riotController.summary);
