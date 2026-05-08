export interface SummonerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
}

export type RankedQueueKey = 'solo' | 'flex';
export type ChampionRole = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'UNKNOWN';
export type ChampionTier = 'S+' | 'S' | 'A' | 'B' | 'C';
export type EliteLeagueTier = 'challenger' | 'grandmaster' | 'master';

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
  perkStyleIds: number[];
  perkIds: number[];
  abilityOrder: number[];
  objectiveTakedowns: number;
  totalTimeSpentDead: number;
  gameDurationSeconds: number;
  gameCreation: number;
}

export interface RankedEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
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

export interface ChampionGlobalBuildVariant {
  id: string;
  name: string;
  itemIds: number[];
  games: number;
  wins: number;
  winRate: number;
  pickRate: number;
  avgKda: number;
  popularity: number;
}

export interface ChampionItemTiming {
  itemId: number;
  games: number;
  wins: number;
  pickRate: number;
  winRate: number;
  avgTimestampSeconds: number;
}

export interface ChampionItemBlock {
  label: 'starter' | 'early' | 'core' | 'full';
  items: ChampionItemTiming[];
}

export interface ChampionRunePage {
  id: string;
  primaryStyleId: number;
  subStyleId: number;
  perkIds: number[];
  games: number;
  wins: number;
  pickRate: number;
  winRate: number;
}

export interface ChampionSpellPair {
  spellIds: number[];
  games: number;
  wins: number;
  pickRate: number;
  winRate: number;
}

export interface ChampionAbilityOrder {
  sequence: number[];
  games: number;
  wins: number;
  pickRate: number;
  winRate: number;
}

export interface ChampionElitePlayerBuild {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  role: ChampionRole;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
  lastPlayedAt: number;
  itemIds: number[];
  summonerSpellIds: number[];
  perkIds: number[];
  matchIds: string[];
}

export interface ChampionRecentBuildMatch {
  matchId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  role: ChampionRole;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  itemIds: number[];
  summonerSpellIds: number[];
  perkIds: number[];
  abilityOrder: number[];
  gameCreation: number;
  gameDurationSeconds: number;
}

export interface ChampionBuildsResponse {
  source: 'riot-league-v4-match-v5-timeline';
  sourceTier: EliteLeagueTier;
  region: string | 'global';
  queue: RankedQueueKey;
  role: ChampionRole | 'ALL';
  championId: number;
  generatedAt: string;
  requested: {
    regions: string[];
    playerLimit: number;
    matchesPerPlayer: number;
    championMatchLimit: number;
  };
  sample: {
    playersScanned: number;
    totalMatchesScanned: number;
    championMatches: number;
    regionBreakdown: Array<{
      region: string;
      playersScanned: number;
      totalMatchesScanned: number;
      championMatches: number;
      winRate: number;
      pickRate: number;
    }>;
  };
  summary: {
    games: number;
    wins: number;
    losses: number;
    winRate: number;
    pickRate: number;
    avgKda: number;
    avgCs: number;
    avgDamage: number;
    avgGold: number;
    avgKillParticipation: number;
  };
  variants: ChampionGlobalBuildVariant[];
  itemBlocks: ChampionItemBlock[];
  runePages: ChampionRunePage[];
  spellPairs: ChampionSpellPair[];
  abilityOrders: ChampionAbilityOrder[];
  topPlayers: ChampionElitePlayerBuild[];
  recentMatches: ChampionRecentBuildMatch[];
}
