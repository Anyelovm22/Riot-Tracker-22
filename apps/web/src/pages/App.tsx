import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { MetricCard } from '../components/MetricCard';
import { Skeleton } from '../components/Skeleton';
import { ChampionBuildLab } from '../features/builds/ChampionBuildLab';
import { MatchHistoryTable } from '../features/match/MatchHistoryTable';
import { ChampionMasteryList } from '../features/player/ChampionMasteryList';
import { LpFlowChart } from '../features/player/LpFlowChart';
import { ProfileHeader } from '../features/player/ProfileHeader';
import { RankedTable } from '../features/player/RankedTable';
import { SearchBar } from '../features/player/SearchBar';
import { MainLayout } from '../layouts/MainLayout';
import {
  ChampionCatalogMap,
  ItemCatalogMap,
  SummonerSpellCatalogMap,
  championIconUrl,
  getChampionCatalog,
  getItemCatalog,
  getLatestDataDragonVersion,
  getSummonerSpellCatalog,
  itemIconUrl,
  summonerSpellIconUrl
} from '../services/dataDragon';
import { riotApi } from '../services/riotApi';
import type { AiCoachRecommendationsResponse, AiCoachRequest, ChampionBuildStats, ChampionInsightsResponse, ChampionRole, MatchOverview, PlayerSummary, RankedEntry, RankedQueueKey } from '../types/api';
import { Challenge, PlayerAnalytics, SkillScore, buildAnalytics } from '../utils/playerAnalytics';

interface SearchState {
  region: string;
  gameName: string;
  tagLine: string;
}

type ViewKey = 'profile' | 'live' | 'builds' | 'tier' | 'challenges' | 'guides';
type TierMode = 'score' | 'winRate' | 'sample';

const navItems: { key: ViewKey; label: string }[] = [
  { key: 'profile', label: 'Perfil' },
  { key: 'live', label: 'Live' },
  { key: 'builds', label: 'Builds' },
  { key: 'tier', label: 'Tier list' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'guides', label: 'Guides' }
];

const rankedMatchFetchCount = 70;
const insightMatchFetchCount = 140;

const rankedQueueOptions: { key: RankedQueueKey; label: string; shortLabel: string }[] = [
  { key: 'solo', label: 'Solo/Duo', shortLabel: 'SoloQ' },
  { key: 'flex', label: 'Flex 5v5', shortLabel: 'Flex' }
];

const rankedQueueTypes: Record<RankedQueueKey, string> = {
  solo: 'RANKED_SOLO_5x5',
  flex: 'RANKED_FLEX_SR'
};

const roleLabels: Record<ChampionRole, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungla',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Soporte',
  UNKNOWN: 'Sin rol'
};

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

const roleOrder: ChampionRole[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'UNKNOWN'];
const formatNumber = (value: number) => new Intl.NumberFormat('es').format(Math.round(value));
const formatDecimal = (value: number, digits = 1) => value.toFixed(digits);
const buildKey = (build: Pick<ChampionBuildStats, 'championId' | 'role'>) => `${build.championId}:${build.role}`;

const normalizeRole = (teamPosition?: string, lane?: string): ChampionRole =>
  roleAliases[teamPosition?.toUpperCase() ?? ''] ?? roleAliases[lane?.toUpperCase() ?? ''] ?? 'UNKNOWN';

const shortQueue = (queueId: number) => {
  if (queueId === 420) return 'Ranked Solo/Duo';
  if (queueId === 440) return 'Ranked Flex';
  if (queueId === 450) return 'ARAM';
  if (queueId === 400 || queueId === 430) return 'Normal';
  return `Queue ${queueId}`;
};

