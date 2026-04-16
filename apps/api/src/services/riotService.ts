import { env } from '../config/env.js';
import { riotClient } from '../clients/riotClient.js';
import { cacheRepository } from '../repositories/cacheRepository.js';
import { ChampionMastery, MatchOverview, PlatformRegion, PlayerSummary, RankedEntry, SummonerProfile } from '../types/riot.js';
import { getRegionalRouting } from '../utils/region.js';
import { AppError } from '../utils/errors.js';

const cacheKey = (...parts: string[]) => `riot:${parts.join(':')}`;

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

    const summoner = await riotClient.get<{ id: string }>(`${this.getPlatformBase(region)}/lol/summoner/v4/summoners/by-puuid/${puuid}`);
    const ranked = await riotClient.get<RankedEntry[]>(`${this.getPlatformBase(region)}/lol/league/v4/entries/by-summoner/${summoner.id}`);
    await cacheRepository.set(key, ranked, this.defaultTtl);
    return ranked;
  }

  async getMatchHistory(region: PlatformRegion, puuid: string, count = 10): Promise<string[]> {
    const key = cacheKey('history', region, puuid, String(count));
    const cached = await cacheRepository.get<string[]>(key);
    if (cached) return cached;

    const ids = await riotClient.get<string[]>(`${this.getRegionalBase(region)}/lol/match/v5/matches/by-puuid/${puuid}/ids`, { count, start: 0 });
    await cacheRepository.set(key, ids, 90);
    return ids;
  }

  async getMatch(region: PlatformRegion, matchId: string): Promise<MatchOverview> {
    const key = cacheKey('match', region, matchId);
    const cached = await cacheRepository.get<MatchOverview>(key);
    if (cached) return cached;

    const match = await riotClient.get<any>(`${this.getRegionalBase(region)}/lol/match/v5/matches/${matchId}`);
    const firstParticipant = match.info.participants?.[0];

    if (!firstParticipant) {
      throw new AppError('Match sin participantes', 422, 'INVALID_MATCH');
    }

    const overview: MatchOverview = {
      matchId,
      championName: firstParticipant.championName,
      queueId: match.info.queueId,
      win: firstParticipant.win,
      kills: firstParticipant.kills,
      deaths: firstParticipant.deaths,
      assists: firstParticipant.assists,
      csPerMinute: Number(((firstParticipant.totalMinionsKilled + firstParticipant.neutralMinionsKilled) / (match.info.gameDuration / 60)).toFixed(2)),
      visionScore: firstParticipant.visionScore,
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

    const summoner = await riotClient.get<{ id: string }>(`${this.getPlatformBase(region)}/lol/summoner/v4/summoners/by-puuid/${puuid}`);

    try {
      const live = await riotClient.get<Record<string, unknown>>(
        `${this.getPlatformBase(region)}/lol/spectator/v5/active-games/by-summoner/${summoner.id}`
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

    const summoner = await riotClient.get<{ id: string }>(`${this.getPlatformBase(region)}/lol/summoner/v4/summoners/by-puuid/${puuid}`);
    const mastery = await riotClient.get<ChampionMastery[]>(
      `${this.getPlatformBase(region)}/lol/champion-mastery/v4/champion-masteries/by-summoner/${summoner.id}/top`,
      { count }
    );

    await cacheRepository.set(key, mastery, this.defaultTtl);
    return mastery;
  }

  async getPlayerSummary(region: PlatformRegion, gameName: string, tagLine: string): Promise<PlayerSummary> {
    const profile = await this.getProfile(region, gameName, tagLine);
    const [ranked, mastery, matchIds] = await Promise.all([
      this.getRanked(region, profile.puuid),
      this.getChampionMastery(region, profile.puuid, 5),
      this.getMatchHistory(region, profile.puuid, 5)
    ]);

    const matches = await Promise.all(matchIds.map((id) => this.getMatch(region, id)));

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
