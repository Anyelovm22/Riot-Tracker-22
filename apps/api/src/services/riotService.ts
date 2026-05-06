import { env } from '../config/env.js';
import { riotClient } from '../clients/riotClient.js';
import { cacheRepository } from '../repositories/cacheRepository.js';
import {
  ChampionBuildStats,
  ChampionBuildVariant,
  ChampionInsightsResponse,
  ChampionMastery,
  ChampionRole,
  ChampionTier,
  ChampionTierRow,
  MatchOverview,
  PlatformRegion,
  PlayerSummary,
  RankedEntry,
  RankedQueueKey,
  SummonerProfile
} from '../types/riot.js';
import { getRegionalRouting } from '../utils/region.js';
import { AppError } from '../utils/errors.js';

const cacheKey = (...parts: string[]) => `riot:${parts.join(':')}`;

const rankedQueueIds: Record<RankedQueueKey, number> = {
  solo: 420,
  flex: 440
};

const matchPageSize = 100;
const matchDetailConcurrency = 4;

const roleAliases: Record<string, ChampionRole> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MID',
  MID: 'MID',
  BOTTOM: 'ADC',
  BOT: 'ADC',
  ADC: 'ADC',
  UTILITY: 'SUPPORT',
  SUPPORT: 'SUPPORT'
};

const normalizeRole = (teamPosition: string, lane: string): ChampionRole => {
  const rawPosition = teamPosition?.toUpperCase();
  const rawLane = lane?.toUpperCase();
  return roleAliases[rawPosition] ?? roleAliases[rawLane] ?? 'UNKNOWN';
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const getKda = (match: MatchOverview) => (match.kills + match.assists) / Math.max(1, match.deaths);

const getWinRate = (matches: MatchOverview[]) => {
  if (matches.length === 0) return 0;
  return (matches.filter((match) => match.win).length / matches.length) * 100;
};

const getTier = (score: number, confidence: number): ChampionTier => {
  if (score >= 78 && confidence >= 55) return 'S+';
  if (score >= 68 && confidence >= 45) return 'S';
  if (score >= 57) return 'A';
  if (score >= 47) return 'B';
  return 'C';
};

const getCommonIds = (matches: MatchOverview[], selector: (match: MatchOverview) => number[], limit: number) => {
  const counts = new Map<number, { count: number; positionSum: number }>();

  matches.forEach((match) => {
    selector(match).forEach((id, index) => {
      if (!id) return;
      const current = counts.get(id) ?? { count: 0, positionSum: 0 };
      counts.set(id, { count: current.count + 1, positionSum: current.positionSum + index });
    });
  });

  return [...counts.entries()]
    .sort(([, a], [, b]) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.positionSum / a.count - b.positionSum / b.count;
    })
    .slice(0, limit)
    .map(([id]) => id);
};

const getBuildVariants = (matches: MatchOverview[]): ChampionBuildVariant[] => {
  const variants = new Map<string, { itemIds: number[]; matches: MatchOverview[] }>();

  matches.forEach((match) => {
    const itemIds = match.itemIds.filter(Boolean).slice(0, 6);
    if (itemIds.length === 0) return;

    const signature = itemIds.join('-');
    const current = variants.get(signature) ?? { itemIds, matches: [] };
    current.matches.push(match);
    variants.set(signature, current);
  });

  return [...variants.values()]
    .sort((a, b) => {
      if (b.matches.length !== a.matches.length) return b.matches.length - a.matches.length;
      return getWinRate(b.matches) - getWinRate(a.matches);
    })
    .slice(0, 4)
    .map((variant, index) => {
      const games = variant.matches.length;
      const wins = variant.matches.filter((match) => match.win).length;
      const winRate = getWinRate(variant.matches);

      return {
        name: `Build ${index + 1}`,
        itemIds: variant.itemIds,
        games,
        wins,
        winRate: round(winRate),
        avgKda: round(average(variant.matches.map(getKda)), 2),
        note: `${games} partidas reales, ${round(winRate)}% win rate`
      };
    });
};

