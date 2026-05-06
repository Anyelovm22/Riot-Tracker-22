export type PlatformRegion = 'na1' | 'euw1' | 'eun1' | 'kr' | 'br1' | 'la1' | 'la2' | 'oc1' | 'jp1' | 'tr1' | 'ru';
export type RankedQueueKey = 'solo' | 'flex';
export type ChampionRole = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'UNKNOWN';
export type ChampionTier = 'S+' | 'S' | 'A' | 'B' | 'C';

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
  championId: number;
  queueId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  controlWardsPlaced: number;
  goldEarned: number;
  goldPerMinute: number;
  damageToChampions: number;
  damagePerMinute: number;
  killParticipation: number;
  teamPosition: string;
  lane: string;
  champLevel: number;
  itemIds: number[];
  summonerSpellIds: number[];
  objectiveTakedowns: number;
  totalTimeSpentDead: number;
  gameDurationSeconds: number;
  gameCreation: number;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

export interface ChampionBuildVariant {
  name: string;
  itemIds: number[];
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
  note: string;
}

export interface ChampionBuildStats {
  championId: number;
  championName: string;
  role: ChampionRole;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  pickRate: number;
  avgKda: number;
  avgCs: number;
  avgVision: number;
  avgDamage: number;
  avgGold: number;
  avgKillParticipation: number;
  avgObjectives: number;
  score: number;
  confidence: number;
  tier: ChampionTier;
  itemIds: number[];
  coreItemIds: number[];
  situationalItemIds: number[];
  summonerSpellIds: number[];
  variants: ChampionBuildVariant[];
  lastPlayedAt: number;
}

export interface ChampionTierRow {
  championId: number;
  championName: string;
  role: ChampionRole;
  tier: ChampionTier;
  score: number;
  confidence: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  pickRate: number;
  avgKda: number;
  avgCs: number;
  avgVision: number;
  coreItemIds: number[];
  lastPlayedAt: number;
}

export interface ChampionInsightsResponse {
  source: 'riot-match-v5';
  queue: RankedQueueKey;
  count: number;
  totalMatches: number;
  generatedAt: string;
  builds: ChampionBuildStats[];
  tierList: ChampionTierRow[];
}
