import { Request, Response } from 'express';
import { aiRecommendationService } from '../services/aiRecommendationService.js';
import { riotService } from '../services/riotService.js';
import { ChampionRole, EliteLeagueTier, PlatformRegion, RankedQueueKey } from '../types/riot.js';
import { AppError } from '../utils/errors.js';
import { validRegions } from '../utils/region.js';

const parseRegion = (value: string) => value as PlatformRegion;
const rankedQueues = ['solo', 'flex'] as const;
const eliteLeagueTiers = ['challenger', 'grandmaster', 'master'] as const;
const championRoles = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'UNKNOWN'] as const;

const cleanRiotIdPart = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();

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

const parseChampionRole = (value: unknown): ChampionRole | 'ALL' => {
  if (value === undefined || value === 'ALL') return 'ALL';
  if (typeof value === 'string' && championRoles.includes(value.toUpperCase() as ChampionRole)) {
    return value.toUpperCase() as ChampionRole;
  }

  throw new AppError('Rol invalido. Usa ALL, TOP, JUNGLE, MID, ADC o SUPPORT.', 400, 'INVALID_ROLE');
};

const parseEliteLeagueTier = (value: unknown): EliteLeagueTier => {
  if (value === undefined) return 'challenger';
  if (typeof value === 'string' && eliteLeagueTiers.includes(value.toLowerCase() as EliteLeagueTier)) {
    return value.toLowerCase() as EliteLeagueTier;
  }

  throw new AppError('Fuente elite invalida. Usa challenger, grandmaster o master.', 400, 'INVALID_ELITE_SOURCE');
};

const parseChampionId = (value: string) => {
  const championId = Number(value);
  if (!Number.isInteger(championId) || championId <= 0) {
    throw new AppError('Champion ID invalido.', 400, 'INVALID_CHAMPION_ID');
  }

  return championId;
};

const parseBuildRegions = (value: unknown): PlatformRegion[] | undefined => {
  if (value === undefined) return undefined;

  const rawRegions = Array.isArray(value) ? value.join(',') : String(value);
  const regions = rawRegions
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (regions.length === 0) return undefined;

  const invalidRegion = regions.find((region) => !validRegions.includes(region));
  if (invalidRegion) {
    throw new AppError(`Region global invalida: ${invalidRegion}`, 400, 'INVALID_REGION');
  }

  return regions as PlatformRegion[];
};

export const riotController = {
  async profile(req: Request, res: Response) {
    const { region, gameName, tagLine } = req.params;
    const profile = await riotService.getProfile(parseRegion(region), cleanRiotIdPart(gameName), cleanRiotIdPart(tagLine));
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

  async championBuilds(req: Request, res: Response) {
    const { region, championId } = req.params;
    const queue = parseRankedQueue(req.query.queue);
    const builds = await riotService.getChampionBuilds(parseRegion(region), parseChampionId(championId), {
      queue,
      role: parseChampionRole(req.query.role),
      sourceTier: parseEliteLeagueTier(req.query.sourceTier),
      playerLimit: parseCount(req.query.playerLimit, 8),
      matchesPerPlayer: parseCount(req.query.matchesPerPlayer, 4),
      championMatchLimit: parseCount(req.query.championMatchLimit, 18)
    });
    res.json(builds);
  },

  async championBuildsGlobal(req: Request, res: Response) {
    const { championId } = req.params;
    const queue = parseRankedQueue(req.query.queue);
    const builds = await riotService.getGlobalChampionBuilds(parseChampionId(championId), {
      queue,
      role: parseChampionRole(req.query.role),
      sourceTier: parseEliteLeagueTier(req.query.sourceTier),
      regions: parseBuildRegions(req.query.regions),
      playerLimit: parseCount(req.query.playerLimit, 4),
      matchesPerPlayer: parseCount(req.query.matchesPerPlayer, 3),
      championMatchLimit: parseCount(req.query.championMatchLimit, 12)
    });
    res.json(builds);
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
    const summary = await riotService.getPlayerSummary(parseRegion(region), cleanRiotIdPart(gameName), cleanRiotIdPart(tagLine));
    res.json(summary);
  },

  async coachRecommendations(req: Request, res: Response) {
    const recommendations = await aiRecommendationService.getCoachRecommendations(req.body);
    res.json(recommendations);
  }
};
