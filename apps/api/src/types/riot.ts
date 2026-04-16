export type PlatformRegion = 'na1' | 'euw1' | 'eun1' | 'kr' | 'br1' | 'la1' | 'la2' | 'oc1' | 'jp1' | 'tr1' | 'ru';

export interface SummonerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface RankedEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface PlayerSummary {
  puuid: string;
  profile: SummonerProfile;
  ranked: RankedEntry[];
  masteryTop: ChampionMastery[];
  insights: {
    winRate: number;
    avgKda: number;
    avgCsMin: number;
    visionPerGame: number;
  };
}

export interface MatchOverview {
  matchId: string;
  championName: string;
  queueId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number;
  visionScore: number;
  gameDurationSeconds: number;
  gameCreation: number;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}
