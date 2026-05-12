import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import {
  ChampionCatalogMap,
  ChampionDetails,
  ItemCatalogMap,
  RuneCatalogMap,
  SummonerSpellCatalogMap,
  championIconUrl,
  championSpellIconUrl,
  championSplashUrl,
  getChampionDetails,
  getRuneCatalog,
  getSummonerSpellCatalog,
  itemIconUrl,
  runeIconUrl,
  summonerSpellIconUrl
} from '../../services/dataDragon';
import { riotApi } from '../../services/riotApi';
import type {
  ChampionAbilityOrder,
  ChampionBuildsResponse,
  ChampionGlobalBuildVariant,
  ChampionItemBlock,
  ChampionRole,
  ChampionRunePage,
  ChampionSpellPair,
  EliteLeagueTier,
  RankedQueueKey
} from '../../types/api';

interface ChampionBuildLabProps {
  version?: string;
  championCatalog?: ChampionCatalogMap;
  itemCatalog?: ItemCatalogMap;
  defaultRegion?: string;
}

const regionOptions = [
  { value: 'global', label: 'Mundial' },
  { value: 'na1', label: 'NA' },
  { value: 'la1', label: 'LAN' },
  { value: 'la2', label: 'LAS' },
  { value: 'br1', label: 'BR' },
  { value: 'euw1', label: 'EUW' },
  { value: 'eun1', label: 'EUNE' },
  { value: 'kr', label: 'KR' },
  { value: 'jp1', label: 'JP' },
  { value: 'oc1', label: 'OCE' },
  { value: 'tr1', label: 'TR' },
  { value: 'ru', label: 'RU' }
];

const fastGlobalRegions = ['kr', 'euw1', 'na1', 'br1', 'la1', 'la2'];
const buildRequestProfiles = {
  global: {
    playerLimit: 4,
    matchesPerPlayer: 3,
    championMatchLimit: 12
  },
  regional: {
    playerLimit: 8,
    matchesPerPlayer: 4,
    championMatchLimit: 18
  }
};

const roleOptions: Array<{ value: ChampionRole | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungla' },
  { value: 'MID', label: 'Mid' },
  { value: 'ADC', label: 'Bot' },
  { value: 'SUPPORT', label: 'Soporte' }
];

const sourceTierOptions: Array<{ value: EliteLeagueTier; label: string }> = [
  { value: 'challenger', label: 'Challenger' },
  { value: 'grandmaster', label: 'Grandmaster' },
  { value: 'master', label: 'Master' }
];

const queueOptions: Array<{ value: RankedQueueKey; label: string }> = [
  { value: 'solo', label: 'SoloQ' },
  { value: 'flex', label: 'Flex' }
];

const blockLabels: Record<ChampionItemBlock['label'], string> = {
  starter: 'Starter',
  early: 'Early',
  core: 'Core',
  full: 'Full build'
};

const roleLabels: Record<ChampionRole | 'ALL', string> = {
  ALL: 'Todos',
  TOP: 'Top',
  JUNGLE: 'Jungla',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Soporte',
  UNKNOWN: 'Sin rol'
};

const abilityLabels: Record<number, string> = {
  1: 'Q',
  2: 'W',
  3: 'E',
  4: 'R'
};

const formatDecimal = (value: number, digits = 1) => value.toFixed(digits);
const formatCompact = (value: number) => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const regionLabel = (region: string) => regionOptions.find((option) => option.value === region)?.label ?? region.toUpperCase();
type UiTone = 'teal' | 'emerald' | 'amber' | 'rose' | 'zinc';

const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={clsx('rounded-lg border border-zinc-800/90 bg-zinc-950/80 p-4 shadow-xl shadow-black/20', className)}>{children}</section>
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

