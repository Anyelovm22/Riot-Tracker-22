import { env } from '../config/env.js';
import { riotClient } from '../clients/riotClient.js';
import { cacheRepository } from '../repositories/cacheRepository.js';
import {
  ChampionBuildStats,
  ChampionBuildVariant,
  ChampionBuildsResponse,
  ChampionInsightsResponse,
  ChampionAbilityOrder,
  ChampionElitePlayerBuild,
  ChampionGlobalBuildVariant,
  ChampionItemBlock,
  ChampionItemTiming,
  ChampionMastery,
  ChampionRecentBuildMatch,
  ChampionRunePage,
  ChampionRole,
  ChampionSpellPair,
  ChampionTier,
  ChampionTierRow,
  EliteLeagueTier,
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

const rankedQueueNames: Record<RankedQueueKey, string> = {
  solo: 'RANKED_SOLO_5x5',
  flex: 'RANKED_FLEX_SR'
};

const eliteLeagueEndpoints: Record<EliteLeagueTier, string> = {
  challenger: 'challengerleagues',
  grandmaster: 'grandmasterleagues',
  master: 'masterleagues'
};

const globalBuildRegions: PlatformRegion[] = ['kr', 'euw1', 'na1', 'br1', 'la1', 'la2', 'eun1', 'jp1', 'oc1', 'tr1', 'ru'];

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

const getKda = (match: Pick<MatchOverview, 'kills' | 'assists' | 'deaths'>) => (match.kills + match.assists) / Math.max(1, match.deaths);

const getWinRate = (matches: Pick<MatchOverview, 'win'>[]) => {
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

interface ItemCandidate {
  itemId: number;
  timestampSeconds?: number;
}

interface ChampionBuildSample {
  region: PlatformRegion;
  matchId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  role: ChampionRole;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number;
  damageToChampions: number;
  goldEarned: number;
  killParticipation: number;
  itemIds: number[];
  summonerSpellIds: number[];
  perkStyleIds: number[];
  perkIds: number[];
  abilityOrder: number[];
  purchases: ItemCandidate[];
  gameDurationSeconds: number;
  gameCreation: number;
}

const getSignature = (ids: number[]) => ids.filter(Boolean).join('-');

const percentage = (value: number, total: number) => (total > 0 ? round((value / total) * 100) : 0);

const uniqueItemCandidates = (items: ItemCandidate[]) => {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (!item.itemId || seen.has(item.itemId)) return false;
    seen.add(item.itemId);
    return true;
  });
};

const getGlobalBuildVariants = (samples: ChampionBuildSample[]): ChampionGlobalBuildVariant[] => {
  const totalGames = samples.length;
  const variants = new Map<string, { itemIds: number[]; samples: ChampionBuildSample[] }>();

  samples.forEach((sample) => {
    const itemIds = sample.itemIds.filter(Boolean).slice(0, 6);
    if (itemIds.length === 0) return;

    const signature = getSignature(itemIds);
    const current = variants.get(signature) ?? { itemIds, samples: [] };
    current.samples.push(sample);
    variants.set(signature, current);
  });

  return [...variants.values()]
    .sort((a, b) => {
      if (b.samples.length !== a.samples.length) return b.samples.length - a.samples.length;
      return getWinRate(b.samples) - getWinRate(a.samples);
    })
    .slice(0, 6)
    .map((variant, index) => {
      const games = variant.samples.length;
      const wins = variant.samples.filter((sample) => sample.win).length;

      return {
        id: getSignature(variant.itemIds),
        name: `Build ${index + 1}`,
        itemIds: variant.itemIds,
        games,
        wins,
        winRate: round(getWinRate(variant.samples)),
        pickRate: percentage(games, totalGames),
        avgKda: round(average(variant.samples.map(getKda)), 2),
        popularity: percentage(games, totalGames)
      };
    });
};

