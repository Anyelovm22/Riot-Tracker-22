import { Request, Response } from 'express';
import { riotService } from '../services/riotService.js';
import { PlatformRegion, RankedQueueKey } from '../types/riot.js';
import { AppError } from '../utils/errors.js';

const parseRegion = (value: string) => value as PlatformRegion;
const rankedQueues = ['solo', 'flex'] as const;

const parseRankedQueue = (value: unknown, fallback: RankedQueueKey = 'solo') => {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && rankedQueues.includes(value as RankedQueueKey)) {
    return value as RankedQueueKey;
  }

  throw new AppError('Cola clasificatoria inválida. Usa solo o flex.', 400, 'INVALID_RANKED_QUEUE');
};

const parseCount = (value: unknown, fallback: number) => {
  const count = Number(value ?? fallback);
  if (!Number.isFinite(count) || count <= 0) {
    throw new AppError('El parámetro count debe ser un número positivo.', 400, 'INVALID_COUNT');
  }

  return count;
};

export const riotController = {
  async profile(req: Request, res: Response) {
    const { region, gameName, tagLine } = req.params;
    const profile = await riotService.getProfile(parseRegion(region), gameName, tagLine);
    res.json(profile);
  },

  async ranked(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const ranked = await riotService.getRanked(parseRegion(region), puuid);
    res.json(ranked);
  },

  async history(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const count = parseCount(req.query.count, 10);
    const queue = typeof req.query.queue === 'string' ? parseRankedQueue(req.query.queue) : undefined;
    const history = await riotService.getMatchHistory(parseRegion(region), puuid, count, queue);
    res.json(history);
  },

  async rankedMatches(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const queue = parseRankedQueue(req.query.queue);
    const count = parseCount(req.query.count, 40);
    const matches = await riotService.getRankedMatches(parseRegion(region), puuid, queue, count);
    res.json(matches);
  },

  async championInsights(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const queue = parseRankedQueue(req.query.queue);
    const count = parseCount(req.query.count, 80);
    const insights = await riotService.getChampionInsights(parseRegion(region), puuid, queue, count);
    res.json(insights);
  },

  async match(req: Request, res: Response) {
    const { region, matchId } = req.params;
    const puuid = typeof req.query.puuid === 'string' ? req.query.puuid : undefined;
    const match = await riotService.getMatch(parseRegion(region), matchId, puuid);
    res.json(match);
  },

  async live(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const live = await riotService.getLiveGame(parseRegion(region), puuid);
    res.json(live);
  },

  async mastery(req: Request, res: Response) {
    const { region, puuid } = req.params;
    const count = Number(req.query.count ?? 8);
    const mastery = await riotService.getChampionMastery(parseRegion(region), puuid, count);
    res.json(mastery);
  },

  async summary(req: Request, res: Response) {
    const { region, gameName, tagLine } = req.params;
    const summary = await riotService.getPlayerSummary(parseRegion(region), gameName, tagLine);
    res.json(summary);
  }
};