const Metric = ({ label, value, tone = 'zinc' }: { label: string; value: string; tone?: UiTone }) => (
  <div className="rounded-md border border-white/10 bg-black/35 p-3">
    <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
    <p
      className={clsx(
        'mt-1 text-2xl font-bold',
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

const StatusPill = ({ label, value, tone = 'zinc' }: { label: string; value: string; tone?: UiTone }) => (
  <div
    className={clsx(
      'rounded-md border px-3 py-2',
      tone === 'teal' && 'border-teal-500/30 bg-teal-500/10 text-teal-100',
      tone === 'emerald' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
      tone === 'amber' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      tone === 'rose' && 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      tone === 'zinc' && 'border-zinc-800 bg-black/25 text-zinc-200'
    )}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
    <p className="mt-0.5 text-sm font-semibold">{value}</p>
  </div>
);

const BuildLoadingState = ({
  championName,
  region,
  queue,
  sourceTier,
  playerLimit,
  matchesPerPlayer,
  championMatchLimit
}: {
  championName: string;
  region: string;
  queue: RankedQueueKey;
  sourceTier: EliteLeagueTier;
  playerLimit: number;
  matchesPerPlayer: number;
  championMatchLimit: number;
}) => {
  const queueLabel = queueOptions.find((option) => option.value === queue)?.label ?? queue;
  const sourceLabel = sourceTierOptions.find((option) => option.value === sourceTier)?.label ?? sourceTier;

  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">Buscando builds reales</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{championName}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Escaneando jugadores elite, partidas clasificatorias y timelines de items. La primera busqueda tarda mas; luego queda en cache.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatusPill label="Alcance" value={region === 'global' ? `${fastGlobalRegions.length} regiones clave` : regionLabel(region)} tone="teal" />
            <StatusPill label="Fuente" value={`${sourceLabel} / ${queueLabel}`} tone="amber" />
            <StatusPill label="Jugadores" value={`${playerLimit} x ${matchesPerPlayer} partidas`} />
            <StatusPill label="Objetivo" value={`hasta ${championMatchLimit} matches`} tone="emerald" />
          </div>
        </div>

        <div className="grid content-center gap-3">
          {['Resolviendo liga elite', 'Leyendo historial reciente', 'Filtrando partidas del campeon', 'Agrupando items, runas y spells'].map((step, index) => (
            <div key={step} className="rounded-md border border-zinc-800 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-200">{step}</span>
                <span className="text-xs text-zinc-500">0{index + 1}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full animate-pulse rounded-full bg-teal-300"
                  style={{ width: `${Math.max(28, 92 - index * 15)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};

const StatBar = ({ label, value, caption, tone = 'teal' }: { label: string; value: number; caption: string; tone?: 'teal' | 'emerald' | 'amber' | 'rose' }) => (
  <div className="rounded-md border border-zinc-800 bg-black/25 p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-zinc-200">{label}</span>
      <span className="text-xs text-zinc-500">{caption}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div
        className={clsx(
          'h-full rounded-full',
          tone === 'teal' && 'bg-teal-300',
          tone === 'emerald' && 'bg-emerald-400',
          tone === 'amber' && 'bg-amber-400',
          tone === 'rose' && 'bg-rose-400'
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

const ItemIcon = ({ itemId, version, itemCatalog, size = 'md' }: { itemId: number; version?: string; itemCatalog?: ItemCatalogMap; size?: 'sm' | 'md' | 'lg' }) => (
  <div className="group relative">
    <img
      src={itemIconUrl(version, itemId)}
      alt=""
      className={clsx(
        'rounded-md border border-zinc-800 bg-zinc-900 object-cover',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12'
      )}
    />
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 shadow-xl group-hover:block">
      {itemCatalog?.[itemId]?.name ?? `Item ${itemId}`}
    </div>
  </div>
);

const ItemStrip = ({ itemIds, version, itemCatalog, size = 'md' }: { itemIds: number[]; version?: string; itemCatalog?: ItemCatalogMap; size?: 'sm' | 'md' | 'lg' }) => {
  if (itemIds.length === 0) {
    return <span className="text-sm text-zinc-500">Sin muestra.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {itemIds.map((itemId, index) => (
        <ItemIcon key={`${itemId}-${index}`} itemId={itemId} version={version} itemCatalog={itemCatalog} size={size} />
      ))}
    </div>
  );
};

const SpellStrip = ({ pair, catalog, version }: { pair?: ChampionSpellPair; catalog?: SummonerSpellCatalogMap; version?: string }) => {
  if (!pair) return <span className="text-sm text-zinc-500">Sin spells suficientes.</span>;

  return (
    <div className="flex items-center gap-3">
      {pair.spellIds.map((spellId) => {
        const spell = catalog?.[spellId];
        return spell ? (
          <img key={spellId} src={summonerSpellIconUrl(version, spell.image)} title={spell.name} alt="" className="h-11 w-11 rounded-md border border-zinc-800 bg-zinc-900" />
        ) : (
          <span key={spellId} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-300">
            {spellId}
          </span>
        );
      })}
      <span className="text-sm text-zinc-400">
        {formatDecimal(pair.pickRate)}% pick, {formatDecimal(pair.winRate)}% WR
      </span>
    </div>
  );
};

const RuneIcon = ({ runeId, catalog }: { runeId: number; catalog?: RuneCatalogMap }) => {
  const rune = catalog?.[runeId];

  return rune ? (
    <img src={runeIconUrl(rune.icon)} title={rune.name} alt="" className="h-9 w-9 rounded-full border border-zinc-800 bg-zinc-900 p-1" />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-500">{runeId}</span>
  );
};

const RunePageView = ({ page, catalog }: { page?: ChampionRunePage; catalog?: RuneCatalogMap }) => {
  if (!page) return <span className="text-sm text-zinc-500">Sin runas suficientes.</span>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <RuneIcon runeId={page.primaryStyleId} catalog={catalog} />
        <RuneIcon runeId={page.subStyleId} catalog={catalog} />
        <span className="text-sm text-zinc-400">
          {formatDecimal(page.pickRate)}% pick, {formatDecimal(page.winRate)}% WR
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {page.perkIds.map((runeId) => (
          <RuneIcon key={runeId} runeId={runeId} catalog={catalog} />
        ))}
      </div>
    </div>
  );
};

const AbilityOrderView = ({ order, championDetails, version }: { order?: ChampionAbilityOrder; championDetails?: ChampionDetails | null; version?: string }) => {
  if (!order) return <span className="text-sm text-zinc-500">Sin orden suficiente.</span>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {order.sequence.slice(0, 18).map((slot, index) => {
          const spell = championDetails?.spells[slot - 1];
          return (
            <div key={`${slot}-${index}`} className="grid w-9 gap-1 text-center">
              <span className="text-[10px] text-zinc-500">{index + 1}</span>
              {spell ? (
                <img src={championSpellIconUrl(version, spell.image)} title={spell.name} alt="" className="h-8 w-8 rounded-md border border-zinc-800 bg-zinc-900" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-xs font-bold text-teal-200">{abilityLabels[slot] ?? '-'}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-zinc-400">
        {formatDecimal(order.pickRate)}% pick, {formatDecimal(order.winRate)}% WR
      </p>
    </div>
  );
};

const VariantButton = ({
  variant,
  active,
  onClick,
  version,
  itemCatalog
}: {
  variant: ChampionGlobalBuildVariant;
  active: boolean;
  onClick: () => void;
  version?: string;
  itemCatalog?: ItemCatalogMap;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'w-full rounded-md border p-3 text-left transition',
      active ? 'border-teal-300 bg-teal-300/10' : 'border-zinc-800 bg-black/20 hover:border-zinc-600'
    )}
  >
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="font-semibold text-white">{variant.name}</span>
      <span className="text-xs font-semibold text-teal-200">{formatDecimal(variant.popularity)}%</span>
    </div>
    <ItemStrip itemIds={variant.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
    <p className="mt-3 text-xs text-zinc-400">
      {variant.games} games, {formatDecimal(variant.winRate)}% WR, {formatDecimal(variant.avgKda, 2)} KDA
    </p>
  </button>
);

const BuildComparisonTable = ({
  variants,
  activeId,
  onSelect,
  version,
  itemCatalog,
  baselineWinRate
}: {
  variants: ChampionGlobalBuildVariant[];
  activeId?: string;
  onSelect: (id: string) => void;
  version?: string;
  itemCatalog?: ItemCatalogMap;
  baselineWinRate: number;
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
          <th className="py-2">Build</th>
          <th>Items</th>
          <th>Pick</th>
          <th>WR</th>
          <th>Delta</th>
          <th>Games</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((variant) => {
          const delta = variant.winRate - baselineWinRate;
          return (
            <tr
              key={variant.id}
              className={clsx('border-b border-zinc-900 transition hover:bg-white/[0.03]', activeId === variant.id && 'bg-teal-300/5')}
            >
              <td className="py-3">
                <button type="button" onClick={() => onSelect(variant.id)} className="font-semibold text-white hover:text-teal-200">
                  {variant.name}
                </button>
              </td>
              <td>
                <ItemStrip itemIds={variant.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
              </td>
              <td>{formatDecimal(variant.pickRate)}%</td>
              <td className={variant.winRate >= baselineWinRate ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>{formatDecimal(variant.winRate)}%</td>
              <td className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {delta >= 0 ? '+' : ''}
                {formatDecimal(delta)}%
              </td>
              <td>{formatCompact(variant.games)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const RegionBreakdown = ({ data }: { data: ChampionBuildsResponse['sample']['regionBreakdown'] }) => {
  const maxMatches = Math.max(1, ...data.map((item) => item.championMatches));

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {data.map((region) => (
        <div key={region.region} className="rounded-md border border-zinc-800 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-semibold text-white">{regionLabel(region.region)}</span>
            <span className={region.winRate >= 52 ? 'text-sm font-bold text-emerald-300' : region.winRate >= 48 ? 'text-sm font-bold text-teal-200' : 'text-sm font-bold text-rose-300'}>
              {formatDecimal(region.winRate)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-teal-300" style={{ width: `${Math.max(5, (region.championMatches / maxMatches) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {region.championMatches} games, {formatDecimal(region.pickRate)}% pick, {region.playersScanned} jugadores
          </p>
        </div>
      ))}
    </div>
  );
};

const ItemBlockView = ({ block, version, itemCatalog }: { block: ChampionItemBlock; version?: string; itemCatalog?: ItemCatalogMap }) => (
  <div className="rounded-md border border-zinc-800 bg-black/25 p-3">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{blockLabels[block.label]}</h3>
      <span className="text-xs text-zinc-500">{block.items.length} items</span>
    </div>
    <div className="space-y-3">
      {block.items.length ? (
        block.items.map((item) => (
          <div key={item.itemId} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ItemIcon itemId={item.itemId} version={version} itemCatalog={itemCatalog} size="sm" />
              <span className="text-sm text-zinc-300">{itemCatalog?.[item.itemId]?.name ?? `Item ${item.itemId}`}</span>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>{formatDecimal(item.pickRate)}% pick</p>
              <p>{formatDecimal(item.winRate)}% WR</p>
            </div>
          </div>
        ))
      ) : (
        <span className="text-sm text-zinc-500">Sin datos.</span>
      )}
    </div>
  </div>
);

export const ChampionBuildLab = ({ version, championCatalog, itemCatalog }: ChampionBuildLabProps) => {
  const [region, setRegion] = useState('global');
  const [queue, setQueue] = useState<RankedQueueKey>('solo');
  const [role, setRole] = useState<ChampionRole | 'ALL'>('ALL');
  const [sourceTier, setSourceTier] = useState<EliteLeagueTier>('challenger');
  const [championId, setChampionId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  const championOptions = useMemo(
    () =>
      Object.values(championCatalog ?? {})
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((champion) => ({
          value: String(champion.key),
          label: champion.name
        })),
    [championCatalog]
  );
  const championSelectOptions = useMemo(() => [{ value: '', label: 'Selecciona campeon' }, ...championOptions], [championOptions]);

  const selectedChampion = championId ? championCatalog?.[Number(championId)] : undefined;
  const requestProfile = region === 'global' ? buildRequestProfiles.global : buildRequestProfiles.regional;
  const requestRegions = region === 'global' ? fastGlobalRegions : [region];

  const spellCatalogQuery = useQuery({
    queryKey: ['ddragon-spells', version],
    queryFn: () => getSummonerSpellCatalog(version),
    enabled: Boolean(version),
    staleTime: 1000 * 60 * 60 * 24
  });

  const runeCatalogQuery = useQuery({
    queryKey: ['ddragon-runes', version],
    queryFn: () => getRuneCatalog(version),
    enabled: Boolean(version),
    staleTime: 1000 * 60 * 60 * 24
  });

  const championDetailsQuery = useQuery({
    queryKey: ['ddragon-champion-details', version, selectedChampion?.id],
    queryFn: () => getChampionDetails(selectedChampion!.id, version),
    enabled: Boolean(version && selectedChampion?.id),
    staleTime: 1000 * 60 * 60 * 24
  });

  const buildsQuery = useQuery({
    queryKey: [
      'champion-builds-global',
      region,
      championId,
      queue,
      role,
      sourceTier,
      requestProfile.playerLimit,
      requestProfile.matchesPerPlayer,
      requestProfile.championMatchLimit,
      requestRegions.join(',')
    ],
    queryFn: () => {
      const sharedOptions = {
        queue,
        role,
        sourceTier,
        playerLimit: requestProfile.playerLimit,
        matchesPerPlayer: requestProfile.matchesPerPlayer,
        championMatchLimit: requestProfile.championMatchLimit
      };

      if (region === 'global') {
        return riotApi.getGlobalChampionBuilds(Number(championId), {
          ...sharedOptions,
          regions: requestRegions
        });
      }

      return riotApi.getChampionBuilds(region, Number(championId), sharedOptions);
    },
    enabled: Boolean(championId),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: false
  });

  const data = buildsQuery.data;
  const variants = useMemo(() => data?.variants ?? [], [data?.variants]);
  const activeVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const bestWinVariant = useMemo(() => [...variants].sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0], [variants]);
  const mostPopularVariant = variants[0];
  const bestRegion = data?.sample.regionBreakdown[0];

  useEffect(() => {
    if (variants.length === 0) {
      setSelectedVariantId('');
      return;
    }

    if (!variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(variants[0].id);
    }
  }, [selectedVariantId, variants]);

  if (!championCatalog || championOptions.length === 0) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">Champion Build Lab</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Builds por campeon</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              Muestra rapida desde partidas elite de Riot. Usa una region concreta si necesitas respuesta mas veloz o una lectura mas localizada.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <StatusPill label="Cobertura" value={region === 'global' ? `${requestRegions.length} regiones` : regionLabel(region)} tone="teal" />
            <StatusPill label="Escaneo" value={`${requestProfile.playerLimit} players x ${requestProfile.matchesPerPlayer}`} />
            <StatusPill label="Muestra" value={`max ${requestProfile.championMatchLimit} games`} tone="amber" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.8fr]">
          <Select label="Campeon" value={championId} onChange={setChampionId} options={championSelectOptions} />
          <Select label="Alcance" value={region} onChange={setRegion} options={regionOptions} />
          <Select label="Cola" value={queue} onChange={(value) => setQueue(value as RankedQueueKey)} options={queueOptions} />
          <Select label="Rol" value={role} onChange={(value) => setRole(value as ChampionRole | 'ALL')} options={roleOptions} />
          <Select label="Fuente" value={sourceTier} onChange={(value) => setSourceTier(value as EliteLeagueTier)} options={sourceTierOptions} />
        </div>
      </Panel>

      {!selectedChampion && <EmptyState title="Selecciona un campeon" description="Las builds globales se cargan cuando eliges una opcion." />}

      {selectedChampion && (
        <section className="overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-950 shadow-2xl shadow-black/30">
          <div
            className="relative min-h-[260px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(8,11,15,0.96) 0%, rgba(8,11,15,0.82) 42%, rgba(8,11,15,0.3) 100%), url(${championSplashUrl(selectedChampion.id)})`
            }}
          >
            <div className="relative grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr] lg:p-7">
              <div className="flex flex-col justify-between gap-6">
                <div className="flex items-center gap-4">
                  <img src={championIconUrl(version, selectedChampion.id)} alt="" className="h-20 w-20 rounded-lg border border-teal-300/60 bg-zinc-900 object-cover" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">{roleLabels[role]} build</p>
                    <h2 className="mt-1 text-4xl font-bold text-white">{selectedChampion.name}</h2>
                    <p className="mt-1 text-sm text-zinc-300">
                      {regionLabel(region)} - {sourceTierOptions.find((option) => option.value === sourceTier)?.label} - {queueOptions.find((option) => option.value === queue)?.label} - Riot API
                    </p>
                  </div>
                </div>

                {data && (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Win rate" value={`${formatDecimal(data.summary.winRate)}%`} tone={data.summary.winRate >= 52 ? 'emerald' : data.summary.winRate >= 48 ? 'teal' : 'rose'} />
                    <Metric label="Pick rate" value={`${formatDecimal(data.summary.pickRate)}%`} tone="teal" />
                    <Metric label="Games" value={formatCompact(data.summary.games)} />
                    <Metric label="KDA" value={`${formatDecimal(data.summary.avgKda, 2)}`} tone="amber" />
                  </div>
                )}
              </div>

              {data && (
                <div className="grid content-end gap-3">
                  <StatBar label="Kill participation" value={data.summary.avgKillParticipation} caption={`${formatDecimal(data.summary.avgKillParticipation)}%`} tone="emerald" />
                  <StatBar label="Win sample" value={data.summary.winRate} caption={`${data.summary.wins}W / ${data.summary.losses}L`} tone={data.summary.winRate >= 50 ? 'teal' : 'rose'} />
                  <StatBar
                    label={region === 'global' ? 'Regional coverage' : 'Coverage'}
                    value={region === 'global' ? Math.min(100, (data.sample.regionBreakdown.length / Math.max(1, data.requested.regions.length)) * 100) : Math.min(100, (data.sample.championMatches / Math.max(1, data.requested.championMatchLimit)) * 100)}
                    caption={region === 'global' ? `${data.sample.regionBreakdown.length}/${data.requested.regions.length} regiones` : `${data.sample.championMatches}/${data.requested.championMatchLimit}`}
                    tone="amber"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {selectedChampion && buildsQuery.isFetching && !data && (
        <BuildLoadingState
          championName={selectedChampion.name}
          region={region}
          queue={queue}
          sourceTier={sourceTier}
          playerLimit={requestProfile.playerLimit}
          matchesPerPlayer={requestProfile.matchesPerPlayer}
          championMatchLimit={requestProfile.championMatchLimit}
        />
      )}

      {selectedChampion && buildsQuery.isFetching && data && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
          Actualizando la muestra de {selectedChampion.name} con los filtros activos.
        </div>
      )}

      {buildsQuery.error && !buildsQuery.isFetching && <ErrorState message={(buildsQuery.error as Error).message} />}

      {data && data.summary.games === 0 && !buildsQuery.isFetching && (
        <EmptyState title="Sin muestra para este campeon" description="Cambia region, rol o fuente elite para buscar partidas recientes desde Riot API." />
      )}

      {data && data.summary.games > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Mas popular</p>
              <p className="mt-1 text-lg font-bold text-white">{mostPopularVariant?.name ?? 'Sin build'}</p>
              {mostPopularVariant && (
                <div className="mt-3 space-y-3">
                  <ItemStrip itemIds={mostPopularVariant.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                  <StatBar label="Pick rate" value={mostPopularVariant.pickRate} caption={`${formatDecimal(mostPopularVariant.pickRate)}%`} />
                </div>
              )}
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Mejor win rate</p>
              <p className="mt-1 text-lg font-bold text-white">{bestWinVariant?.name ?? 'Sin build'}</p>
              {bestWinVariant && (
                <div className="mt-3 space-y-3">
                  <ItemStrip itemIds={bestWinVariant.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                  <StatBar label="Win rate" value={bestWinVariant.winRate} caption={`${formatDecimal(bestWinVariant.winRate)}%`} tone="emerald" />
                </div>
              )}
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Mejor region</p>
              <p className="mt-1 text-lg font-bold text-white">{bestRegion ? regionLabel(bestRegion.region) : 'Sin region'}</p>
              {bestRegion && (
                <div className="mt-3 space-y-3">
                  <StatBar label="Win regional" value={bestRegion.winRate} caption={`${formatDecimal(bestRegion.winRate)}%`} tone="amber" />
                  <p className="text-sm text-zinc-400">{bestRegion.championMatches} games detectados</p>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="space-y-4">
              <Panel>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Build ranking</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {data.sample.totalMatchesScanned} matches escaneados, {data.sample.playersScanned} jugadores, {data.requested.regions.length} regiones
                    </p>
                  </div>
                  <span className="rounded-md bg-teal-500/10 px-2 py-1 text-xs font-semibold text-teal-200">{data.sourceTier}</span>
                </div>
                <div className="space-y-2">
                  {variants.map((variant) => (
                    <VariantButton
                      key={variant.id}
                      variant={variant}
                      active={activeVariant?.id === variant.id}
                      onClick={() => setSelectedVariantId(variant.id)}
                      version={version}
                      itemCatalog={itemCatalog}
                    />
                  ))}
                </div>
              </Panel>

              <Panel>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Top players API</h3>
                <div className="space-y-3">
                  {data.topPlayers.length ? (
                    data.topPlayers.slice(0, 8).map((player) => (
                      <div key={`${player.region}-${player.puuid}`} className="rounded-md border border-zinc-800 bg-black/25 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {player.gameName}
                              {player.tagLine ? `#${player.tagLine}` : ''}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {regionLabel(player.region)} - {roleLabels[player.role]} - {player.games} games - {formatDecimal(player.avgKda, 2)} KDA
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-300">{formatDecimal(player.winRate)}%</span>
                        </div>
                        <ItemStrip itemIds={player.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500">Sin jugadores suficientes.</span>
                  )}
                </div>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Comparacion mundial</h3>
                    <p className="mt-1 text-sm text-zinc-500">Compara pick rate, win rate y delta contra el promedio de la muestra.</p>
                  </div>
                  {activeVariant && <ItemStrip itemIds={activeVariant.itemIds} version={version} itemCatalog={itemCatalog} size="lg" />}
                </div>
                <BuildComparisonTable
                  variants={variants}
                  activeId={activeVariant?.id}
                  onSelect={setSelectedVariantId}
                  version={version}
                  itemCatalog={itemCatalog}
                  baselineWinRate={data.summary.winRate}
                />
              </Panel>

              <Panel>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Itemizacion recomendada</h3>
                    <p className="mt-1 text-sm text-zinc-500">Bloques agregados desde compras y builds finales en partidas reales.</p>
                  </div>
                  {activeVariant && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">{formatDecimal(activeVariant.winRate)}% WR seleccionada</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {data.itemBlocks.map((block) => (
                    <ItemBlockView key={block.label} block={block} version={version} itemCatalog={itemCatalog} />
                  ))}
                </div>
              </Panel>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Runas</h3>
                <RunePageView page={data.runePages[0]} catalog={runeCatalogQuery.data} />
              </Panel>

              <Panel>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Spells</h3>
                <SpellStrip pair={data.spellPairs[0]} catalog={spellCatalogQuery.data} version={version} />
              </Panel>

              <Panel>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Orden</h3>
                <AbilityOrderView order={data.abilityOrders[0]} championDetails={championDetailsQuery.data} version={version} />
              </Panel>
            </div>

            <Panel>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Breakdown por region</h3>
              <RegionBreakdown data={data.sample.regionBreakdown} />
            </Panel>

            <Panel>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">Partidas recientes detectadas</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {data.recentMatches.slice(0, 6).map((match) => (
                  <div key={match.matchId} className="rounded-md border border-zinc-800 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {match.gameName}
                        {match.tagLine ? `#${match.tagLine}` : ''}
                      </p>
                      <span className={match.win ? 'text-sm font-bold text-emerald-300' : 'text-sm font-bold text-rose-300'}>{match.win ? 'Win' : 'Loss'}</span>
                    </div>
                    <p className="mb-3 text-xs text-zinc-500">
                      {regionLabel(match.region)} - {match.kills}/{match.deaths}/{match.assists} - {roleLabels[match.role]}
                    </p>
                    <ItemStrip itemIds={match.itemIds} version={version} itemCatalog={itemCatalog} size="sm" />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
