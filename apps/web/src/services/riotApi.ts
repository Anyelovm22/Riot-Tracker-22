import { apiClient } from './apiClient';
import { ChampionInsightsResponse, MatchOverview, PlayerSummary, RankedQueueKey } from '../types/api';

export const riotApi = {
  async getSummary(region: string, gameName: string, tagLine: string) {
    const safeGameName = encodeURIComponent(gameName);
    const safeTagLine = encodeURIComponent(tagLine);
    const { data } = await apiClient.get<PlayerSummary>(`/riot/summary/${region}/${safeGameName}/${safeTagLine}`);
    return data;
  },

  async getHistory(region: string, puuid: string, count = 10, queue?: RankedQueueKey) {
    const { data } = await apiClient.get<string[]>(`/riot/history/${region}/${puuid}`, { params: { count, queue } });
    return data;
  },

  async getRankedMatches(region: string, puuid: string, queue: RankedQueueKey, count = 100) {
    const { data } = await apiClient.get<MatchOverview[]>(`/riot/ranked-matches/${region}/${puuid}`, { params: { queue, count } });
    return data;
  },

  async getChampionInsights(region: string, puuid: string, queue: RankedQueueKey, count = 80) {
    const { data } = await apiClient.get<ChampionInsightsResponse>(`/riot/champion-insights/${region}/${puuid}`, {
      params: { queue, count }
    });
    return data;
  },

  async getMatch(region: string, matchId: string, puuid?: string) {
    const { data } = await apiClient.get<MatchOverview>(`/riot/match/${region}/${matchId}`, { params: { puuid } });
    return data;
  },

  async getLive(region: string, puuid: string) {
    const { data } = await apiClient.get(`/riot/live/${region}/${puuid}`);
    return data as Record<string, unknown> | null;
  }
};