const getPerformanceScore = (matches: MatchOverview[], role: ChampionRole) => {
  const games = matches.length;
  const winRate = getWinRate(matches);
  const avgKda = average(matches.map(getKda));
  const avgCs = average(matches.map((match) => match.csPerMinute));
  const avgVision = average(matches.map((match) => match.visionScore));
  const avgKillParticipation = average(matches.map((match) => match.killParticipation));
  const avgObjectives = average(matches.map((match) => match.objectiveTakedowns));
  const laneEconomyScore = role === 'SUPPORT' ? clamp((avgVision / 42) * 100) : clamp((avgCs / 8.2) * 100);
  const rawScore =
    winRate * 0.42 +
    clamp((avgKda / 4.4) * 100) * 0.2 +
    laneEconomyScore * 0.14 +
    clamp((avgKillParticipation / 68) * 100) * 0.12 +
    clamp((avgObjectives / 3.4) * 100) * 0.12;
  const confidence = round(clamp((games / 12) * 100, 18, 100));
  const confidenceWeight = confidence / 100;

  return {
    score: round(rawScore * confidenceWeight + 50 * (1 - confidenceWeight)),
    confidence
  };
};

const normalizeCount = (count: number, fallback = 20) => {
  if (!Number.isFinite(count) || count <= 0) return fallback;
  return Math.min(200, Math.max(1, Math.floor(count)));
};

