import { apiClient } from './apiClient';
import { MatchOverview, PlayerSummary } from '../types/api';

export const riotApi = {
  async getSummary(region: string, gameName: string, tagLine: string) {
    const { data } = await apiClient.get<PlayerSummary>(`/riot/summary/${region}/${gameName}/${tagLine}`);
    return data;
  },

  async getHistory(region: string, puuid: string, count = 10) {
    const { data } = await apiClient.get<string[]>(`/riot/history/${region}/${puuid}`, { params: { count } });
    return data;
  },

  async getMatch(region: string, matchId: string) {
    const { data } = await apiClient.get<MatchOverview>(`/riot/match/${region}/${matchId}`);
    return data;
  },

  async getLive(region: string, puuid: string) {
    const { data } = await apiClient.get(`/riot/live/${region}/${puuid}`);
    return data as Record<string, unknown> | null;
  }
};
