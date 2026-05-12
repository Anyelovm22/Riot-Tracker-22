import { Router } from 'express';
import { riotController } from '../controllers/riotController.js';
import { validateRegion } from '../middleware/requestValidator.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const riotRoutes = Router();

riotRoutes.get('/profile/:region/:gameName/:tagLine', validateRegion, asyncHandler(riotController.profile));
riotRoutes.get('/ranked/:region/:puuid', validateRegion, asyncHandler(riotController.ranked));
riotRoutes.get('/history/:region/:puuid', validateRegion, asyncHandler(riotController.history));
riotRoutes.get('/ranked-matches/:region/:puuid', validateRegion, asyncHandler(riotController.rankedMatches));
riotRoutes.get('/champion-insights/:region/:puuid', validateRegion, asyncHandler(riotController.championInsights));
riotRoutes.get('/champion-builds-global/:championId', asyncHandler(riotController.championBuildsGlobal));
riotRoutes.get('/champion-builds/:region/:championId', validateRegion, asyncHandler(riotController.championBuilds));
riotRoutes.get('/match/:region/:matchId', validateRegion, asyncHandler(riotController.match));
riotRoutes.get('/live/:region/:puuid', validateRegion, asyncHandler(riotController.live));
riotRoutes.get('/mastery/:region/:puuid', validateRegion, asyncHandler(riotController.mastery));
riotRoutes.get('/summary/:region/:gameName/:tagLine', validateRegion, asyncHandler(riotController.summary));
riotRoutes.post('/coach-recommendations', asyncHandler(riotController.coachRecommendations));