const getItemBlock = (
  label: ChampionItemBlock['label'],
  samples: ChampionBuildSample[],
  selector: (sample: ChampionBuildSample) => ItemCandidate[],
  limit = 6
): ChampionItemBlock => {
  const counts = new Map<number, { games: number; wins: number; timestampSum: number; timestampCount: number }>();

  samples.forEach((sample) => {
    uniqueItemCandidates(selector(sample)).forEach((item) => {
      const current = counts.get(item.itemId) ?? { games: 0, wins: 0, timestampSum: 0, timestampCount: 0 };
      counts.set(item.itemId, {
        games: current.games + 1,
        wins: current.wins + (sample.win ? 1 : 0),
        timestampSum: current.timestampSum + (item.timestampSeconds ?? 0),
        timestampCount: current.timestampCount + (item.timestampSeconds === undefined ? 0 : 1)
      });
    });
  });

  const items: ChampionItemTiming[] = [...counts.entries()]
    .sort(([, a], [, b]) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.wins / Math.max(1, b.games) - a.wins / Math.max(1, a.games);
    })
    .slice(0, limit)
    .map(([itemId, stats]) => ({
      itemId,
      games: stats.games,
      wins: stats.wins,
      pickRate: percentage(stats.games, samples.length),
      winRate: percentage(stats.wins, stats.games),
      avgTimestampSeconds: stats.timestampCount ? Math.round(stats.timestampSum / stats.timestampCount) : 0
    }));

  return { label, items };
};

const getRunePages = (samples: ChampionBuildSample[]): ChampionRunePage[] => {
  const pages = new Map<string, { primaryStyleId: number; subStyleId: number; perkIds: number[]; samples: ChampionBuildSample[] }>();

  samples.forEach((sample) => {
    if (sample.perkIds.length === 0) return;
    const primaryStyleId = sample.perkStyleIds[0] ?? 0;
    const subStyleId = sample.perkStyleIds[1] ?? 0;
    const perkIds = sample.perkIds.slice(0, 9);
    const key = `${primaryStyleId}:${subStyleId}:${getSignature(perkIds)}`;
    const current = pages.get(key) ?? { primaryStyleId, subStyleId, perkIds, samples: [] };
    current.samples.push(sample);
    pages.set(key, current);
  });

  return [...pages.values()]
    .sort((a, b) => b.samples.length - a.samples.length || getWinRate(b.samples) - getWinRate(a.samples))
    .slice(0, 4)
    .map((page) => ({
      id: `${page.primaryStyleId}:${page.subStyleId}:${getSignature(page.perkIds)}`,
      primaryStyleId: page.primaryStyleId,
      subStyleId: page.subStyleId,
      perkIds: page.perkIds,
      games: page.samples.length,
      wins: page.samples.filter((sample) => sample.win).length,
      pickRate: percentage(page.samples.length, samples.length),
      winRate: round(getWinRate(page.samples))
    }));
};

const getSpellPairs = (samples: ChampionBuildSample[]): ChampionSpellPair[] => {
  const pairs = new Map<string, { spellIds: number[]; samples: ChampionBuildSample[] }>();

  samples.forEach((sample) => {
    const spellIds = sample.summonerSpellIds.filter(Boolean).slice(0, 2);
    if (spellIds.length === 0) return;
    const key = getSignature(spellIds);
    const current = pairs.get(key) ?? { spellIds, samples: [] };
    current.samples.push(sample);
    pairs.set(key, current);
  });

  return [...pairs.values()]
    .sort((a, b) => b.samples.length - a.samples.length || getWinRate(b.samples) - getWinRate(a.samples))
    .slice(0, 4)
    .map((pair) => ({
      spellIds: pair.spellIds,
      games: pair.samples.length,
      wins: pair.samples.filter((sample) => sample.win).length,
      pickRate: percentage(pair.samples.length, samples.length),
      winRate: round(getWinRate(pair.samples))
    }));
};

const getAbilityOrders = (samples: ChampionBuildSample[]): ChampionAbilityOrder[] => {
  const orders = new Map<string, { sequence: number[]; samples: ChampionBuildSample[] }>();

  samples.forEach((sample) => {
    const sequence = sample.abilityOrder.filter(Boolean).slice(0, 18);
    if (sequence.length === 0) return;
    const key = getSignature(sequence);
    const current = orders.get(key) ?? { sequence, samples: [] };
    current.samples.push(sample);
    orders.set(key, current);
  });

  return [...orders.values()]
    .sort((a, b) => b.samples.length - a.samples.length || getWinRate(b.samples) - getWinRate(a.samples))
    .slice(0, 3)
    .map((order) => ({
      sequence: order.sequence,
      games: order.samples.length,
      wins: order.samples.filter((sample) => sample.win).length,
      pickRate: percentage(order.samples.length, samples.length),
      winRate: round(getWinRate(order.samples))
    }));
};