const mapWithConcurrency = async <Input, Output>(
  items: Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>
) => {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

interface RiotMatchParticipant {
  puuid: string;
  championName: string;
  championId: number;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  detectorWardsPlaced: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  teamPosition: string;
  individualPosition: string;
  lane: string;
  champLevel: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  dragonKills?: number;
  baronKills?: number;
  turretTakedowns?: number;
  inhibitorTakedowns?: number;
  totalTimeSpentDead?: number;
  challenges?: {
    killParticipation?: number;
    goldPerMinute?: number;
    damagePerMinute?: number;
  };
}

interface RiotMatchResponse {
  info: {
    queueId: number;
    gameDuration: number;
    gameCreation: number;
    participants?: RiotMatchParticipant[];
  };
}

export class RiotService {
  private readonly defaultTtl = env.CACHE_DEFAULT_TTL_SECONDS;

  private getPlatformBase(region: PlatformRegion) {
    return `https://${region}.api.riotgames.com`;
  }

  private getRegionalBase(region: PlatformRegion) {
    const routing = getRegionalRouting(region);
    return `https://${routing}.api.riotgames.com`;
  }

  async getProfile(region: PlatformRegion, gameName: string, tagLine: string): Promise<SummonerProfile> {
    const key = cacheKey('profile', region, gameName, tagLine);
    const cached = await cacheRepository.get<SummonerProfile>(key);

    if (cached) {
      return cached;
    }

    const account = await riotClient.get<{ puuid: string; gameName: string; tagLine: string }>(
      `${this.getRegionalBase(region)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    const summoner = await riotClient.get<{ profileIconId: number; summonerLevel: number }>(
      `${this.getPlatformBase(region)}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
    );

    const profile: SummonerProfile = {
      ...account,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel
    };

    await cacheRepository.set(key, profile, this.defaultTtl);
    return profile;
  }

  async getRanked(region: PlatformRegion, puuid: string): Promise<RankedEntry[]> {
    const key = cacheKey('ranked', region, puuid);
    const cached = await cacheRepository.get<RankedEntry[]>(key);
    if (cached) return cached;

    const ranked = await riotClient.get<RankedEntry[]>(`${this.getPlatformBase(region)}/lol/league/v4/entries/by-puuid/${puuid}`);
    await cacheRepository.set(key, ranked, this.defaultTtl);
    return ranked;
  }

  async getMatchHistory(region: PlatformRegion, puuid: string, count = 10, queue?: RankedQueueKey): Promise<string[]> {
    const normalizedCount = normalizeCount(count, 10);
    const key = cacheKey('history', region, puuid, String(normalizedCount), queue ?? 'all');
    const cached = await cacheRepository.get<string[]>(key);
    if (cached) return cached;

    const ids: string[] = [];
    let start = 0;

    while (ids.length < normalizedCount) {
      const pageCount = Math.min(matchPageSize, normalizedCount - ids.length);
      const query: Record<string, unknown> = { count: pageCount, start };

      if (queue) {
        query.queue = rankedQueueIds[queue];
      }

      const page = await riotClient.get<string[]>(`${this.getRegionalBase(region)}/lol/match/v5/matches/by-puuid/${puuid}/ids`, query);
      ids.push(...page);

      if (page.length < pageCount) {
        break;
      }

      start += page.length;
    }

    await cacheRepository.set(key, ids, 90);
    return ids;
  }

  async getRankedMatches(region: PlatformRegion, puuid: string, queue: RankedQueueKey, count = 40): Promise<MatchOverview[]> {
    const matchIds = await this.getMatchHistory(region, puuid, count, queue);
    const matches = await mapWithConcurrency(matchIds, matchDetailConcurrency, (id) => this.getMatch(region, id, puuid));
    return matches.sort((a, b) => b.gameCreation - a.gameCreation);
  }

  async getChampionInsights(region: PlatformRegion, puuid: string, queue: RankedQueueKey, count = 80): Promise<ChampionInsightsResponse> {
    const normalizedCount = normalizeCount(count, 80);
    const key = cacheKey('champion-insights', region, puuid, queue, String(normalizedCount));
    const cached = await cacheRepository.get<ChampionInsightsResponse>(key);
    if (cached) return cached;

    const matches = await this.getRankedMatches(region, puuid, queue, normalizedCount);
    const groupedMatches = new Map<string, { championId: number; championName: string; role: ChampionRole; matches: MatchOverview[] }>();

    matches.forEach((match) => {
      const role = normalizeRole(match.teamPosition, match.lane);
      const key = `${match.championId}:${role}`;
      const current = groupedMatches.get(key) ?? {
        championId: match.championId,
        championName: match.championName,
        role,
        matches: []
      };

      current.matches.push(match);
      groupedMatches.set(key, current);
    });

    const builds: ChampionBuildStats[] = [...groupedMatches.values()]
      .map((group) => {
        const games = group.matches.length;
        const wins = group.matches.filter((match) => match.win).length;
        const losses = games - wins;
        const winRate = getWinRate(group.matches);
        const { score, confidence } = getPerformanceScore(group.matches, group.role);
        const itemIds = getCommonIds(group.matches, (match) => match.itemIds.filter(Boolean).slice(0, 6), 6);
        const coreItemIds = itemIds.slice(0, 3);
        const situationalItemIds = itemIds.slice(3, 6);

        return {
          championId: group.championId,
          championName: group.championName,
          role: group.role,
          games,
          wins,
          losses,
          winRate: round(winRate),
          pickRate: matches.length ? round((games / matches.length) * 100) : 0,
          avgKda: round(average(group.matches.map(getKda)), 2),
          avgCs: round(average(group.matches.map((match) => match.csPerMinute)), 2),
          avgVision: round(average(group.matches.map((match) => match.visionScore)), 1),
          avgDamage: round(average(group.matches.map((match) => match.damageToChampions))),
          avgGold: round(average(group.matches.map((match) => match.goldEarned))),
          avgKillParticipation: round(average(group.matches.map((match) => match.killParticipation))),
          avgObjectives: round(average(group.matches.map((match) => match.objectiveTakedowns)), 2),
          score,
          confidence,
          tier: getTier(score, confidence),
          itemIds,
          coreItemIds,
          situationalItemIds,
          summonerSpellIds: getCommonIds(group.matches, (match) => match.summonerSpellIds.filter(Boolean), 2),
          variants: getBuildVariants(group.matches),
          lastPlayedAt: Math.max(...group.matches.map((match) => match.gameCreation))
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.games - a.games;
      });

    const tierList: ChampionTierRow[] = builds.map((build) => ({
      championId: build.championId,
      championName: build.championName,
      role: build.role,
      tier: build.tier,
      score: build.score,
      confidence: build.confidence,
      games: build.games,
      wins: build.wins,
      losses: build.losses,
      winRate: build.winRate,
      pickRate: build.pickRate,
      avgKda: build.avgKda,
      avgCs: build.avgCs,
      avgVision: build.avgVision,
      coreItemIds: build.coreItemIds,
      lastPlayedAt: build.lastPlayedAt
    }));

    const response: ChampionInsightsResponse = {
      source: 'riot-match-v5',
      queue,
      count: normalizedCount,
      totalMatches: matches.length,
      generatedAt: new Date().toISOString(),
      builds,
      tierList
    };

    await cacheRepository.set(key, response, 90);
    return response;
  }

  async getMatch(region: PlatformRegion, matchId: string, puuid?: string): Promise<MatchOverview> {
    const key = cacheKey('match', region, matchId, puuid ?? 'first');
    const cached = await cacheRepository.get<MatchOverview>(key);
    if (cached) return cached;

    const match = await riotClient.get<RiotMatchResponse>(`${this.getRegionalBase(region)}/lol/match/v5/matches/${matchId}`);
    const participants = match.info.participants ?? [];
    const participant = puuid ? participants.find((item) => item.puuid === puuid) : participants[0];

    if (!participant) {
      throw new AppError('No encontramos al jugador dentro de esta partida', 422, 'INVALID_MATCH_PLAYER');
    }

    const gameMinutes = Math.max(1, match.info.gameDuration / 60);
    const teamKills = participants.filter((item) => item.teamId === participant.teamId).reduce((total, item) => total + item.kills, 0);
    const minions = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const objectiveTakedowns =
      (participant.dragonKills ?? 0) +
      (participant.baronKills ?? 0) +
      (participant.turretTakedowns ?? 0) +
      (participant.inhibitorTakedowns ?? 0);

    const overview: MatchOverview = {
      matchId,
      championName: participant.championName,
      championId: participant.championId,
      queueId: match.info.queueId,
      win: participant.win,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      csPerMinute: Number((minions / gameMinutes).toFixed(2)),
      visionScore: participant.visionScore,
      wardsPlaced: participant.wardsPlaced ?? 0,
      wardsKilled: participant.wardsKilled ?? 0,
      controlWardsPlaced: participant.detectorWardsPlaced ?? 0,
      goldEarned: participant.goldEarned,
      goldPerMinute: Number((participant.challenges?.goldPerMinute ?? participant.goldEarned / gameMinutes).toFixed(1)),
      damageToChampions: participant.totalDamageDealtToChampions,
      damagePerMinute: Number((participant.challenges?.damagePerMinute ?? participant.totalDamageDealtToChampions / gameMinutes).toFixed(1)),
      killParticipation: Number(
        ((participant.challenges?.killParticipation ?? (teamKills === 0 ? 0 : (participant.kills + participant.assists) / teamKills)) * 100).toFixed(1)
      ),
      teamPosition: participant.teamPosition || participant.individualPosition || 'UNKNOWN',
      lane: participant.lane,
      champLevel: participant.champLevel,
      itemIds: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6].filter(Boolean),
      summonerSpellIds: [participant.summoner1Id ?? 0, participant.summoner2Id ?? 0].filter(Boolean),
      objectiveTakedowns,
      totalTimeSpentDead: participant.totalTimeSpentDead ?? 0,
      gameDurationSeconds: match.info.gameDuration,
      gameCreation: match.info.gameCreation
    };

    await cacheRepository.set(key, overview, this.defaultTtl);
    return overview;
  }

  async getLiveGame(region: PlatformRegion, puuid: string): Promise<Record<string, unknown> | null> {
    const key = cacheKey('live', region, puuid);
    const cached = await cacheRepository.get<Record<string, unknown> | null>(key);
    if (cached !== null) return cached;

    try {
      const live = await riotClient.get<Record<string, unknown>>(
        `${this.getPlatformBase(region)}/lol/spectator/v5/active-games/by-summoner/${puuid}`
      );
      await cacheRepository.set(key, live, 20);
      return live;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        await cacheRepository.set(key, null, 15);
        return null;
      }
      throw error;
    }
  }

  async getChampionMastery(region: PlatformRegion, puuid: string, count = 8): Promise<ChampionMastery[]> {
    const key = cacheKey('mastery', region, puuid, String(count));
    const cached = await cacheRepository.get<ChampionMastery[]>(key);
    if (cached) return cached;

    const mastery = await riotClient.get<ChampionMastery[]>(
      `${this.getPlatformBase(region)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top`,
      { count }
    );

    await cacheRepository.set(key, mastery, this.defaultTtl);
    return mastery;
  }

  async getPlayerSummary(region: PlatformRegion, gameName: string, tagLine: string): Promise<PlayerSummary> {
    const profile = await this.getProfile(region, gameName, tagLine);
    const [ranked, mastery, soloMatchIds, flexMatchIds] = await Promise.all([
      this.getRanked(region, profile.puuid),
      this.getChampionMastery(region, profile.puuid, 5),
      this.getMatchHistory(region, profile.puuid, 5, 'solo'),
      this.getMatchHistory(region, profile.puuid, 5, 'flex')
    ]);

    const matchIds = [...new Set([...soloMatchIds, ...flexMatchIds])];
    const matches = await mapWithConcurrency(matchIds, matchDetailConcurrency, (id) => this.getMatch(region, id, profile.puuid));

    const totalGames = matches.length || 1;
    const wins = matches.filter((m) => m.win).length;

    return {
      puuid: profile.puuid,
      profile,
      ranked,
      masteryTop: mastery,
      insights: {
        winRate: Number(((wins / totalGames) * 100).toFixed(1)),
        avgKda: Number(
          (
            matches.reduce((acc, m) => acc + (m.kills + m.assists) / Math.max(1, m.deaths), 0) /
            totalGames
          ).toFixed(2)
        ),
        avgCsMin: Number((matches.reduce((acc, m) => acc + m.csPerMinute, 0) / totalGames).toFixed(2)),
        visionPerGame: Number((matches.reduce((acc, m) => acc + m.visionScore, 0) / totalGames).toFixed(1))
      }
    };
  }
}

export const riotService = new RiotService();
