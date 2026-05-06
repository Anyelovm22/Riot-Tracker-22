import { MatchOverview, PlayerSummary } from '../types/api';

export interface SkillScore {
  key: string;
  label: string;
  value: number;
  detail: string;
}

export interface Challenge {
  id: string;
  skill: string;
  title: string;
  target: string;
  progress: number;
  total: number;
  met: boolean;
}

export interface PlayerAnalytics {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKda: number;
  avgCs: number;
  avgVision: number;
  avgDeaths: number;
  avgGold: number;
  avgDamage: number;
  avgKillParticipation: number;
  avgObjectives: number;
  gpi: SkillScore[];
  feedback: string[];
  challenges: Challenge[];
  bestMatch?: MatchOverview;
  latestMatch?: MatchOverview;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const deviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = average(values);
  return Math.sqrt(average(values.map((value) => (value - avg) ** 2)));
};

const scoreText = (value: number) => {
  if (value >= 80) return 'Fuerte';
  if (value >= 62) return 'Estable';
  if (value >= 45) return 'Mejorable';
  return 'Prioridad';
};

export const buildAnalytics = (summary?: PlayerSummary, matches: MatchOverview[] = []): PlayerAnalytics => {
  const games = matches.length;
  const wins = matches.filter((match) => match.win).length;
  const losses = games - wins;
  const winRate = games ? (wins / games) * 100 : summary?.insights.winRate ?? 0;
  const avgCs = games ? average(matches.map((match) => match.csPerMinute)) : summary?.insights.avgCsMin ?? 0;
  const avgVision = games ? average(matches.map((match) => match.visionScore)) : summary?.insights.visionPerGame ?? 0;
  const avgKda = games ? average(matches.map((match) => (match.kills + match.assists) / Math.max(1, match.deaths))) : summary?.insights.avgKda ?? 0;
  const avgDeaths = average(matches.map((match) => match.deaths));
  const avgGold = average(matches.map((match) => match.goldEarned));
  const avgDamage = average(matches.map((match) => match.damageToChampions));
  const avgKillParticipation = average(matches.map((match) => match.killParticipation));
  const avgObjectives = average(matches.map((match) => match.objectiveTakedowns));
  const consistencySeed = [
    deviation(matches.map((match) => match.csPerMinute)) * 8,
    deviation(matches.map((match) => match.deaths)) * 12,
    deviation(matches.map((match) => (match.kills + match.assists) / Math.max(1, match.deaths))) * 7
  ];

  const gpi: SkillScore[] = [
    {
      key: 'farming',
      label: 'Farming',
      value: Math.round(clamp((avgCs / 8.2) * 100)),
      detail: `${avgCs.toFixed(1)} CS/min`
    },
    {
      key: 'vision',
      label: 'Vision',
      value: Math.round(clamp((avgVision / 36) * 100)),
      detail: `${avgVision.toFixed(1)} vision/partida`
    },
    {
      key: 'fighting',
      label: 'Fighting',
      value: Math.round(clamp((avgKda / 4.2) * 100)),
      detail: `${avgKda.toFixed(2)} KDA`
    },
    {
      key: 'survivability',
      label: 'Survivability',
      value: Math.round(clamp(100 - avgDeaths * 13)),
      detail: `${avgDeaths.toFixed(1)} muertes/partida`
    },
    {
      key: 'objectives',
      label: 'Objectives',
      value: Math.round(clamp(avgObjectives * 28 + avgKillParticipation * 0.42)),
      detail: `${avgObjectives.toFixed(1)} derribos/objetivos`
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: Math.round(clamp(100 - average(consistencySeed))),
      detail: `${scoreText(clamp(100 - average(consistencySeed)))}`
    }
  ];

  const weakest = [...gpi].sort((a, b) => a.value - b.value)[0];
  const strongest = [...gpi].sort((a, b) => b.value - a.value)[0];
  const latestMatch = matches[0];
  const bestMatch = [...matches].sort((a, b) => {
    const scoreA = (a.kills + a.assists) * 2 + a.csPerMinute * 4 + a.visionScore + a.objectiveTakedowns * 8 - a.deaths * 5;
    const scoreB = (b.kills + b.assists) * 2 + b.csPerMinute * 4 + b.visionScore + b.objectiveTakedowns * 8 - b.deaths * 5;
    return scoreB - scoreA;
  })[0];

  const feedback = games
    ? [
        `${strongest.label} es tu punto mas solido ahora mismo: ${strongest.detail}.`,
        `${weakest.label} pide atencion: ${weakest.detail}.`,
        avgDeaths > 6
          ? 'Tu supervivencia esta costando tempo; revisa las muertes antes de objetivos.'
          : 'Tu numero de muertes esta controlado para seguir jugando el mapa.',
        avgVision < 20
          ? 'Tu vision reciente esta baja; prioriza wards antes de dragon/heraldo.'
          : 'Tu vision reciente esta sosteniendo buenas ventanas de informacion.',
        avgCs < 6
          ? 'Hay oro gratis en oleadas: un reto de CS te daria impacto rapido.'
          : 'Tu ritmo de farmeo esta en un rango util para escalar.'
      ]
    : ['Busca un jugador para generar feedback con partidas reales.'];

  const recentFive = matches.slice(0, 5);
  const challengeTotal = Math.max(5, recentFive.length);
  const challengeData: Challenge[] = [
    {
      id: 'farm-10',
      skill: 'Farming',
      title: 'Mantener ritmo de oro',
      target: '6.5+ CS/min en 3 de 5 partidas',
      progress: recentFive.filter((match) => match.csPerMinute >= 6.5).length,
      total: challengeTotal,
      met: recentFive.filter((match) => match.csPerMinute >= 6.5).length >= 3
    },
    {
      id: 'vision-dragon',
      skill: 'Vision',
      title: 'Preparar objetivos',
      target: '20+ vision score en 3 de 5 partidas',
      progress: recentFive.filter((match) => match.visionScore >= 20).length,
      total: challengeTotal,
      met: recentFive.filter((match) => match.visionScore >= 20).length >= 3
    },
    {
      id: 'death-review',
      skill: 'Survivability',
      title: 'Cortar muertes caras',
      target: '5 o menos muertes en 3 de 5 partidas',
      progress: recentFive.filter((match) => match.deaths <= 5).length,
      total: challengeTotal,
      met: recentFive.filter((match) => match.deaths <= 5).length >= 3
    },
    {
      id: 'fight-presence',
      skill: 'Fighting',
      title: 'Llegar a las peleas',
      target: '55%+ KP en 3 de 5 partidas',
      progress: recentFive.filter((match) => match.killParticipation >= 55).length,
      total: challengeTotal,
      met: recentFive.filter((match) => match.killParticipation >= 55).length >= 3
    }
  ];

  return {
    games,
    wins,
    losses,
    winRate,
    avgKda,
    avgCs,
    avgVision,
    avgDeaths,
    avgGold,
    avgDamage,
    avgKillParticipation,
    avgObjectives,
    gpi,
    feedback,
    challenges: challengeData,
    bestMatch,
    latestMatch
  };
};