const getTopPlayers = (samples: ChampionBuildSample[]): ChampionElitePlayerBuild[] => {
  const players = new Map<string, ChampionBuildSample[]>();

  samples.forEach((sample) => {
    players.set(sample.puuid, [...(players.get(sample.puuid) ?? []), sample]);
  });

  return [...players.entries()]
    .map(([puuid, playerSamples]) => {
      const sorted = [...playerSamples].sort((a, b) => b.gameCreation - a.gameCreation);
      const latest = sorted[0];
      const games = sorted.length;
      const wins = sorted.filter((sample) => sample.win).length;

      return {
        puuid,
        gameName: latest.gameName,
        tagLine: latest.tagLine,
        region: latest.region,
        role: latest.role,
        games,
        wins,
        winRate: percentage(wins, games),
        avgKda: round(average(sorted.map(getKda)), 2),
        lastPlayedAt: latest.gameCreation,
        itemIds: latest.itemIds,
        summonerSpellIds: latest.summonerSpellIds,
        perkIds: latest.perkIds,
        matchIds: sorted.map((sample) => sample.matchId)
      };
    })
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 8);
};

const weightedAverageByGames = (items: Array<{ value: number; games: number }>) => {
  const games = items.reduce((total, item) => total + item.games, 0);
  if (games === 0) return 0;
  return items.reduce((total, item) => total + item.value * item.games, 0) / games;
};