const getChampion = (catalog: ChampionCatalogMap | undefined, championId: number, fallbackKey: string) => ({
  key: catalog?.[championId]?.id ?? fallbackKey,
  name: catalog?.[championId]?.name ?? fallbackKey
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const TabButton = ({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'rounded-md border px-3 py-2 text-sm font-semibold transition',
      active
        ? 'border-teal-300 bg-teal-300 text-zinc-950 shadow-sm shadow-teal-900/40'
        : 'border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900 hover:text-white'
    )}
  >
    {children}
  </button>
);

const Select = ({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 rounded-md border border-zinc-800 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition focus:border-teal-400"
    >
      {options.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ProgressBar = ({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'emerald' | 'amber' | 'rose' }) => (
  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
    <div
      className={clsx(
        'h-full rounded-full transition-all',
        tone === 'teal' && 'bg-teal-300',
        tone === 'emerald' && 'bg-emerald-400',
        tone === 'amber' && 'bg-amber-400',
        tone === 'rose' && 'bg-rose-400'
      )}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={clsx('rounded-lg border border-zinc-800/90 bg-zinc-950/80 p-4 shadow-xl shadow-black/20 backdrop-blur', className)}>{children}</section>
);

const SectionHeading = ({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) => (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{title}</h3>
      {caption && <p className="mt-1 text-sm text-zinc-500">{caption}</p>}
    </div>
    {action}
  </div>
);

const Metric = ({ label, value, tone = 'zinc' }: { label: string; value: string; tone?: 'teal' | 'emerald' | 'amber' | 'rose' | 'zinc' }) => (
  <div className="rounded-md border border-zinc-800 bg-black/25 p-3">
    <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    <p
      className={clsx(
        'mt-1 text-xl font-bold',
        tone === 'teal' && 'text-teal-200',
        tone === 'emerald' && 'text-emerald-300',
        tone === 'amber' && 'text-amber-300',
        tone === 'rose' && 'text-rose-300',
        tone === 'zinc' && 'text-white'
      )}
    >
      {value}
    </p>
  </div>
);

const ChampionAvatar = ({ championKey, name, version, className }: { championKey: string; name: string; version?: string; className?: string }) => (
  <div className={clsx('relative grid place-items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900', className)}>
    <img
      src={championIconUrl(version, championKey)}
      alt=""
      className="h-full w-full object-cover"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
        event.currentTarget.nextElementSibling?.classList.remove('hidden');
        event.currentTarget.nextElementSibling?.classList.add('grid');
      }}
    />
    <span className="absolute inset-0 hidden place-items-center bg-zinc-900 text-xs font-bold text-zinc-400">{initials(name)}</span>
  </div>
);

const ItemStrip = ({
  itemIds,
  version,
  itemCatalog,
  size = 'md'
}: {
  itemIds: number[];
  version?: string;
  itemCatalog?: ItemCatalogMap;
  size?: 'sm' | 'md' | 'lg';
}) => {
  if (itemIds.length === 0) {
    return <span className="text-sm text-zinc-500">Sin items suficientes en la muestra.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {itemIds.map((itemId, index) => (
        <div key={`${itemId}-${index}`} className="group relative">
          <img
            src={itemIconUrl(version, itemId)}
            alt=""
            className={clsx(
              'rounded-md border border-zinc-800 bg-zinc-900 object-cover',
              size === 'sm' && 'h-7 w-7',
              size === 'md' && 'h-10 w-10',
              size === 'lg' && 'h-12 w-12'
            )}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-52 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 shadow-xl group-hover:block">
            {itemCatalog?.[itemId]?.name ?? `Item ${itemId}`}
          </div>
        </div>
      ))}
    </div>
  );
};

const SkillBars = ({ scores }: { scores: SkillScore[] }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {scores.map((score) => (
      <div key={score.key} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-white">{score.label}</p>
            <p className="text-xs text-zinc-500">{score.detail}</p>
          </div>
          <span className="text-lg font-bold text-zinc-100">{score.value}</span>
        </div>
        <ProgressBar value={score.value} tone={score.value >= 75 ? 'emerald' : score.value >= 55 ? 'teal' : score.value >= 40 ? 'amber' : 'rose'} />
      </div>
    ))}
  </div>
);

const ProfileDashboard = ({
  analytics,
  matches,
  version,
  championCatalog
}: {
  analytics: PlayerAnalytics;
  matches: MatchOverview[];
  version?: string;
  championCatalog?: ChampionCatalogMap;
}) => {
  const bestChampion = analytics.bestMatch ? getChampion(championCatalog, analytics.bestMatch.championId, analytics.bestMatch.championName) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <Panel>
        <SectionHeading title="GPI" caption={`${analytics.games} partidas clasificatorias procesadas`} />
        <SkillBars scores={analytics.gpi} />
      </Panel>

      <Panel>
        <SectionHeading
          title="Post-game feedback"
          caption={`${analytics.wins}W / ${analytics.losses}L desde la cola activa`}
          action={<span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">{formatDecimal(analytics.winRate)}% WR</span>}
        />
        <div className="space-y-3">
          {analytics.feedback.map((item) => (
            <div key={item} className="rounded-md border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-200">
              {item}
            </div>
          ))}
        </div>
        {analytics.bestMatch && bestChampion && (
          <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Mejor partida reciente</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ChampionAvatar championKey={bestChampion.key} name={bestChampion.name} version={version} className="h-12 w-12" />
                <div>
                  <p className="font-semibold text-white">{bestChampion.name}</p>
                  <p className="text-xs text-zinc-400">
                    {analytics.bestMatch.kills}/{analytics.bestMatch.deaths}/{analytics.bestMatch.assists} KDA, {analytics.bestMatch.csPerMinute.toFixed(1)} CS/min
                  </p>
                </div>
              </div>
              <span className={analytics.bestMatch.win ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                {analytics.bestMatch.win ? 'Win' : 'Loss'}
              </span>
            </div>
          </div>
        )}
        {matches.length === 0 && <p className="mt-4 text-sm text-zinc-500">No hay partidas cargadas para generar comparaciones.</p>}
      </Panel>
    </div>
  );
};

const BuildPanel = ({
  insights,
  isLoading,
  hasPlayer,
  version,
  championCatalog,
  itemCatalog
}: {
  insights?: ChampionInsightsResponse;
  isLoading: boolean;
  hasPlayer: boolean;
  version?: string;
  championCatalog?: ChampionCatalogMap;
  itemCatalog?: ItemCatalogMap;
}) => {
  const builds = useMemo(() => insights?.builds ?? [], [insights?.builds]);
  const [selectedBuildKey, setSelectedBuildKey] = useState('');
  const [variantName, setVariantName] = useState('');

  useEffect(() => {
    if (builds.length === 0) {
      setSelectedBuildKey('');
      return;
    }

    if (!builds.some((build) => buildKey(build) === selectedBuildKey)) {
      setSelectedBuildKey(buildKey(builds[0]));
    }
  }, [builds, selectedBuildKey]);

  const selectedBuild = builds.find((build) => buildKey(build) === selectedBuildKey) ?? builds[0];

  useEffect(() => {
    setVariantName(selectedBuild?.variants[0]?.name ?? '');
  }, [selectedBuildKey, selectedBuild?.variants]);

  if (!hasPlayer) {
    return <EmptyState title="Busca un jugador para cargar builds reales" description="Las builds se generan desde partidas clasificatorias de Riot Match-V5." />;
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!selectedBuild) {
    return <EmptyState title="Sin builds suficientes" description="No hay partidas clasificatorias recientes para agrupar builds en esta cola." />;
  }

  const champion = getChampion(championCatalog, selectedBuild.championId, selectedBuild.championName);
  const activeVariant = selectedBuild.variants.find((variant) => variant.name === variantName) ?? selectedBuild.variants[0];
  const selectedItems = activeVariant?.itemIds.length ? activeVariant.itemIds : selectedBuild.itemIds;
  const options = builds.map((build) => {
    const optionChampion = getChampion(championCatalog, build.championId, build.championName);
    return {
      value: buildKey(build),
      label: `${optionChampion.name} - ${roleLabels[build.role]} (${build.games} partidas)`
    };
  });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <Select label="Campeon y rol" value={buildKey(selectedBuild)} onChange={setSelectedBuildKey} options={options} />
          <Metric label="Fuente" value={insights?.source === 'riot-match-v5' ? 'Riot API' : 'API'} tone="teal" />
          <Metric label="Muestra" value={`${insights?.totalMatches ?? 0}/${insights?.count ?? 0}`} />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <Panel>
          <div className="flex items-center gap-4">
            <ChampionAvatar championKey={champion.key} name={champion.name} version={version} className="h-20 w-20" />
            <div>
              <h2 className="text-2xl font-bold text-white">{champion.name}</h2>
              <p className="text-sm text-zinc-400">
                {roleLabels[selectedBuild.role]} · Tier {selectedBuild.tier} · {formatDecimal(selectedBuild.confidence)}% confianza
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="Win" value={`${formatDecimal(selectedBuild.winRate)}%`} tone={selectedBuild.winRate >= 52 ? 'emerald' : selectedBuild.winRate >= 48 ? 'teal' : 'rose'} />
            <Metric label="Pick" value={`${formatDecimal(selectedBuild.pickRate)}%`} tone="teal" />
            <Metric label="Score" value={`${formatDecimal(selectedBuild.score)}`} tone="amber" />
          </div>
          <div className="mt-4 space-y-3">
            <ProgressBar value={selectedBuild.confidence} tone={selectedBuild.confidence >= 65 ? 'emerald' : selectedBuild.confidence >= 40 ? 'amber' : 'rose'} />
            <p className="text-sm text-zinc-400">
              Calculado con {selectedBuild.games} partidas reales: {selectedBuild.wins}W / {selectedBuild.losses}L, {formatDecimal(selectedBuild.avgKda, 2)} KDA,{' '}
              {formatDecimal(selectedBuild.avgCs, 2)} CS/min.
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="Build observada" caption="Items finales agrupados desde partidas reales del jugador." />
          {selectedBuild.variants.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedBuild.variants.map((variant) => (
                <TabButton active={(activeVariant?.name ?? '') === variant.name} key={variant.name} onClick={() => setVariantName(variant.name)}>
                  {variant.name}
                </TabButton>
              ))}
            </div>
          )}
          {activeVariant && <p className="mb-3 text-sm text-zinc-400">{activeVariant.note}</p>}
          <ItemStrip itemIds={selectedItems} version={version} itemCatalog={itemCatalog} size="lg" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoBlock title="Core frecuente">
              <ItemStrip itemIds={selectedBuild.coreItemIds} version={version} itemCatalog={itemCatalog} />
            </InfoBlock>
            <InfoBlock title="Situacionales">
              <ItemStrip itemIds={selectedBuild.situationalItemIds} version={version} itemCatalog={itemCatalog} />
            </InfoBlock>
            <InfoBlock title="Rendimiento">
              <div className="grid gap-2 text-sm text-zinc-300">
                <span>{formatNumber(selectedBuild.avgDamage)} daño promedio</span>
                <span>{formatNumber(selectedBuild.avgGold)} oro promedio</span>
                <span>{formatDecimal(selectedBuild.avgKillParticipation)}% kill participation</span>
              </div>
            </InfoBlock>
            <InfoBlock title="Hechizos detectados">
              <div className="flex flex-wrap gap-2">
                {selectedBuild.summonerSpellIds.length ? (
                  selectedBuild.summonerSpellIds.map((spellId) => (
                    <span key={spellId} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200">
                      ID {spellId}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500">Sin datos suficientes.</span>
                )}
              </div>
            </InfoBlock>
          </div>
        </Panel>
      </section>
    </div>
  );
};

const InfoBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
    {children}
  </div>
);

void BuildPanel;

const tierClass = (tier: string) =>
  clsx(
    'rounded-md px-2 py-1 font-bold',
    tier === 'S+' && 'bg-emerald-500/10 text-emerald-300',
    tier === 'S' && 'bg-teal-500/10 text-teal-300',
    tier === 'A' && 'bg-amber-500/10 text-amber-300',
    tier === 'B' && 'bg-zinc-700/60 text-zinc-200',
    tier === 'C' && 'bg-rose-500/10 text-rose-300'
  );

const TierPanel = ({
  insights,
  isLoading,
  hasPlayer,
  version,
  championCatalog,
  itemCatalog
}: {
  insights?: ChampionInsightsResponse;
  isLoading: boolean;
  hasPlayer: boolean;
  version?: string;
  championCatalog?: ChampionCatalogMap;
  itemCatalog?: ItemCatalogMap;
}) => {
  const [mode, setMode] = useState<TierMode>('score');
  const [role, setRole] = useState<ChampionRole | 'ALL'>('ALL');
  const [selectedChampionKey, setSelectedChampionKey] = useState<string>('');
  const [expandedChampionKey, setExpandedChampionKey] = useState<string>('');
  const rows = insights?.tierList ?? [];
  const availableRoles = [...new Set(rows.map((row) => row.role))]
    .sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b))
    .map((value) => ({ value, label: roleLabels[value] }));
  const filteredRows = rows
    .filter((row) => role === 'ALL' || row.role === role)
    .sort((a, b) => {
      if (mode === 'winRate') return b.winRate - a.winRate || b.games - a.games;
      if (mode === 'sample') return b.games - a.games || b.score - a.score;
      return b.score - a.score || b.confidence - a.confidence;
    });
  const selectedRow = filteredRows.find((row) => `${row.championId}-${row.role}` === selectedChampionKey) ?? filteredRows[0];
  const selectedBuild = insights?.builds.find((build) => build.championId === selectedRow?.championId && build.role === selectedRow?.role);
  const selectedChampion = selectedRow ? getChampion(championCatalog, selectedRow.championId, selectedRow.championName) : undefined;
  const expandedRow = filteredRows.find((row) => `${row.championId}-${row.role}` === expandedChampionKey);
  const expandedChampion = expandedRow ? getChampion(championCatalog, expandedRow.championId, expandedRow.championName) : undefined;
  const rolePool = expandedRow ? filteredRows.filter((row) => row.role === expandedRow.role) : [];
  const roleAverages = rolePool.length
    ? {
        winRate: rolePool.reduce((sum, row) => sum + row.winRate, 0) / rolePool.length,
        score: rolePool.reduce((sum, row) => sum + row.score, 0) / rolePool.length,
        confidence: rolePool.reduce((sum, row) => sum + row.confidence, 0) / rolePool.length,
        pickRate: rolePool.reduce((sum, row) => sum + row.pickRate, 0) / rolePool.length
      }
    : null;
  const roleBuilds = (insights?.builds ?? []).filter((build) => selectedRow && build.role === selectedRow.role);
  const roleBuildAverages = roleBuilds.length
    ? {
        avgDamage: roleBuilds.reduce((sum, build) => sum + build.avgDamage, 0) / roleBuilds.length,
        avgVision: roleBuilds.reduce((sum, build) => sum + build.avgVision, 0) / roleBuilds.length,
        avgGold: roleBuilds.reduce((sum, build) => sum + build.avgGold, 0) / roleBuilds.length,
        avgCs: roleBuilds.reduce((sum, build) => sum + build.avgCs, 0) / roleBuilds.length,
        avgKillParticipation: roleBuilds.reduce((sum, build) => sum + build.avgKillParticipation, 0) / roleBuilds.length
      }
    : null;

  if (!hasPlayer) {
    return <EmptyState title="Busca un jugador para generar tier list" description="El ranking se calcula con campeones jugados en clasificatoria, no con datos inventados." />;
  }

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (rows.length === 0) {
    return <EmptyState title="Sin tier list para esta cola" description="No encontramos partidas recientes suficientes para rankear campeones." />;
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton active={mode === 'score'} onClick={() => setMode('score')}>
              Score
            </TabButton>
            <TabButton active={mode === 'winRate'} onClick={() => setMode('winRate')}>
              Win rate
            </TabButton>
            <TabButton active={mode === 'sample'} onClick={() => setMode('sample')}>
              Muestra
            </TabButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_auto]">
            <Select label="Rol" value={role} onChange={(value) => setRole(value as ChampionRole | 'ALL')} options={[{ value: 'ALL', label: 'Todos' }, ...availableRoles]} />
            <Metric label="Partidas API" value={`${insights?.totalMatches ?? 0}`} tone="teal" />
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeading title="Tier list personal" caption={`Fuente ${insights?.source ?? 'api'} · ${insights?.queue ?? 'ranked'} · ${insights?.count ?? 0} partidas solicitadas`} />
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(200px,1fr)_auto]">
          <Select
            label="Campeon a desglosar"
            value={selectedRow ? `${selectedRow.championId}-${selectedRow.role}` : ''}
            onChange={setSelectedChampionKey}
            options={filteredRows.map((row) => ({ value: `${row.championId}-${row.role}`, label: `${row.championName} · ${roleLabels[row.role]}` }))}
          />
          <Metric label="Rol foco" value={role === 'ALL' ? 'General' : roleLabels[role]} tone="teal" />
        </div>
        {selectedRow && selectedChampion && (
          <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
            <div className="mb-3 flex items-center gap-3">
              <ChampionAvatar championKey={selectedChampion.key} name={selectedChampion.name} version={version} className="h-12 w-12" />
              <div>
                <p className="font-semibold text-white">{selectedChampion.name} · {roleLabels[selectedRow.role]}</p>
                <p className="text-xs text-zinc-300">Feedback enfocado: datos reales de tus rankeds, sin inflar resultados.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Win rate ({formatDecimal(selectedRow.winRate)}%)</p>
                <ProgressBar value={selectedRow.winRate} tone={selectedRow.winRate >= 53 ? 'emerald' : selectedRow.winRate >= 50 ? 'teal' : 'rose'} />
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Confianza ({formatDecimal(selectedRow.confidence)}%)</p>
                <ProgressBar value={selectedRow.confidence} tone={selectedRow.confidence >= 70 ? 'emerald' : selectedRow.confidence >= 55 ? 'amber' : 'rose'} />
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Score ({formatDecimal(selectedRow.score)})</p>
                <ProgressBar value={Math.min(100, selectedRow.score)} tone={selectedRow.score >= 65 ? 'teal' : 'amber'} />
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Pick rate ({formatDecimal(selectedRow.pickRate)}%)</p>
                <ProgressBar value={selectedRow.pickRate} tone="teal" />
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-200">
              {selectedRow.tier === 'S+' || selectedRow.tier === 'S'
                ? `Sí es pick para subir: tu muestra marca ${formatDecimal(selectedRow.winRate)}% WR en ${selectedRow.games} partidas.`
                : selectedRow.tier === 'A'
                  ? `Es viable pero exige ejecución: buen score (${formatDecimal(selectedRow.score)}) con margen de error moderado.`
                  : `Sé sincero contigo: hoy no es pick estable para rankeds (${formatDecimal(selectedRow.winRate)}% WR).`}
            </p>
            {selectedBuild && roleBuildAverages && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Damage ({formatDecimal(selectedBuild.avgDamage, 0)})</p>
                  <ProgressBar value={(selectedBuild.avgDamage / Math.max(1, roleBuildAverages.avgDamage)) * 100} tone={selectedBuild.avgDamage >= roleBuildAverages.avgDamage ? 'emerald' : 'rose'} />
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Vision ({formatDecimal(selectedBuild.avgVision, 1)})</p>
                  <ProgressBar value={(selectedBuild.avgVision / Math.max(1, roleBuildAverages.avgVision)) * 100} tone={selectedBuild.avgVision >= roleBuildAverages.avgVision ? 'emerald' : 'amber'} />
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Oro/min ({formatDecimal(selectedBuild.avgGold, 0)})</p>
                  <ProgressBar value={(selectedBuild.avgGold / Math.max(1, roleBuildAverages.avgGold)) * 100} tone={selectedBuild.avgGold >= roleBuildAverages.avgGold ? 'teal' : 'rose'} />
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">CS/min ({formatDecimal(selectedBuild.avgCs, 2)})</p>
                  <ProgressBar value={(selectedBuild.avgCs / Math.max(1, roleBuildAverages.avgCs)) * 100} tone={selectedBuild.avgCs >= roleBuildAverages.avgCs ? 'teal' : 'amber'} />
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">KP ({formatDecimal(selectedBuild.avgKillParticipation, 1)}%)</p>
                  <ProgressBar value={(selectedBuild.avgKillParticipation / Math.max(1, roleBuildAverages.avgKillParticipation)) * 100} tone={selectedBuild.avgKillParticipation >= roleBuildAverages.avgKillParticipation ? 'emerald' : 'rose'} />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2">Rank</th>
                <th>Campeon</th>
                <th>Rol</th>
                <th>Tier</th>
                <th>Score</th>
                <th>Win</th>
                <th>Pick</th>
                <th>Partidas</th>
                <th>Core</th>
                <th>Feedback IA</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const champion = getChampion(championCatalog, row.championId, row.championName);
                return (
                  <tr
                    key={`${row.championId}-${row.role}`}
                    className="cursor-pointer border-b border-zinc-900 text-zinc-200 transition hover:bg-zinc-900/35"
                    onClick={() => setExpandedChampionKey(`${row.championId}-${row.role}`)}
                  >
                    <td className="py-2 font-semibold text-zinc-400">#{index + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ChampionAvatar championKey={champion.key} name={champion.name} version={version} className="h-9 w-9" />
                        <div>
                          <p className="font-semibold text-white">{champion.name}</p>
                          <p className="text-xs text-zinc-500">{formatDecimal(row.confidence)}% confianza</p>
                        </div>
                      </div>
                    </td>
                    <td>{roleLabels[row.role]}</td>
                    <td>
                      <span className={tierClass(row.tier)}>{row.tier}</span>
                    </td>
                    <td>{formatDecimal(row.score)}</td>
                    <td>{formatDecimal(row.winRate)}%</td>
                    <td>{formatDecimal(row.pickRate)}%</td>
                    <td>{row.games}</td>
                    <td>
                      <ItemStrip itemIds={row.coreItemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                    </td>
                    <td className="text-xs text-zinc-300">{row.tier === "S+" || row.tier === "S" ? `Si quieres LP estable, sí conviene: ${formatDecimal(row.winRate)}% WR y ${row.games} partidas reales.` : row.tier === "A" ? `Es jugable, pero no gratis: el pick funciona solo si mantienes ${formatDecimal(row.confidence)}% de confianza.` : `No conviene spamearlo ahora: ${formatDecimal(row.winRate)}% WR en ${row.games} partidas no sostiene rankeds.`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {expandedRow && expandedChampion && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-indigo-500/35 bg-[#0a1027] p-5 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-center justify-between">
              <SectionHeading title={`Deep dive · ${expandedChampion.name}`} caption={`Rol ${roleLabels[expandedRow.role]} · Tier ${expandedRow.tier} · ${expandedRow.games} partidas`} />
              <button type="button" onClick={() => setExpandedChampionKey('')} className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">
                Cerrar
              </button>
            </div>
            {roleAverages && (
              <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-cyan-200">Comparativa contra tu pool del mismo rol</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Win rate</p>
                    <ProgressBar value={(expandedRow.winRate / Math.max(1, roleAverages.winRate)) * 100} tone={expandedRow.winRate >= roleAverages.winRate ? 'emerald' : 'rose'} />
                    <p className="mt-1 text-xs text-zinc-400">{formatDecimal(expandedRow.winRate)}% vs {formatDecimal(roleAverages.winRate)}%</p>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Score</p>
                    <ProgressBar value={(expandedRow.score / Math.max(1, roleAverages.score)) * 100} tone={expandedRow.score >= roleAverages.score ? 'teal' : 'amber'} />
                    <p className="mt-1 text-xs text-zinc-400">{formatDecimal(expandedRow.score)} vs {formatDecimal(roleAverages.score)}</p>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Confianza</p>
                    <ProgressBar value={(expandedRow.confidence / Math.max(1, roleAverages.confidence)) * 100} tone={expandedRow.confidence >= roleAverages.confidence ? 'emerald' : 'amber'} />
                    <p className="mt-1 text-xs text-zinc-400">{formatDecimal(expandedRow.confidence)}% vs {formatDecimal(roleAverages.confidence)}%</p>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Pick rate</p>
                    <ProgressBar value={(expandedRow.pickRate / Math.max(1, roleAverages.pickRate)) * 100} tone="teal" />
                    <p className="mt-1 text-xs text-zinc-400">{formatDecimal(expandedRow.pickRate)}% vs {formatDecimal(roleAverages.pickRate)}%</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              {(() => {
                const actions = championActionPlan(expandedRow, expandedChampion.name, roleAverages ? { winRate: roleAverages.winRate, confidence: roleAverages.confidence } : undefined);
                return (
                  <>
              <div className="rounded-lg border border-zinc-800 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Pros (tu data)</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-200">
                  <li>Win rate de {formatDecimal(expandedRow.winRate)}% en muestra real.</li>
                  <li>Confianza de {formatDecimal(expandedRow.confidence)}% para este pick/rol.</li>
                  <li>Pick rate personal {formatDecimal(expandedRow.pickRate)}% en ranked.</li>
                </ul>
                <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">Defectos / riesgo</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
                  <li>{expandedRow.games < 8 ? 'Muestra baja: las conclusiones aún pueden variar bastante.' : 'Muestra sólida: ya refleja patrón estable de rendimiento.'}</li>
                  <li>{expandedRow.winRate < 50 ? 'Pierdes más de lo que ganas con este pick actualmente.' : 'Resultado positivo, pero depende de mantener ejecución constante.'}</li>
                  <li>{expandedRow.confidence < 60 ? 'Confianza baja: pick sensible a errores de macro/tempo.' : 'Confianza aceptable: margen para forzar ventajas de línea/objetivo.'}</li>
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Recomendación y build base</p>
                <p className="mt-3 text-sm leading-6 text-zinc-200">
                  {expandedRow.tier === 'S+' || expandedRow.tier === 'S'
                    ? 'Recomendado para rankeds ahora mismo: pick consistente para jugar en serie.'
                    : expandedRow.tier === 'A'
                      ? 'Pick situacionalmente fuerte: úsalo cuando tengas matchup y plan claro.'
                      : 'No recomendado para subir LP en este momento; mejor úsalo en práctica o dodge spots malos.'}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-200">Hacer</p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                      {actions.doItems.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-rose-200">Evitar</p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                      {actions.avoidItems.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Core items más frecuentes</p>
                  <ItemStrip itemIds={expandedRow.coreItemIds} version={version} itemCatalog={itemCatalog} />
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const aiSourceLabel = (recommendations?: AiCoachRecommendationsResponse) => {
  if (!recommendations) return 'Coach IA';
  if (recommendations.source === 'openai') return `OpenAI - ${recommendations.model}`;
  if (recommendations.source === 'gemini') return `Gemini - ${recommendations.model}`;
  return 'Reglas locales';
};

const CoachInsightPanel = ({
  recommendations,
  isLoading,
  error,
  dominantRole
}: {
  recommendations?: AiCoachRecommendationsResponse;
  isLoading: boolean;
  error?: string;
  dominantRole: ChampionRole;
}) => (
  <Panel className="border-sky-500/25 bg-sky-950/10">
    <SectionHeading
      title="Coach IA"
      caption={`${aiSourceLabel(recommendations)} - rol foco: ${roleLabels[dominantRole]}`}
      action={
        <span className={clsx('rounded-md px-2 py-1 text-xs font-bold', recommendations?.source === 'rules' ? 'bg-amber-500/10 text-amber-200' : 'bg-sky-500/10 text-sky-200')}>
          {isLoading ? 'Generando' : recommendations?.source === 'rules' ? 'Fallback' : 'Personalizado'}
        </span>
      }
    />
    {isLoading && <p className="text-sm text-sky-100">Leyendo metricas, rol dominante y partidas recientes para ajustar recomendaciones.</p>}
    {!isLoading && error && <p className="text-sm text-amber-200">{error}</p>}
    {!isLoading && recommendations && (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-zinc-200">{recommendations.summary}</p>
        <div className="grid gap-2 md:grid-cols-3">
          {recommendations.rolePlan.slice(0, 3).map((item) => (
            <div key={item} className="rounded-md border border-sky-500/15 bg-black/25 px-3 py-2 text-sm text-zinc-300">
              {item}
            </div>
          ))}
        </div>
        {recommendations.notice && <p className="text-xs text-zinc-500">{recommendations.notice}</p>}
      </div>
    )}
  </Panel>
);

type RenderGuide = GuidePlan | AiCoachRecommendationsResponse['guides'][number];

const getGuideWhy = (guide: RenderGuide) => ('why' in guide && typeof guide.why === 'string' ? guide.why : '');

const ChallengePanel = ({
  analytics,
  selectedId,
  onSelect,
  recommendations,
  isAiLoading,
  aiError,
  dominantRole
}: {
  analytics: PlayerAnalytics;
  selectedId: string;
  onSelect: (id: string) => void;
  recommendations?: AiCoachRecommendationsResponse;
  isAiLoading: boolean;
  aiError?: string;
  dominantRole: ChampionRole;
}) => {
  if (analytics.games === 0) {
    return <EmptyState title="Busca un jugador para generar challenges" description="Los retos se ajustan a tus últimas partidas clasificatorias." />;
  }

  const completed = analytics.challenges.filter((challenge) => challenge.met).length;
  const roleFocusedChallenges = analytics.challenges.filter((challenge) => {
    if (dominantRole === 'JUNGLE') return /objetivo|vision|muerte/i.test(challenge.title + challenge.target);
    if (dominantRole === 'SUPPORT') return /vision|control|asistencia/i.test(challenge.title + challenge.target);
    if (dominantRole === 'ADC') return /farm|cs|minuto|daño/i.test(challenge.title + challenge.target);
    return true;
  });
  const challengePool = roleFocusedChallenges.length ? roleFocusedChallenges : analytics.challenges;
  const selected = challengePool.find((challenge) => challenge.id === selectedId) ?? challengePool[0];
  const aiChallenges = recommendations?.challenges ?? [];
  const selectedAiChallenge = aiChallenges.find((challenge) => challenge.id === selected.id || challenge.skill === selected.skill) ?? aiChallenges[0];

  return (
    <div className="space-y-4">
      <CoachInsightPanel recommendations={recommendations} isLoading={isAiLoading} error={aiError} dominantRole={dominantRole} />
      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <Panel>
          <SectionHeading title="Retos sugeridos" caption={`${completed}/${analytics.challenges.length} completados · foco ${roleLabels[dominantRole]}`} />
          <div className="space-y-2">
            {challengePool.map((challenge) => (
              <button
                type="button"
                key={challenge.id}
                onClick={() => onSelect(challenge.id)}
                className={clsx(
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition',
                  selected.id === challenge.id ? 'border-teal-300 bg-teal-300/10 text-white' : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-600'
                )}
              >
                <span className="block font-semibold">{challenge.title}</span>
                <span className="text-xs text-zinc-500">{challenge.skill}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionHeading title={selected.title} caption={selected.target} />
          <div className="mb-4 rounded-lg border border-zinc-800 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-200">{selected.skill}</span>
              <span className={selected.met ? 'rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300' : 'rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300'}>
                {selected.progress}/{selected.total}
              </span>
            </div>
            <ProgressBar value={(selected.progress / Math.max(1, selected.total)) * 100} tone={selected.met ? 'emerald' : 'amber'} />
          </div>
          {selectedAiChallenge && (
            <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Recomendacion IA</p>
                  <p className="mt-1 font-semibold text-white">{selectedAiChallenge.title}</p>
                </div>
                {selectedAiChallenge.progressLabel && <span className="rounded-md bg-black/30 px-2 py-1 text-xs font-semibold text-sky-100">{selectedAiChallenge.progressLabel}</span>}
              </div>
              {selectedAiChallenge.why && <p className="text-sm leading-6 text-zinc-300">{selectedAiChallenge.why}</p>}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {selectedAiChallenge.checkpoints.slice(0, 3).map((checkpoint) => (
                  <div key={checkpoint} className="rounded-md border border-sky-500/15 bg-black/25 px-3 py-2 text-sm text-zinc-300">
                    {checkpoint}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {challengePool.map((challenge) => (
              <ChallengeCard challenge={challenge} active={selected.id === challenge.id} key={challenge.id} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const ChallengeCard = ({ challenge, active }: { challenge: Challenge; active: boolean }) => (
  <div className={clsx('rounded-lg border p-4', active ? 'border-teal-300 bg-teal-300/10' : 'border-zinc-800 bg-black/20')}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold text-white">{challenge.title}</p>
        <p className="text-sm text-zinc-400">{challenge.target}</p>
      </div>
      <span className={challenge.met ? 'rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300' : 'rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300'}>
        {challenge.progress}/{challenge.total}
      </span>
    </div>
    <ProgressBar value={(challenge.progress / Math.max(1, challenge.total)) * 100} tone={challenge.met ? 'emerald' : 'amber'} />
  </div>
);

const getLiveParticipants = (live?: Record<string, unknown> | null) => {
  const rawParticipants = live?.participants;
  if (!Array.isArray(rawParticipants)) return [];
  return rawParticipants.map((participant) => {
    const item = participant as Record<string, unknown>;
    return {
      summonerName: String(item.summonerName ?? item.riotId ?? 'Jugador'),
      championId: Number(item.championId ?? 0),
      teamId: Number(item.teamId ?? 0)
    };
  });
};

const LivePanel = ({
  live,
  matches,
  version,
  championCatalog
}: {
  live?: Record<string, unknown> | null;
  matches: MatchOverview[];
  version?: string;
  championCatalog?: ChampionCatalogMap;
}) => {
  const participants = getLiveParticipants(live);
  const latest = matches[0];
  const latestChampion = latest ? getChampion(championCatalog, latest.championId, latest.championName) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel>
        <SectionHeading
          title="Live Companion"
          caption="Scouting desde Spectator API cuando el jugador está en partida."
          action={
            <span className={participants.length ? 'rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300' : 'rounded-md bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-400'}>
              {participants.length ? 'Activa' : 'Sin partida'}
            </span>
          }
        />
        {participants.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {participants.map((player) => {
              const champion = championCatalog?.[player.championId];
              return (
                <div key={`${player.teamId}-${player.summonerName}-${player.championId}`} className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <div className="flex items-center gap-3">
                    {champion ? (
                      <ChampionAvatar championKey={champion.id} name={champion.name} version={version} className="h-10 w-10" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-zinc-800 text-xs text-zinc-400">#{player.championId}</div>
                    )}
                    <div>
                      <p className="font-semibold text-white">{player.summonerName}</p>
                      <p className="text-xs text-zinc-500">
                        Team {player.teamId} · {champion?.name ?? `Champion ${player.championId}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No está en partida en vivo" description="Cuando Riot reporte una partida activa, este panel muestra scouting y equipos." />
        )}
      </Panel>

      <Panel>
        <SectionHeading title="Cheat sheet" caption="Resumen inmediato basado en la partida clasificada más reciente." />
        {latest && latestChampion ? (
          <div className="space-y-3">
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Último campeón</p>
              <p className="mt-1 font-semibold text-white">
                {latestChampion.name} · {shortQueue(latest.queueId)}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Timing reciente</p>
              <p className="mt-1 text-sm text-zinc-300">
                {latest.csPerMinute.toFixed(1)} CS/min · {latest.killParticipation.toFixed(0)}% KP · {latest.visionScore} vision
              </p>
            </div>
            <div className="rounded-md border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-100">
              Prioriza visión antes de objetivos y juega alrededor del spike que más aparece en tu historial reciente.
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Busca un jugador para generar referencias desde sus partidas recientes.</p>
        )}
      </Panel>
    </div>
  );
};

const getEnhancedLiveParticipants = (live?: Record<string, unknown> | null) => {
  const rawParticipants = live?.participants;
  if (!Array.isArray(rawParticipants)) return [];

  return rawParticipants.map((participant) => {
    const item = participant as Record<string, unknown>;
    return {
      puuid: String(item.puuid ?? ''),
      summonerName: String(item.riotId ?? item.summonerName ?? 'Jugador'),
      championId: Number(item.championId ?? 0),
      teamId: Number(item.teamId ?? 0),
      spell1Id: Number(item.spell1Id ?? 0),
      spell2Id: Number(item.spell2Id ?? 0)
    };
  });
};

const getLiveMeta = (live?: Record<string, unknown> | null) => ({
  gameLength: Number(live?.gameLength ?? 0),
  queueLabel: shortQueue(Number(live?.gameQueueConfigId ?? 0)),
  gameMode: String(live?.gameMode ?? 'Live')
});

const formatGameClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${rest}`;
};

const LiveSpellStrip = ({ spellIds, spellCatalog, version }: { spellIds: number[]; spellCatalog?: SummonerSpellCatalogMap; version?: string }) => (
  <div className="flex gap-1.5">
    {spellIds.filter(Boolean).map((spellId) => {
      const spell = spellCatalog?.[spellId];
      return spell ? (
        <img key={spellId} src={summonerSpellIconUrl(version, spell.image)} title={spell.name} alt="" className="h-7 w-7 rounded-md border border-zinc-800 bg-zinc-900" />
      ) : (
        <span key={spellId} className="grid h-7 w-7 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-400">
          {spellId}
        </span>
      );
    })}
  </div>
);

const EnhancedLivePanel = ({
  live,
  matches,
  version,
  championCatalog,
  spellCatalog,
  currentPuuid,
  insights,
  itemCatalog
}: {
  live?: Record<string, unknown> | null;
  matches: MatchOverview[];
  version?: string;
  championCatalog?: ChampionCatalogMap;
  spellCatalog?: SummonerSpellCatalogMap;
  currentPuuid?: string;
  insights?: ChampionInsightsResponse;
  itemCatalog?: ItemCatalogMap;
}) => {
  const participants = getEnhancedLiveParticipants(live);
  const meta = getLiveMeta(live);
  const latest = matches[0];
  const latestChampion = latest ? getChampion(championCatalog, latest.championId, latest.championName) : undefined;
  const currentPlayer = participants.find((player) => player.puuid === currentPuuid);
  const allyTeamId = currentPlayer?.teamId ?? participants[0]?.teamId;
  const enemyTeamId = participants.find((player) => player.teamId !== allyTeamId)?.teamId;
  const teams = [
    { id: allyTeamId ?? 100, label: currentPlayer ? 'Tu equipo' : 'Equipo azul', tone: 'teal' },
    { id: enemyTeamId ?? 200, label: currentPlayer ? 'Rival' : 'Equipo rojo', tone: 'rose' }
  ];
  const enemyPlayers = participants.filter((player) => player.teamId === enemyTeamId);
  const [selectedEnemy, setSelectedEnemy] = useState<string>('team');
  const selectedEnemyPlayer = enemyPlayers.find((player) => `${player.teamId}-${player.summonerName}-${player.championId}` === selectedEnemy);
  const playerAverage = {
    damage: matches.length ? matches.reduce((acc, match) => acc + match.damageToChampions, 0) / matches.length : 0,
    vision: matches.length ? matches.reduce((acc, match) => acc + match.visionScore, 0) / matches.length : 0,
    gold: matches.length ? matches.reduce((acc, match) => acc + match.goldEarned, 0) / matches.length : 0
  };
  const targetTierRow = selectedEnemyPlayer
    ? insights?.tierList.find((row) => row.championId === selectedEnemyPlayer.championId)
    : undefined;
  const liveFeedback = [
    latest.deaths >= 7 ? `Has muerto ${latest.deaths} veces recientemente: baja riesgo antes del min 14.` : `Buen control de muertes (${latest.deaths}) para escalar.`,
    latest.visionScore < playerAverage.vision ? `Tu vision (${latest.visionScore}) está por debajo de tu media (${formatDecimal(playerAverage.vision, 1)}).` : `Vision estable: ${latest.visionScore}, sigue priorizando wards de control.`,
    latest.killParticipation < 55 ? `KP bajo (${latest.killParticipation.toFixed(0)}%): únete antes a objetivos.` : `KP sólido (${latest.killParticipation.toFixed(0)}%): mantén presencia en peleas clave.`
  ];

  if (!participants.length) {
    return (
      <div className="space-y-4">
        <Panel>
          <SectionHeading
            title="Live Companion"
            caption="Scouting desde Spectator API con equipos, hechizos y lectura rapida de partida."
            action={<span className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-400">Sin partida</span>}
          />
          <EmptyState title="No esta en partida en vivo" description="Cuando Riot reporte una partida activa, este panel muestra scouting y equipos." />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeading
          title="Live Companion"
          caption="Scouting desde Spectator API con equipos, hechizos y lectura rapida de partida."
          action={<span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">Activa</span>}
        />
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Tiempo" value={formatGameClock(meta.gameLength)} tone="teal" />
          <Metric label="Modo" value={meta.gameMode} />
          <Metric label="Cola" value={meta.queueLabel.replace('Ranked ', '')} tone="amber" />
          <Metric label="Jugadores" value={`${participants.length}/10`} tone="emerald" />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const teamPlayers = participants.filter((player) => player.teamId === team.id);
            return (
              <Panel key={team.id} className={team.tone === 'teal' ? 'border-teal-500/25' : 'border-rose-500/25'}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{team.label}</h3>
                    <p className="text-sm text-zinc-500">{teamPlayers.length} campeones detectados</p>
                  </div>
                  <span className={team.tone === 'teal' ? 'rounded-md bg-teal-500/10 px-2 py-1 text-xs font-bold text-teal-200' : 'rounded-md bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-200'}>
                    Team {team.id}
                  </span>
                </div>
                <div className="space-y-2">
                  {teamPlayers.map((player) => {
                    const champion = championCatalog?.[player.championId];
                    const isCurrent = player.puuid && player.puuid === currentPuuid;
                    return (
                      <div key={`${player.teamId}-${player.summonerName}-${player.championId}`} className={clsx('rounded-md border bg-black/25 p-3', isCurrent ? 'border-teal-300/70' : 'border-zinc-800')}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {champion ? (
                              <ChampionAvatar championKey={champion.id} name={champion.name} version={version} className="h-12 w-12 shrink-0" />
                            ) : (
                              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-zinc-800 text-xs text-zinc-400">#{player.championId}</div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{player.summonerName}</p>
                              <p className="text-xs text-zinc-500">{champion?.name ?? `Champion ${player.championId}`}</p>
                            </div>
                          </div>
                          <LiveSpellStrip spellIds={[player.spell1Id, player.spell2Id]} spellCatalog={spellCatalog} version={version} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>

        <div className="space-y-4">
          <Panel>
            <SectionHeading title="Draft snapshot" caption="Lectura de composicion con datos directos de Spectator." />
            <div className="grid gap-3">
              {teams.map((team) => {
                const teamPlayers = participants.filter((player) => player.teamId === team.id);
                return (
                  <div key={`summary-${team.id}`} className="rounded-md border border-zinc-800 bg-black/25 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{team.label}</span>
                      <span className="text-xs text-zinc-500">{teamPlayers.length} picks</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {teamPlayers.map((player) => {
                        const champion = championCatalog?.[player.championId];
                        return champion ? (
                          <ChampionAvatar key={`${team.id}-${player.puuid}-${player.championId}`} championKey={champion.id} name={champion.name} version={version} className="h-10 w-10" />
                        ) : (
                          <span key={`${team.id}-${player.puuid}-${player.championId}`} className="grid h-10 w-10 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-xs text-zinc-500">
                            {player.championId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <SectionHeading title="Cheat sheet" caption="Comparativa de rendimiento y plan anti-build en tiempo real." />
            {latest && latestChampion ? (
              <div className="space-y-3">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Objetivo enemigo
                  <select
                    value={selectedEnemy}
                    onChange={(event) => setSelectedEnemy(event.target.value)}
                    className="min-h-10 rounded-md border border-zinc-800 bg-black/35 px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none transition focus:border-teal-400"
                  >
                    <option value="team">Team enemigo completo</option>
                    {enemyPlayers.map((player) => {
                      const key = `${player.teamId}-${player.summonerName}-${player.championId}`;
                      const champion = championCatalog?.[player.championId];
                      return (
                        <option key={key} value={key}>{player.summonerName} · {champion?.name ?? `Champ ${player.championId}`}</option>
                      );
                    })}
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="Daño" value={`${formatNumber(latest.damageToChampions)} / ${formatNumber(playerAverage.damage)}`} tone={latest.damageToChampions >= playerAverage.damage ? 'emerald' : 'amber'} />
                  <Metric label="Vision" value={`${latest.visionScore} / ${formatDecimal(playerAverage.vision, 1)}`} tone={latest.visionScore >= playerAverage.vision ? 'emerald' : 'amber'} />
                  <Metric label="Oro" value={`${formatNumber(latest.goldEarned)} / ${formatNumber(playerAverage.gold)}`} tone={latest.goldEarned >= playerAverage.gold ? 'emerald' : 'amber'} />
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Ultimo campeon</p>
                  <p className="mt-1 font-semibold text-white">
                    {latestChampion.name} - {shortQueue(latest.queueId)}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Timing reciente</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {latest.csPerMinute.toFixed(1)} CS/min - {latest.killParticipation.toFixed(0)}% KP - {latest.visionScore} vision
                  </p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Plan anti-build</p>
                  {targetTierRow ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-zinc-300">Este pick aparece en tu tier personal como {targetTierRow.tier} con {formatDecimal(targetTierRow.winRate)}% win rate. Responde con estos items base:</p>
                      <ItemStrip itemIds={targetTierRow.coreItemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">Aun no hay muestra suficiente para recomendar anti-items exactos contra ese pick; usa build estandar y prioriza control de vision.</p>
                  )}
                </div>
                <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-sky-100">Feedback live (coach)</p>
                  <div className="mt-2 space-y-2">
                    {liveFeedback.map((note) => (
                      <p key={note} className="text-sm text-zinc-200">• {note}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-100">
                  Prioriza vision antes de objetivos y juega alrededor del spike que mas aparece en tu historial reciente.
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Busca un jugador para generar referencias desde sus partidas recientes.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

void LivePanel;

interface GuidePlan {
  id: string;
  title: string;
  focus: string;
  priority: string;
  minutes: number;
  source: string;
  steps: string[];
}

const MatchReviewPanel = ({
  match,
  championCatalog,
  baseline
}: {
  match?: MatchOverview;
  championCatalog?: ChampionCatalogMap;
  baseline: { damage: number; vision: number; gold: number; kp: number };
}) => {
  if (!match) return null;
  const champion = getChampion(championCatalog, match.championId, match.championName);
  const kda = ((match.kills + match.assists) / Math.max(1, match.deaths)).toFixed(2);
  const notes = [
    match.deaths >= 8 ? 'Moriste demasiado: prioriza tempo, visión lateral y no pelear sin recursos.' : 'Buen control de riesgo en muertes.',
    match.visionScore < 20 ? 'Vision baja para ranked; añade control ward en cada back importante.' : 'Vision aceptable para mantener mapa jugable.',
    match.csPerMinute < 6.5 ? `Farming mejorable (${match.csPerMinute.toFixed(1)} cs/min).` : `Buen ritmo de farm (${match.csPerMinute.toFixed(1)} cs/min).`
  ];
  const comparatives: Array<{ label: string; current: number; avg: number; tone: 'emerald' | 'amber' | 'rose' }> = [
    { label: 'Daño', current: match.damageToChampions, avg: baseline.damage, tone: match.damageToChampions >= baseline.damage ? 'emerald' : 'rose' },
    { label: 'Visión', current: match.visionScore, avg: baseline.vision, tone: match.visionScore >= baseline.vision ? 'emerald' : 'amber' },
    { label: 'Oro', current: match.goldEarned, avg: baseline.gold, tone: match.goldEarned >= baseline.gold ? 'emerald' : 'amber' },
    { label: 'KP', current: match.killParticipation, avg: baseline.kp, tone: match.killParticipation >= baseline.kp ? 'emerald' : 'rose' }
  ];
  const errors = notes.filter((note) => note.includes('demasiado') || note.includes('baja') || note.includes('mejorable'));
  const improvements = notes.filter((note) => !errors.includes(note));
  return (
    <Panel className="border-indigo-500/25 bg-indigo-950/20">
      <SectionHeading title={`Review · ${champion.name}`} caption={`${shortQueue(match.queueId)} · ${match.win ? 'Victoria' : 'Derrota'} · KDA ${kda}`} />
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Daño" value={formatNumber(match.damageToChampions)} tone="teal" />
        <Metric label="Oro" value={formatNumber(match.goldEarned)} tone="amber" />
        <Metric label="Vision" value={`${match.visionScore}`} tone="emerald" />
        <Metric label="KP" value={`${match.killParticipation.toFixed(0)}%`} tone="rose" />
      </div>
      <div className="mt-3 rounded-md border border-zinc-800 bg-black/20 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Comparativa visual vs tu promedio</p>
        <div className="grid gap-2 md:grid-cols-2">
          {comparatives.map((item) => (
            <div key={item.label} className="rounded-md border border-zinc-800 bg-black/25 p-2">
              <p className="text-xs text-zinc-400">{item.label}: {formatDecimal(item.current)} / {formatDecimal(item.avg)}</p>
              <ProgressBar value={(item.current / Math.max(1, item.avg)) * 100} tone={item.tone} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-rose-500/25 bg-rose-950/15 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-200">Errores detectados</p>
          {(errors.length ? errors : ['Sin errores críticos en esta muestra.']).map((note) => <p key={note} className="text-sm text-zinc-200">• {note}</p>)}
        </div>
        <div className="rounded-md border border-emerald-500/25 bg-emerald-950/15 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-200">Mejoras accionables</p>
          {(improvements.length ? improvements : ['Mantén esta línea de ejecución y compárala con tus derrotas.']).map((note) => <p key={note} className="text-sm text-zinc-200">• {note}</p>)}
        </div>
      </div>
    </Panel>
  );
};

const getMostPlayedChampion = (matches: MatchOverview[], championCatalog?: ChampionCatalogMap) => {
  const counts = new Map<number, { championName: string; count: number }>();
  matches.forEach((match) => {
    const current = counts.get(match.championId) ?? { championName: match.championName, count: 0 };
    counts.set(match.championId, { championName: current.championName, count: current.count + 1 });
  });
  const [championId, value] = [...counts.entries()].sort(([, a], [, b]) => b.count - a.count)[0] ?? [];
  if (!championId || !value) return undefined;
  return getChampion(championCatalog, championId, value.championName);
};

const getDominantRole = (matches: MatchOverview[]): ChampionRole => {
  const roleCounts = new Map<ChampionRole, number>();
  matches.forEach((match) => {
    const role = normalizeRole(match.teamPosition, match.lane);
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  });
  return [...roleCounts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'UNKNOWN';
};

const guideSteps = (score: SkillScore, analytics: PlayerAnalytics, role: ChampionRole, championName: string): string[] => {
  if (score.key === 'farming') {
    return [
      `Juega dos oleadas seguidas con foco en last hit antes de buscar trades con ${championName}.`,
      `Meta corta: subir de ${formatDecimal(analytics.avgCs, 1)} a ${(analytics.avgCs + 0.6).toFixed(1)} CS/min.`,
      role === 'JUNGLE' ? 'Revisa el primer clear y elimina caminatas sin campamento u objetivo.' : 'Haz recall cuando la oleada empuje hacia el rival o quede congelable.'
    ];
  }

  if (score.key === 'vision') {
    return [
      `Compra control ward antes del siguiente objetivo neutral.`,
      `Meta corta: pasar de ${formatDecimal(analytics.avgVision, 1)} a ${(analytics.avgVision + 4).toFixed(1)} visión por partida.`,
      role === 'SUPPORT' || role === 'JUNGLE' ? 'Cambia el lente y limpia entradas 45 segundos antes de pelear.' : 'Wardea el flanco que no puedas cubrir con presión de línea.'
    ];
  }

  if (score.key === 'survivability') {
    return [
      `Marca tus dos primeras muertes y etiqueta si fueron por visión, wave o cooldown.`,
      `Meta corta: bajar de ${formatDecimal(analytics.avgDeaths, 1)} a ${Math.max(1, analytics.avgDeaths - 1).toFixed(1)} muertes promedio.`,
      'Evita pelear sin información del jungla rival cuando tu flash esté abajo.'
    ];
  }

  if (score.key === 'objectives') {
    return [
      'Convierte cada push ganado en placa, dragón, heraldo, torre o visión profunda.',
      `Meta corta: subir a ${(analytics.avgObjectives + 0.5).toFixed(1)} derribos/objetivos por partida.`,
      'Sin prioridad de oleada, juega a limpiar visión en vez de forzar el objetivo.'
    ];
  }

  if (score.key === 'consistency') {
    return [
      'Repite el mismo plan de primeros 8 minutos durante tres partidas seguidas.',
      'Reduce picks nuevos hasta estabilizar CS, muertes y KP.',
      'Compara tus partidas ganadas y perdidas con el mismo campeón para aislar el patrón.'
    ];
  }

  return [
    `Busca peleas cuando ${championName} tenga spike de nivel o item.`,
    `Meta corta: sostener ${Math.max(55, analytics.avgKillParticipation + 3).toFixed(0)}% de kill participation.`,
    'No entres primero si no viste la habilidad clave que puede cortar tu daño.'
  ];
};

const buildGuidePlans = (analytics: PlayerAnalytics, matches: MatchOverview[], championCatalog?: ChampionCatalogMap): GuidePlan[] => {
  if (analytics.games === 0) return [];

  const mostPlayedChampion = getMostPlayedChampion(matches, championCatalog);
  const championName = mostPlayedChampion?.name ?? analytics.bestMatch?.championName ?? 'tu campeón principal';
  const dominantRole = getDominantRole(matches);

  return [...analytics.gpi]
    .sort((a, b) => a.value - b.value)
    .slice(0, 4)
    .map((score, index) => ({
      id: `${score.key}-${index}`,
      title: `${score.label}: plan para ${championName}`,
      focus: score.detail,
      priority: score.value < 45 ? 'Alta' : score.value < 62 ? 'Media' : 'Mantenimiento',
      minutes: Math.max(4, Math.round((100 - score.value) / 9)),
      source: `${roleLabels[dominantRole]} - ${analytics.games} partidas`,
      steps: guideSteps(score, analytics, dominantRole, championName)
    }));
};

const championActionPlan = (
  row: { winRate: number; confidence: number; pickRate: number; games: number; tier: string; role: ChampionRole },
  championName: string,
  roleAverage?: { winRate: number; confidence: number }
) => {
  const wrDelta = row.winRate - (roleAverage?.winRate ?? row.winRate);
  const confidenceDelta = row.confidence - (roleAverage?.confidence ?? row.confidence);
  const highSample = row.games >= 12;
  const playStyle = row.pickRate >= 7 ? 'pick principal' : row.pickRate >= 4 ? 'pick situacional' : 'pick de counter';

  const doItems = [
    `Juega ${championName} como ${playStyle} cuando tengas plan de línea para ${roleLabels[row.role]}.`,
    wrDelta >= 0
      ? `Repite tu plan actual: estás ${formatDecimal(Math.abs(wrDelta))}% por encima de tu media del rol.`
      : `Ajusta primeros 10 min: estás ${formatDecimal(Math.abs(wrDelta))}% por debajo de la media del rol.`,
    confidenceDelta >= 0
      ? `Puedes blindearlo con más seguridad (${formatDecimal(row.confidence)}% de confianza).`
      : `Prioriza matchup favorable hasta subir confianza (actual ${formatDecimal(row.confidence)}%).`,
    highSample ? `Muestra sólida (${row.games} games): usa este patrón para escalar LP.` : `Muestra corta (${row.games} games): valida el plan en más rankeds antes de spamear.`
  ];

  const avoidItems = [
    row.tier === 'B' || row.tier === 'C' ? `No forzar ${championName} en first pick cuando el draft rival tenga engage fuerte.` : `No overforce peleas sin visión solo por ir arriba en KDA.`,
    row.winRate < 50 ? `Evita series largas con ${championName} hasta recuperar WR > 50%.` : `Evita cambiar build core cada partida; conserva consistencia.`,
    row.confidence < 55 ? 'No pelear objetivos sin prioridad de líneas o timers de summoners.' : 'No regalar shutdowns: juega setup de visión antes de flankear.'
  ];

  return { doItems, avoidItems };
};

const averageValues = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const getRankedEntryForQueue = (ranked: RankedEntry[], queue: RankedQueueKey) => ranked.find((entry) => entry.queueType === rankedQueueTypes[queue]);

const rankedLabelFromEntry = (entry?: RankedEntry) => {
  if (!entry) return 'Unranked';
  return `${entry.tier} ${entry.rank} - ${entry.leaguePoints} LP`;
};

const buildChampionPoolSnapshot = (matches: MatchOverview[], championCatalog?: ChampionCatalogMap): AiCoachRequest['championPool'] => {
  const groups = new Map<string, MatchOverview[]>();

  matches.forEach((match) => {
    const role = normalizeRole(match.teamPosition, match.lane);
    const key = `${match.championId}:${role}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  });

  return [...groups.values()]
    .sort((a, b) => b.length - a.length || Math.max(...b.map((match) => match.gameCreation)) - Math.max(...a.map((match) => match.gameCreation)))
    .slice(0, 6)
    .map((group) => {
      const first = group[0];
      const champion = getChampion(championCatalog, first.championId, first.championName);
      const wins = group.filter((match) => match.win).length;
      const losses = group.length - wins;

      return {
        championName: champion.name,
        role: normalizeRole(first.teamPosition, first.lane),
        games: group.length,
        wins,
        losses,
        winRate: group.length ? (wins / group.length) * 100 : 0,
        avgKda: averageValues(group.map((match) => (match.kills + match.assists) / Math.max(1, match.deaths))),
        avgCs: averageValues(group.map((match) => match.csPerMinute)),
        avgVision: averageValues(group.map((match) => match.visionScore)),
        avgDeaths: averageValues(group.map((match) => match.deaths)),
        lastPlayedAt: Math.max(...group.map((match) => match.gameCreation))
      };
    });
};

const buildCoachRequest = ({
  search,
  summary,
  analytics,
  matches,
  championCatalog,
  rankedQueue,
  localGuides
}: {
  search: SearchState;
  summary: PlayerSummary;
  analytics: PlayerAnalytics;
  matches: MatchOverview[];
  championCatalog?: ChampionCatalogMap;
  rankedQueue: RankedQueueKey;
  localGuides: GuidePlan[];
}): AiCoachRequest => {
  const rankedEntry = getRankedEntryForQueue(summary.ranked, rankedQueue);
  const queueLabel = rankedQueueOptions.find((option) => option.key === rankedQueue)?.label ?? rankedQueue;

  return {
    player: {
      gameName: summary.profile.gameName,
      tagLine: summary.profile.tagLine,
      region: search.region,
      queue: queueLabel,
      rankedLabel: rankedLabelFromEntry(rankedEntry),
      leaguePoints: rankedEntry?.leaguePoints
    },
    dominantRole: getDominantRole(matches),
    analytics: {
      games: analytics.games,
      wins: analytics.wins,
      losses: analytics.losses,
      winRate: analytics.winRate,
      avgKda: analytics.avgKda,
      avgCs: analytics.avgCs,
      avgVision: analytics.avgVision,
      avgDeaths: analytics.avgDeaths,
      avgGold: analytics.avgGold,
      avgDamage: analytics.avgDamage,
      avgKillParticipation: analytics.avgKillParticipation,
      avgObjectives: analytics.avgObjectives
    },
    gpi: analytics.gpi,
    championPool: buildChampionPoolSnapshot(matches, championCatalog),
    recentMatches: matches.slice(0, 12).map((match) => {
      const champion = getChampion(championCatalog, match.championId, match.championName);
      return {
        championName: champion.name,
        role: normalizeRole(match.teamPosition, match.lane),
        result: match.win ? 'Win' : 'Loss',
        kda: `${match.kills}/${match.deaths}/${match.assists}`,
        csPerMinute: match.csPerMinute,
        visionScore: match.visionScore,
        killParticipation: match.killParticipation,
        objectiveTakedowns: match.objectiveTakedowns,
        gameCreation: match.gameCreation
      };
    }),
    baselineGuides: localGuides,
    baselineChallenges: analytics.challenges
  };
};

const GuidesPanel = ({
  analytics,
  matches,
  championCatalog,
  recommendations,
  isAiLoading,
  aiError,
  dominantRole,
  localGuides
}: {
  analytics: PlayerAnalytics;
  matches: MatchOverview[];
  championCatalog?: ChampionCatalogMap;
  recommendations?: AiCoachRecommendationsResponse;
  isAiLoading: boolean;
  aiError?: string;
  dominantRole: ChampionRole;
  localGuides?: GuidePlan[];
}) => {
  const guides = recommendations?.guides.length ? recommendations.guides : localGuides ?? buildGuidePlans(analytics, matches, championCatalog);

  if (guides.length === 0) {
    return <EmptyState title="Busca un jugador para crear guides" description="Las guias se generan desde tus metricas, rol frecuente y partidas recientes." />;
  }

  return (
    <div className="space-y-4">
      <CoachInsightPanel recommendations={recommendations} isLoading={isAiLoading} error={aiError} dominantRole={dominantRole} />
      <Panel>
        <SectionHeading
          title="Guides dinamicas"
          caption={recommendations?.source && recommendations.source !== 'rules' ? 'Planes reescritos por IA con tus datos recientes.' : 'Planes generados con tus puntos debiles actuales, rol frecuente y partidas recientes.'}
          action={<span className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-200">{aiSourceLabel(recommendations)}</span>}
        />
      </Panel>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {guides.map((guide) => (
          <article key={guide.id} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/20 transition hover:border-sky-500/40">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-md bg-teal-500/10 px-2 py-1 text-xs font-semibold text-teal-300">{guide.priority}</span>
              <span className="text-xs text-zinc-500">{guide.minutes} min</span>
            </div>
            <h3 className="text-lg font-bold text-white">{guide.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{guide.focus}</p>
            <p className="mt-1 text-xs text-zinc-500">{guide.source}</p>
            {getGuideWhy(guide) && <p className="mt-3 rounded-md border border-sky-500/15 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">{getGuideWhy(guide)}</p>}
            <div className="mt-4 space-y-2">
              {guide.steps.map((step) => (
                <div key={step} className="rounded-md border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                  {step}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

const ChampionRecommendationPanel = ({
  insights,
  championCatalog,
  version
}: {
  insights?: ChampionInsightsResponse;
  championCatalog?: ChampionCatalogMap;
  version?: string;
}) => {
  const tierRows = insights?.tierList ?? [];
  const strong = tierRows.filter((row) => row.games >= 3).sort((a, b) => b.score - a.score).slice(0, 5);
  const weak = tierRows.filter((row) => row.games >= 3).sort((a, b) => a.score - b.score).slice(0, 5);
  const renderRows = (rows: typeof tierRows, emptyText: string, tone: 'emerald' | 'rose') => {
    if (rows.length === 0) {
      return <p className="text-sm text-zinc-500">{emptyText}</p>;
    }
    return (
      <div className="space-y-2">
        {rows.map((row) => {
          const champion = championCatalog?.[row.championId];
          return (
            <div key={`${row.championId}-${row.role}`} className="flex items-center justify-between rounded-md border border-zinc-800 bg-black/20 p-2">
              <div className="flex items-center gap-2">
                <ChampionAvatar championKey={champion?.id ?? row.championName} name={champion?.name ?? row.championName} version={version} className="h-9 w-9" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{champion?.name ?? row.championName}</p>
                  <p className="text-xs text-zinc-500">{roleLabels[row.role]} · {row.games} partidas</p>
                </div>
              </div>
              <span className={clsx('text-xs font-semibold', tone === 'emerald' ? 'text-emerald-300' : 'text-rose-300')}>{row.winRate.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Panel>
      <SectionHeading title="Pool recomendado" caption="Qué campeones priorizar o evitar basado en tu rendimiento reciente." />
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">Deberías jugar</p>
          {renderRows(strong, 'Sin datos suficientes para recomendar picks.', 'emerald')}
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-300">Mejor evita por ahora</p>
          {renderRows(weak, 'Sin datos suficientes para evitar picks.', 'rose')}
        </div>
      </div>
    </Panel>
  );
};

export const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRegion = searchParams.get('region') ?? 'na1';
  const initialGameName = searchParams.get('gameName') ?? '';
  const initialTagLine = searchParams.get('tagLine') ?? '';
  const initialView = (searchParams.get('view') as ViewKey | null) ?? 'profile';
  const [search, setSearch] = useState<SearchState | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>(initialView);
  const [selectedChallenge, setSelectedChallenge] = useState('farm-10');
  const [selectedReviewMatchId, setSelectedReviewMatchId] = useState('');
  const [rankedQueue, setRankedQueue] = useState<RankedQueueKey>('solo');

  const dataDragonQuery = useQuery({
    queryKey: ['ddragon-version'],
    queryFn: getLatestDataDragonVersion,
    staleTime: 1000 * 60 * 60 * 24
  });

  const version = dataDragonQuery.data;

  const championCatalogQuery = useQuery({
    queryKey: ['ddragon-champions', version],
    queryFn: () => getChampionCatalog(version),
    enabled: Boolean(version),
    staleTime: 1000 * 60 * 60 * 24
  });

  const itemCatalogQuery = useQuery({
    queryKey: ['ddragon-items', version],
    queryFn: () => getItemCatalog(version),
    enabled: Boolean(version),
    staleTime: 1000 * 60 * 60 * 24
  });

  const spellCatalogQuery = useQuery({
    queryKey: ['ddragon-summoner-spells', version],
    queryFn: () => getSummonerSpellCatalog(version),
    enabled: Boolean(version),
    staleTime: 1000 * 60 * 60 * 24
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', search],
    queryFn: () => riotApi.getSummary(search!.region, search!.gameName, search!.tagLine),
    enabled: Boolean(search),
    staleTime: 1000 * 60 * 5,
    retry: false
  });

  const rankedMatchesQuery = useQuery({
    queryKey: ['ranked-matches', search, summaryQuery.data?.puuid, rankedQueue],
    queryFn: () => riotApi.getRankedMatches(search!.region, summaryQuery.data!.puuid, rankedQueue, rankedMatchFetchCount),
    enabled: Boolean(search && summaryQuery.data?.puuid),
    staleTime: 1000 * 60 * 2,
    retry: false
  });

  const championInsightsQuery = useQuery({
    queryKey: ['champion-insights', search, summaryQuery.data?.puuid, rankedQueue],
    queryFn: () => riotApi.getChampionInsights(search!.region, summaryQuery.data!.puuid, rankedQueue, insightMatchFetchCount),
    enabled: Boolean(search && summaryQuery.data?.puuid && (activeView === 'tier' || activeView === 'builds')),
    staleTime: 1000 * 60 * 3,
    retry: false
  });

  const liveQuery = useQuery({
    queryKey: ['live', search, summaryQuery.data?.puuid],
    queryFn: () => riotApi.getLive(search!.region, summaryQuery.data!.puuid),
    enabled: Boolean(search && summaryQuery.data?.puuid && activeView === 'live'),
    refetchInterval: activeView === 'live' ? 10000 : false,
    retry: false
  });

  const matches = useMemo(() => rankedMatchesQuery.data ?? [], [rankedMatchesQuery.data]);
  const selectedReviewMatch = matches.find((match) => match.matchId === selectedReviewMatchId) ?? matches[0];
  const analytics = useMemo(() => buildAnalytics(summaryQuery.data, matches), [summaryQuery.data, matches]);
  const activeQueueLabel = rankedQueueOptions.find((option) => option.key === rankedQueue)?.label ?? 'Solo/Duo';
  const isLoading = summaryQuery.isLoading || rankedMatchesQuery.isLoading;
  const mainError = (summaryQuery.error as Error)?.message || (rankedMatchesQuery.error as Error)?.message;
  const insightError = (championInsightsQuery.error as Error)?.message;
  const liveError = (liveQuery.error as Error)?.message;
  const activeError = mainError || ((activeView === 'builds' || activeView === 'tier') && insightError ? insightError : '') || (activeView === 'live' && liveError ? liveError : '');
  const championCatalog = championCatalogQuery.data;
  const itemCatalog = itemCatalogQuery.data;
  const spellCatalog = spellCatalogQuery.data;
  const localGuidePlans = useMemo(() => buildGuidePlans(analytics, matches, championCatalog), [analytics, matches, championCatalog]);
  const dominantRole = useMemo(() => getDominantRole(matches), [matches]);
  const coachRequest = useMemo(
    () =>
      search && summaryQuery.data && analytics.games > 0
        ? buildCoachRequest({
            search,
            summary: summaryQuery.data,
            analytics,
            matches,
            championCatalog,
            rankedQueue,
            localGuides: localGuidePlans
          })
        : undefined,
    [analytics, championCatalog, localGuidePlans, matches, rankedQueue, search, summaryQuery.data]
  );

  const coachRecommendationsQuery = useQuery({
    queryKey: ['coach-recommendations', summaryQuery.data?.puuid, rankedQueue, matches.slice(0, 12).map((match) => match.matchId).join('|')],
    queryFn: () => riotApi.getCoachRecommendations(coachRequest!),
    enabled: Boolean(coachRequest && (activeView === 'guides' || activeView === 'challenges')),
    staleTime: 1000 * 60 * 5,
    retry: false
  });

  const aiCoachError = (coachRecommendationsQuery.error as Error)?.message;
  useEffect(() => {
    if (!initialGameName || !initialTagLine) return;
    setSearch({ region: initialRegion, gameName: initialGameName, tagLine: initialTagLine });
  }, [initialGameName, initialRegion, initialTagLine]);

  const updateUrl = (nextSearch: SearchState | null, nextView: ViewKey) => {
    const params = new URLSearchParams();
    params.set('view', nextView);
    if (nextSearch) {
      params.set('region', nextSearch.region);
      params.set('gameName', nextSearch.gameName);
      params.set('tagLine', nextSearch.tagLine);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <SearchBar
          onSearch={(next) => {
            setSearch(next);
            updateUrl(next, activeView);
          }}
          isLoading={summaryQuery.isFetching}
          initialRegion={initialRegion}
          initialRiotId={initialGameName && initialTagLine ? `${initialGameName}#${initialTagLine}` : ''}
        />

        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/65 p-2">
          {navItems.map((item) => (
            <TabButton key={item.key} active={activeView === item.key} onClick={() => {
              setActiveView(item.key);
              updateUrl(search, item.key);
            }}>
              {item.label}
            </TabButton>
          ))}
        </nav>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              summaryQuery.refetch();
              rankedMatchesQuery.refetch();
              championInsightsQuery.refetch();
              liveQuery.refetch();
              coachRecommendationsQuery.refetch();
            }}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-teal-300 hover:text-teal-200"
          >
            Refrescar datos
          </button>
        </div>

        {!search && activeView === 'profile' && (
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard label="Win Rate" value="--" highlight />
            <MetricCard label="KDA Promedio" value="--" />
            <MetricCard label="CS/min" value="--" />
            <MetricCard label="Vision / partida" value="--" />
          </div>
        )}

        {!search && activeView === 'profile' && <EmptyState title="Busca un invocador para comenzar" description="Perfil, GPI, historial, builds, tier list y retos aparecen con datos reales." />}

        {activeError && <ErrorState message={activeError} />}

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {summaryQuery.data && (
          <div className="space-y-5">
            <ProfileHeader profile={summaryQuery.data.profile} ranked={summaryQuery.data.ranked} activeQueue={rankedQueue} dataDragonVersion={version} />

            <Panel>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Clasificatoria activa</h3>
                  <p className="text-sm text-zinc-500">
                    {matches.length} partidas {activeQueueLabel} cargadas · insights desde {championInsightsQuery.data?.totalMatches ?? 0} partidas
                  </p>
                </div>
                <div className="flex gap-2">
                  {rankedQueueOptions.map((option) => (
                    <TabButton key={option.key} active={rankedQueue === option.key} onClick={() => setRankedQueue(option.key)}>
                      {option.shortLabel}
                    </TabButton>
                  ))}
                </div>
              </div>
            </Panel>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Win Rate" value={`${analytics.winRate.toFixed(1)}%`} highlight />
              <MetricCard label="KDA Promedio" value={`${analytics.avgKda.toFixed(2)}`} />
              <MetricCard label="CS/min" value={`${analytics.avgCs.toFixed(2)}`} />
              <MetricCard label="Vision / partida" value={`${analytics.avgVision.toFixed(1)}`} />
            </section>
          </div>
        )}

        {activeView === 'profile' && summaryQuery.data && (
          <div className="space-y-5">
            <ProfileDashboard analytics={analytics} matches={matches} version={version} championCatalog={championCatalog} />
            <LpFlowChart matches={matches} ranked={summaryQuery.data.ranked} activeQueue={rankedQueue} />
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {matches.length > 0 ? (
                  <div className="space-y-3">
                    <MatchHistoryTable matches={matches} dataDragonVersion={version} championCatalog={championCatalog} title={`Historial ${activeQueueLabel}`} region={search?.region} />
                    <MatchReviewPanel
                      match={selectedReviewMatch}
                      championCatalog={championCatalog}
                      baseline={{ damage: analytics.avgDamage, vision: analytics.avgVision, gold: analytics.avgGold, kp: analytics.avgKillParticipation }}
                    />
                  </div>
                ) : (
                  <EmptyState title={`Sin partidas ${activeQueueLabel}`} description="No encontramos partidas clasificatorias cargadas para este jugador." />
                )}
              </div>
              <div className="space-y-4">
                <ChampionMasteryList mastery={summaryQuery.data.masteryTop} dataDragonVersion={version} championCatalog={championCatalog} />
                <ChampionRecommendationPanel insights={championInsightsQuery.data} championCatalog={championCatalog} version={version} />
              </div>
            </section>
            <RankedTable ranked={summaryQuery.data.ranked} activeQueue={rankedQueue} />
          </div>
        )}

        {activeView === 'profile' && !summaryQuery.data && search && !isLoading && !activeError && (
          <EmptyState title="Sin datos cargados" description="La búsqueda todavía no devolvió información." />
        )}

        {activeView === 'live' && (
          <EnhancedLivePanel
            live={liveQuery.data}
            matches={matches}
            version={version}
            championCatalog={championCatalog}
            spellCatalog={spellCatalog}
            currentPuuid={summaryQuery.data?.puuid}
            insights={championInsightsQuery.data}
            itemCatalog={itemCatalog}
          />
        )}
        {activeView === 'builds' && (
          <div className="space-y-5">
            <ChampionBuildLab version={version} championCatalog={championCatalog} itemCatalog={itemCatalog} />
          </div>
        )}
        {activeView === 'tier' && (
          <TierPanel
            insights={championInsightsQuery.data}
            isLoading={Boolean(search) && (summaryQuery.isLoading || championInsightsQuery.isLoading)}
            hasPlayer={Boolean(summaryQuery.data?.puuid)}
            version={version}
            championCatalog={championCatalog}
            itemCatalog={itemCatalog}
          />
        )}
        {activeView === 'challenges' && (
          <ChallengePanel
            analytics={analytics}
            selectedId={selectedChallenge}
            onSelect={setSelectedChallenge}
            recommendations={coachRecommendationsQuery.data}
            isAiLoading={coachRecommendationsQuery.isFetching}
            aiError={aiCoachError}
            dominantRole={dominantRole}
          />
        )}
        {activeView === 'guides' && (
          <GuidesPanel
            analytics={analytics}
            matches={matches}
            championCatalog={championCatalog}
            recommendations={coachRecommendationsQuery.data}
            isAiLoading={coachRecommendationsQuery.isFetching}
            aiError={aiCoachError}
            dominantRole={dominantRole}
            localGuides={localGuidePlans}
          />
        )}
      </div>
    </MainLayout>
  );
};