const mergeVariants = (responses: ChampionBuildsResponse[], totalGames: number): ChampionGlobalBuildVariant[] => {
  const variants = new Map<string, { itemIds: number[]; games: number; wins: number; kdaSum: number }>();

  responses.forEach((response) => {
    response.variants.forEach((variant) => {
      const current = variants.get(variant.id) ?? { itemIds: variant.itemIds, games: 0, wins: 0, kdaSum: 0 };
      current.games += variant.games;
      current.wins += variant.wins;
      current.kdaSum += variant.avgKda * variant.games;
      variants.set(variant.id, current);
    });
  });

  return [...variants.entries()]
    .map(([id, variant], index) => ({
      id,
      name: `Build ${index + 1}`,
      itemIds: variant.itemIds,
      games: variant.games,
      wins: variant.wins,
      winRate: percentage(variant.wins, variant.games),
      pickRate: percentage(variant.games, totalGames),
      avgKda: variant.games ? round(variant.kdaSum / variant.games, 2) : 0,
      popularity: percentage(variant.games, totalGames)
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, 8)
    .map((variant, index) => ({ ...variant, name: `Build ${index + 1}` }));
};

const mergeItemBlocks = (responses: ChampionBuildsResponse[], totalGames: number): ChampionItemBlock[] => {
  const labels: ChampionItemBlock['label'][] = ['starter', 'early', 'core', 'full'];

  return labels.map((label) => {
    const items = new Map<number, { games: number; wins: number; timestampSum: number }>();

    responses.forEach((response) => {
      response.itemBlocks
        .find((block) => block.label === label)
        ?.items.forEach((item) => {
          const current = items.get(item.itemId) ?? { games: 0, wins: 0, timestampSum: 0 };
          current.games += item.games;
          current.wins += item.wins;
          current.timestampSum += item.avgTimestampSeconds * item.games;
          items.set(item.itemId, current);
        });
    });

    return {
      label,
      items: [...items.entries()]
        .map(([itemId, item]) => ({
          itemId,
          games: item.games,
          wins: item.wins,
          pickRate: percentage(item.games, totalGames),
          winRate: percentage(item.wins, item.games),
          avgTimestampSeconds: item.games ? Math.round(item.timestampSum / item.games) : 0
        }))
        .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
        .slice(0, label === 'early' || label === 'full' ? 10 : 6)
    };
  });
};

const mergeRunePages = (responses: ChampionBuildsResponse[], totalGames: number): ChampionRunePage[] => {
  const pages = new Map<string, { primaryStyleId: number; subStyleId: number; perkIds: number[]; games: number; wins: number }>();

  responses.forEach((response) => {
    response.runePages.forEach((page) => {
      const current = pages.get(page.id) ?? {
        primaryStyleId: page.primaryStyleId,
        subStyleId: page.subStyleId,
        perkIds: page.perkIds,
        games: 0,
        wins: 0
      };
      current.games += page.games;
      current.wins += page.wins;
      pages.set(page.id, current);
    });
  });

  return [...pages.entries()]
    .map(([id, page]) => ({
      id,
      primaryStyleId: page.primaryStyleId,
      subStyleId: page.subStyleId,
      perkIds: page.perkIds,
      games: page.games,
      wins: page.wins,
      pickRate: percentage(page.games, totalGames),
      winRate: percentage(page.wins, page.games)
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, 5);
};

const mergeSpellPairs = (responses: ChampionBuildsResponse[], totalGames: number): ChampionSpellPair[] => {
  const pairs = new Map<string, { spellIds: number[]; games: number; wins: number }>();

  responses.forEach((response) => {
    response.spellPairs.forEach((pair) => {
      const key = getSignature(pair.spellIds);
      const current = pairs.get(key) ?? { spellIds: pair.spellIds, games: 0, wins: 0 };
      current.games += pair.games;
      current.wins += pair.wins;
      pairs.set(key, current);
    });
  });

  return [...pairs.values()]
    .map((pair) => ({
      spellIds: pair.spellIds,
      games: pair.games,
      wins: pair.wins,
      pickRate: percentage(pair.games, totalGames),
      winRate: percentage(pair.wins, pair.games)
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, 5);
};

const mergeAbilityOrders = (responses: ChampionBuildsResponse[], totalGames: number): ChampionAbilityOrder[] => {
  const orders = new Map<string, { sequence: number[]; games: number; wins: number }>();

  responses.forEach((response) => {
    response.abilityOrders.forEach((order) => {
      const key = getSignature(order.sequence);
      const current = orders.get(key) ?? { sequence: order.sequence, games: 0, wins: 0 };
      current.games += order.games;
      current.wins += order.wins;
      orders.set(key, current);
    });
  });

  return [...orders.values()]
    .map((order) => ({
      sequence: order.sequence,
      games: order.games,
      wins: order.wins,
      pickRate: percentage(order.games, totalGames),
      winRate: percentage(order.wins, order.games)
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, 4);
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

const shouldStopBatchForRiotError = (error: unknown) =>
  error instanceof AppError && ['RIOT_AUTH_ERROR', 'RIOT_RATE_LIMIT', 'RIOT_UNAVAILABLE'].includes(error.code);

const flexFallbackScanCount = 220;

interface ChampionBuildOptions {
  queue?: RankedQueueKey;
  role?: ChampionRole | 'ALL';
  sourceTier?: EliteLeagueTier;
  playerLimit?: number;
  matchesPerPlayer?: number;
  championMatchLimit?: number;
}

interface GlobalChampionBuildOptions extends ChampionBuildOptions {
  regions?: PlatformRegion[];
}

interface EliteLeaguePlayer extends RiotLeagueEntry {
  puuid: string;
}

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
  participantId: number;
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
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
  perks?: {
    styles?: Array<{
      style: number;
      selections?: Array<{
        perk: number;
      }>;
    }>;
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

interface RiotTimelineEvent {
  type: string;
  participantId?: number;
  itemId?: number;
  skillSlot?: number;
  timestamp: number;
}

interface RiotMatchTimelineResponse {
  info: {
    frames?: Array<{
      events?: RiotTimelineEvent[];
    }>;
  };
}

interface RiotLeagueEntry {
  puuid?: string;
  summonerId?: string;
  summonerName?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

interface RiotLeagueListResponse {
  entries?: RiotLeagueEntry[];
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

  private async getRawMatch(region: PlatformRegion, matchId: string): Promise<RiotMatchResponse> {
    const key = cacheKey('match-detail', region, matchId);
    const cached = await cacheRepository.get<RiotMatchResponse>(key);
    if (cached) return cached;

    const match = await riotClient.get<RiotMatchResponse>(`${this.getRegionalBase(region)}/lol/match/v5/matches/${matchId}`);
    await cacheRepository.set(key, match, this.defaultTtl);
    return match;
  }

  private async getMatchTimeline(region: PlatformRegion, matchId: string): Promise<RiotMatchTimelineResponse> {
    const key = cacheKey('timeline', region, matchId);
    const cached = await cacheRepository.get<RiotMatchTimelineResponse>(key);
    if (cached) return cached;

    const timeline = await riotClient.get<RiotMatchTimelineResponse>(`${this.getRegionalBase(region)}/lol/match/v5/matches/${matchId}/timeline`);
    await cacheRepository.set(key, timeline, this.defaultTtl);
    return timeline;
  }

  private async getEliteLeaguePlayers(region: PlatformRegion, queue: RankedQueueKey, sourceTier: EliteLeagueTier, limit: number): Promise<EliteLeaguePlayer[]> {
    const key = cacheKey('elite-league', region, queue, sourceTier, String(limit));
    const cached = await cacheRepository.get<EliteLeaguePlayer[]>(key);
    if (cached) return cached;

    const endpoint = eliteLeagueEndpoints[sourceTier];
    const list = await riotClient.get<RiotLeagueListResponse>(
      `${this.getPlatformBase(region)}/lol/league/v4/${endpoint}/by-queue/${rankedQueueNames[queue]}`
    );

    const entries = (list.entries ?? [])
      .sort((a, b) => {
        if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
        return b.wins - a.wins;
      })
      .slice(0, limit);

    const players = await mapWithConcurrency(entries, 4, async (entry): Promise<EliteLeaguePlayer | null> => {
      if (entry.puuid) {
        return { ...entry, puuid: entry.puuid };
      }

      if (!entry.summonerId) {
        return null;
      }

      const summoner = await riotClient.get<{ puuid: string }>(`${this.getPlatformBase(region)}/lol/summoner/v4/summoners/${entry.summonerId}`);
      return { ...entry, puuid: summoner.puuid };
    });

    const resolvedPlayers = players.filter((player): player is EliteLeaguePlayer => Boolean(player)).slice(0, limit);
    await cacheRepository.set(key, resolvedPlayers, 300);
    return resolvedPlayers;
  }

  private getParticipantPerks(participant: RiotMatchParticipant) {
    const styles = participant.perks?.styles ?? [];
    const perkStyleIds = styles.map((style) => style.style).filter(Boolean);
    const perkIds = styles.flatMap((style) => style.selections?.map((selection) => selection.perk).filter(Boolean) ?? []);

    return {
      perkStyleIds,
      perkIds
    };
  }

  private getParticipantTimelineData(timeline: RiotMatchTimelineResponse, participantId: number) {
    const events = (timeline.info.frames ?? [])
      .flatMap((frame) => frame.events ?? [])
      .filter((event) => event.participantId === participantId)
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      purchases: events
        .filter((event) => event.type === 'ITEM_PURCHASED' && event.itemId)
        .map((event) => ({
          itemId: event.itemId ?? 0,
          timestampSeconds: Math.round(event.timestamp / 1000)
        })),
      abilityOrder: events
        .filter((event) => event.type === 'SKILL_LEVEL_UP' && event.skillSlot)
        .map((event) => event.skillSlot ?? 0)
    };
  }

  private async getMatchHistoryPage(region: PlatformRegion, puuid: string, count: number, start: number, queue?: RankedQueueKey) {
    const query: Record<string, unknown> = { count, start };

    if (queue) {
      query.queue = rankedQueueIds[queue];
    }

    return riotClient.get<string[]>(`${this.getRegionalBase(region)}/lol/match/v5/matches/by-puuid/${puuid}/ids`, query);
  }

  private async findQueueMatchesFromRecent(region: PlatformRegion, puuid: string, queue: RankedQueueKey, count: number): Promise<string[]> {
    const key = cacheKey('history-fallback', region, puuid, queue, String(count));
    const cached = await cacheRepository.get<string[]>(key);
    if (cached) return cached;

    const targetQueueId = rankedQueueIds[queue];
    const recentIds: string[] = [];
    let start = 0;

    while (recentIds.length < flexFallbackScanCount) {
      const pageCount = Math.min(matchPageSize, flexFallbackScanCount - recentIds.length);
      const page = await this.getMatchHistoryPage(region, puuid, pageCount, start);
      recentIds.push(...page);

      if (page.length < pageCount) {
        break;
      }

      start += page.length;
    }

    const matches = await mapWithConcurrency(recentIds, matchDetailConcurrency, async (matchId) => {
      try {
        const match = await this.getRawMatch(region, matchId);
        return match.info.queueId === targetQueueId ? matchId : null;
      } catch (error) {
        if (shouldStopBatchForRiotError(error)) throw error;
        return null;
      }
    });

    const queueMatches = matches.filter((matchId): matchId is string => Boolean(matchId)).slice(0, count);
    await cacheRepository.set(key, queueMatches, 90);
    return queueMatches;
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
      const page = await this.getMatchHistoryPage(region, puuid, pageCount, start, queue);
      ids.push(...page);

      if (page.length < pageCount) {
        break;
      }

      start += page.length;
    }

    if (queue === 'flex' && ids.length < normalizedCount) {
      const fallbackIds = await this.findQueueMatchesFromRecent(region, puuid, queue, normalizedCount);
      ids.push(...fallbackIds.filter((id) => !ids.includes(id)));
    }

    const normalizedIds = ids.slice(0, normalizedCount);
    await cacheRepository.set(key, normalizedIds, 90);
    return normalizedIds;
  }

  async getRankedMatches(region: PlatformRegion, puuid: string, queue: RankedQueueKey, count = 40): Promise<MatchOverview[]> {
    const matchIds = await this.getMatchHistory(region, puuid, count, queue);
    const matches = await mapWithConcurrency(matchIds, matchDetailConcurrency, (id) => this.getMatch(region, id, puuid));
    return matches.sort((a, b) => b.gameCreation - a.gameCreation);
  }

  async getChampionBuilds(region: PlatformRegion, championId: number, options: ChampionBuildOptions = {}): Promise<ChampionBuildsResponse> {
    const queue = options.queue ?? 'solo';
    const role = options.role ?? 'ALL';
    const sourceTier = options.sourceTier ?? 'challenger';
    const playerLimit = Math.min(30, normalizeCount(options.playerLimit ?? 12, 12));
    const matchesPerPlayer = Math.min(12, normalizeCount(options.matchesPerPlayer ?? 6, 6));
    const championMatchLimit = Math.min(80, normalizeCount(options.championMatchLimit ?? 32, 32));
    const key = cacheKey(
      'champion-builds',
      region,
      String(championId),
      queue,
      role,
      sourceTier,
      String(playerLimit),
      String(matchesPerPlayer),
      String(championMatchLimit)
    );
    const cached = await cacheRepository.get<ChampionBuildsResponse>(key);
    if (cached) return cached;

    const players = await this.getEliteLeaguePlayers(region, queue, sourceTier, playerLimit);
    const playerMatchIds = await mapWithConcurrency(players, 3, async (player) => {
      try {
        return await this.getMatchHistory(region, player.puuid, matchesPerPlayer, queue);
      } catch (error) {
        if (shouldStopBatchForRiotError(error)) throw error;
        return [];
      }
    });

    const matchIds = [...new Set(playerMatchIds.flat())];
    const rawMatches = await mapWithConcurrency(matchIds, matchDetailConcurrency, async (matchId) => {
      try {
        return { matchId, match: await this.getRawMatch(region, matchId) };
      } catch (error) {
        if (shouldStopBatchForRiotError(error)) throw error;
        return null;
      }
    });

    const rankedMatches = rawMatches.filter((entry): entry is { matchId: string; match: RiotMatchResponse } =>
      Boolean(entry && entry.match.info.queueId === rankedQueueIds[queue])
    );

    const matchingParticipants = rankedMatches
      .flatMap((entry) =>
        (entry.match.info.participants ?? [])
          .filter((participant) => {
            if (participant.championId !== championId) return false;
            const participantRole = normalizeRole(participant.teamPosition || participant.individualPosition, participant.lane);
            return role === 'ALL' || participantRole === role;
          })
          .map((participant) => ({ ...entry, participant }))
      )
      .sort((a, b) => b.match.info.gameCreation - a.match.info.gameCreation)
      .slice(0, championMatchLimit);

    const samples = await mapWithConcurrency(matchingParticipants, 3, async ({ matchId, match, participant }) => {
      let timeline: RiotMatchTimelineResponse = { info: { frames: [] } };

      try {
        timeline = await this.getMatchTimeline(region, matchId);
      } catch (error) {
        if (shouldStopBatchForRiotError(error)) throw error;
        timeline = { info: { frames: [] } };
      }

      const gameMinutes = Math.max(1, match.info.gameDuration / 60);
      const minions = participant.totalMinionsKilled + participant.neutralMinionsKilled;
      const teamKills = (match.info.participants ?? [])
        .filter((item) => item.teamId === participant.teamId)
        .reduce((total, item) => total + item.kills, 0);
      const participantRole = normalizeRole(participant.teamPosition || participant.individualPosition, participant.lane);
      const { perkStyleIds, perkIds } = this.getParticipantPerks(participant);
      const { purchases, abilityOrder } = this.getParticipantTimelineData(timeline, participant.participantId);

      const sample: ChampionBuildSample = {
        region,
        matchId,
        puuid: participant.puuid,
        gameName: participant.riotIdGameName || participant.summonerName || 'Elite player',
        tagLine: participant.riotIdTagline || '',
        role: participantRole,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        csPerMinute: Number((minions / gameMinutes).toFixed(2)),
        damageToChampions: participant.totalDamageDealtToChampions,
        goldEarned: participant.goldEarned,
        killParticipation: Number(
          ((participant.challenges?.killParticipation ?? (teamKills === 0 ? 0 : (participant.kills + participant.assists) / teamKills)) * 100).toFixed(1)
        ),
        itemIds: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5].filter(Boolean),
        summonerSpellIds: [participant.summoner1Id ?? 0, participant.summoner2Id ?? 0].filter(Boolean),
        perkStyleIds,
        perkIds,
        abilityOrder,
        purchases,
        gameDurationSeconds: match.info.gameDuration,
        gameCreation: match.info.gameCreation
      };

      return sample;
    });

    const games = samples.length;
    const wins = samples.filter((sample) => sample.win).length;
    const losses = games - wins;
    const itemBlocks: ChampionItemBlock[] = [
      getItemBlock('starter', samples, (sample) => sample.purchases.filter((item) => (item.timestampSeconds ?? 0) <= 240), 6),
      getItemBlock(
        'early',
        samples,
        (sample) => sample.purchases.filter((item) => (item.timestampSeconds ?? 0) > 240 && (item.timestampSeconds ?? 0) <= 900),
        8
      ),
      getItemBlock(
        'core',
        samples,
        (sample) => {
          const byItem = new Map(sample.purchases.map((item) => [item.itemId, item.timestampSeconds]));
          return sample.itemIds.slice(0, 3).map((itemId) => ({ itemId, timestampSeconds: byItem.get(itemId) }));
        },
        6
      ),
      getItemBlock(
        'full',
        samples,
        (sample) => sample.itemIds.map((itemId) => ({ itemId })),
        8
      )
    ];

    const response: ChampionBuildsResponse = {
      source: 'riot-league-v4-match-v5-timeline',
      sourceTier,
      region,
      queue,
      role,
      championId,
      generatedAt: new Date().toISOString(),
      requested: {
        regions: [region],
        playerLimit,
        matchesPerPlayer,
        championMatchLimit
      },
      sample: {
        playersScanned: players.length,
        totalMatchesScanned: rankedMatches.length,
        championMatches: games,
        regionBreakdown: [
          {
            region,
            playersScanned: players.length,
            totalMatchesScanned: rankedMatches.length,
            championMatches: games,
            winRate: percentage(wins, games),
            pickRate: percentage(games, rankedMatches.length)
          }
        ]
      },
      summary: {
        games,
        wins,
        losses,
        winRate: percentage(wins, games),
        pickRate: percentage(games, rankedMatches.length),
        avgKda: round(average(samples.map(getKda)), 2),
        avgCs: round(average(samples.map((sample) => sample.csPerMinute)), 2),
        avgDamage: round(average(samples.map((sample) => sample.damageToChampions))),
        avgGold: round(average(samples.map((sample) => sample.goldEarned))),
        avgKillParticipation: round(average(samples.map((sample) => sample.killParticipation)))
      },
      variants: getGlobalBuildVariants(samples),
      itemBlocks,
      runePages: getRunePages(samples),
      spellPairs: getSpellPairs(samples),
      abilityOrders: getAbilityOrders(samples),
      topPlayers: getTopPlayers(samples),
      recentMatches: samples
        .sort((a, b) => b.gameCreation - a.gameCreation)
        .slice(0, 10)
        .map((sample): ChampionRecentBuildMatch => ({
          matchId: sample.matchId,
          puuid: sample.puuid,
          gameName: sample.gameName,
          tagLine: sample.tagLine,
          region: sample.region,
          role: sample.role,
          win: sample.win,
          kills: sample.kills,
          deaths: sample.deaths,
          assists: sample.assists,
          itemIds: sample.itemIds,
          summonerSpellIds: sample.summonerSpellIds,
          perkIds: sample.perkIds,
          abilityOrder: sample.abilityOrder,
          gameCreation: sample.gameCreation,
          gameDurationSeconds: sample.gameDurationSeconds
        }))
    };

    await cacheRepository.set(key, response, 300);
    return response;
  }

  async getGlobalChampionBuilds(championId: number, options: GlobalChampionBuildOptions = {}): Promise<ChampionBuildsResponse> {
    const queue = options.queue ?? 'solo';
    const role = options.role ?? 'ALL';
    const sourceTier = options.sourceTier ?? 'challenger';
    const regions = options.regions?.length ? [...new Set(options.regions)] : globalBuildRegions;
    const playerLimit = Math.min(12, normalizeCount(options.playerLimit ?? 5, 5));
    const matchesPerPlayer = Math.min(8, normalizeCount(options.matchesPerPlayer ?? 4, 4));
    const championMatchLimit = Math.min(40, normalizeCount(options.championMatchLimit ?? 14, 14));
    const regionCount = Math.max(1, regions.length);
    const perRegionPlayerLimit = Math.max(2, Math.min(playerLimit, Math.ceil(playerLimit / Math.min(regionCount, 3))));
    const perRegionChampionMatchLimit = Math.max(2, Math.ceil(championMatchLimit / regionCount));
    const key = cacheKey(
      'champion-builds-global',
      String(championId),
      queue,
      role,
      sourceTier,
      regions.join(','),
      String(perRegionPlayerLimit),
      String(matchesPerPlayer),
      String(championMatchLimit)
    );
    const cached = await cacheRepository.get<ChampionBuildsResponse>(key);
    if (cached) return cached;

    const regionResponses = await mapWithConcurrency(regions, 2, async (region) => {
      try {
        return await this.getChampionBuilds(region, championId, {
          queue,
          role,
          sourceTier,
          playerLimit: perRegionPlayerLimit,
          matchesPerPlayer,
          championMatchLimit: perRegionChampionMatchLimit
        });
      } catch (error) {
        if (shouldStopBatchForRiotError(error)) throw error;
        return null;
      }
    });

    const responses = regionResponses.filter((response): response is ChampionBuildsResponse => Boolean(response));
    const games = responses.reduce((total, response) => total + response.summary.games, 0);
    const wins = responses.reduce((total, response) => total + response.summary.wins, 0);
    const losses = games - wins;
    const playersScanned = responses.reduce((total, response) => total + response.sample.playersScanned, 0);
    const totalMatchesScanned = responses.reduce((total, response) => total + response.sample.totalMatchesScanned, 0);
    const regionBreakdown = responses
      .map((response) => ({
        region: response.requested.regions[0],
        playersScanned: response.sample.playersScanned,
        totalMatchesScanned: response.sample.totalMatchesScanned,
        championMatches: response.sample.championMatches,
        winRate: response.summary.winRate,
        pickRate: response.summary.pickRate
      }))
      .sort((a, b) => b.championMatches - a.championMatches || b.winRate - a.winRate);

    const response: ChampionBuildsResponse = {
      source: 'riot-league-v4-match-v5-timeline',
      sourceTier,
      region: 'global',
      queue,
      role,
      championId,
      generatedAt: new Date().toISOString(),
      requested: {
        regions,
        playerLimit: perRegionPlayerLimit,
        matchesPerPlayer,
        championMatchLimit
      },
      sample: {
        playersScanned,
        totalMatchesScanned,
        championMatches: games,
        regionBreakdown
      },
      summary: {
        games,
        wins,
        losses,
        winRate: percentage(wins, games),
        pickRate: percentage(games, totalMatchesScanned),
        avgKda: round(
          weightedAverageByGames(responses.map((item) => ({ value: item.summary.avgKda, games: item.summary.games }))),
          2
        ),
        avgCs: round(weightedAverageByGames(responses.map((item) => ({ value: item.summary.avgCs, games: item.summary.games }))), 2),
        avgDamage: round(weightedAverageByGames(responses.map((item) => ({ value: item.summary.avgDamage, games: item.summary.games })))),
        avgGold: round(weightedAverageByGames(responses.map((item) => ({ value: item.summary.avgGold, games: item.summary.games })))),
        avgKillParticipation: round(
          weightedAverageByGames(responses.map((item) => ({ value: item.summary.avgKillParticipation, games: item.summary.games })))
        )
      },
      variants: mergeVariants(responses, games),
      itemBlocks: mergeItemBlocks(responses, games),
      runePages: mergeRunePages(responses, games),
      spellPairs: mergeSpellPairs(responses, games),
      abilityOrders: mergeAbilityOrders(responses, games),
      topPlayers: responses
        .flatMap((item) => item.topPlayers)
        .sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, 12),
      recentMatches: responses
        .flatMap((item) => item.recentMatches)
        .sort((a, b) => b.gameCreation - a.gameCreation)
        .slice(0, 16)
    };

    await cacheRepository.set(key, response, 300);
    return response;
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

    const match = await this.getRawMatch(region, matchId);
    const participants = match.info.participants ?? [];
    const participant = puuid ? participants.find((item) => item.puuid === puuid) : participants[0];

    if (!participant) {
      throw new AppError('No encontramos al jugador dentro de esta partida', 422, 'INVALID_MATCH_PLAYER');
    }

    const { perkStyleIds, perkIds } = this.getParticipantPerks(participant);
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
      perkStyleIds,
      perkIds,
      abilityOrder: [],
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
