import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Card } from '../../components/Card';
import { ChampionCatalogMap, championIconUrl, itemIconUrl } from '../../services/dataDragon';
import { riotApi } from '../../services/riotApi';
import { MatchOverview } from '../../types/api';

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const formatAgo = (timestamp: number) => {
  const diffDays = Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
  if (diffDays < 1) return 'hoy';
  if (diffDays === 1) return 'hace 1 día';
  if (diffDays < 7) return `hace ${diffDays} días`;
  const weeks = Math.floor(diffDays / 7);
  return `hace ${weeks} semana${weeks === 1 ? '' : 's'}`;
};

const shortQueue = (queueId: number) => {
  if (queueId === 420) return 'Solo/Duo';
  if (queueId === 440) return 'Flex';
  return `Queue ${queueId}`;
};

export const MatchHistoryTable = ({
  matches,
  dataDragonVersion,
  championCatalog,
  title = 'Historial reciente',
  region
}: {
  matches: MatchOverview[];
  dataDragonVersion?: string;
  championCatalog?: ChampionCatalogMap;
  title?: string;
  region?: string;
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const selectedMatch = useMemo(() => matches.find((match) => match.matchId === selectedMatchId) ?? null, [matches, selectedMatchId]);
  const averages = useMemo(() => {
    if (matches.length === 0) return null;
    return {
      cs: matches.reduce((sum, row) => sum + row.csPerMinute, 0) / matches.length,
      vision: matches.reduce((sum, row) => sum + row.visionScore, 0) / matches.length,
      kp: matches.reduce((sum, row) => sum + row.killParticipation, 0) / matches.length,
      dpm: matches.reduce((sum, row) => sum + row.damagePerMinute, 0) / matches.length,
      gpm: matches.reduce((sum, row) => sum + row.goldPerMinute, 0) / matches.length
    };
  }, [matches]);
  const matchDetailQuery = useQuery({
    queryKey: ['match-detail', region, selectedMatchId],
    queryFn: () => riotApi.getMatchDetail(region!, selectedMatchId),
    enabled: Boolean(region && selectedMatchId),
    staleTime: 1000 * 60 * 3
  });

  const renderComparison = (label: string, value: number, avg: number, suffix = '', max = 100) => {
    const safeAvg = avg <= 0 ? 1 : avg;
    const ratio = Math.max(0, Math.min(180, (value / safeAvg) * 100));
    const tone = value >= avg ? 'bg-emerald-400' : 'bg-rose-400';
    return (
      <div className="rounded-md border border-zinc-800 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span>{label}</span>
          <span>{value.toFixed(1)}{suffix} vs {avg.toFixed(1)}{suffix}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className={clsx('h-full rounded-full', tone)} style={{ width: `${Math.min(max, ratio)}%` }} />
        </div>
      </div>
    );
  };
  const getDeltaLabel = (value: number, avg: number, goodWhenHigher = true) => {
    const delta = value - avg;
    const abs = Math.abs(delta);
    const status = goodWhenHigher ? (delta >= 0 ? 'positive' : 'negative') : delta <= 0 ? 'positive' : 'negative';
    return {
      status,
      text: `${delta >= 0 ? '+' : '-'}${abs.toFixed(1)}`
    };
  };
  const radarStats = selectedMatch && averages
    ? [
        { label: 'KDA', value: (selectedMatch.kills + selectedMatch.assists) / Math.max(1, selectedMatch.deaths), avg: 2.4, goodWhenHigher: true },
        { label: 'CS', value: selectedMatch.csPerMinute, avg: averages.cs, goodWhenHigher: true },
        { label: 'Vision', value: selectedMatch.visionScore, avg: averages.vision, goodWhenHigher: true },
        { label: 'KP', value: selectedMatch.killParticipation, avg: averages.kp, goodWhenHigher: true },
        { label: 'DPM', value: selectedMatch.damagePerMinute, avg: averages.dpm, goodWhenHigher: true }
      ]
    : [];

  return (
  <>
  <Card title={title}>
    <p className="mb-4 text-sm text-zinc-400">Haz click en cualquier partida para ver un análisis completo y comparativas visuales.</p>
    <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-800/80">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-950">
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="py-2">Partida</th>
            <th>Cola</th>
            <th>Champion</th>
            <th>KDA</th>
            <th>CS/min</th>
            <th>Visión</th>
            <th>KP</th>
            <th>Items</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const champion = championCatalog?.[match.championId];
            return (
              <tr
                key={match.matchId}
                className={clsx(
                  'cursor-pointer border-b border-zinc-900 text-zinc-200 transition hover:bg-zinc-900/40',
                  selectedMatchId === match.matchId && 'bg-cyan-900/20 ring-1 ring-inset ring-cyan-500/40'
                )}
                onClick={() => setSelectedMatchId(match.matchId)}
              >
                <td className="py-2">
                  <div className="font-semibold">{match.matchId.slice(-8)}</div>
                  <div className="text-xs text-zinc-500">{formatDuration(match.gameDurationSeconds)}</div>
                </td>
                <td>{shortQueue(match.queueId)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <img src={championIconUrl(dataDragonVersion, champion?.id ?? match.championName)} alt="" className="h-9 w-9 rounded-md object-cover" />
                    <div>
                      <p className="font-semibold">{champion?.name ?? match.championName}</p>
                      <p className="text-xs text-zinc-500">{match.teamPosition || 'Role'}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="font-semibold">
                    {match.kills}/{match.deaths}/{match.assists}
                  </span>
                </td>
                <td>{match.csPerMinute.toFixed(2)}</td>
                <td>{match.visionScore}</td>
                <td>{match.killParticipation.toFixed(0)}%</td>
                <td>
                  <div className="flex min-w-36 gap-1">
                    {match.itemIds.slice(0, 6).map((itemId, index) => (
                      <img
                        key={`${match.matchId}-${itemId}-${index}`}
                        src={itemIconUrl(dataDragonVersion, itemId)}
                        alt=""
                        className="h-7 w-7 rounded border border-zinc-800 bg-zinc-900 object-cover"
                      />
                    ))}
                  </div>
                </td>
                <td className={match.win ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>{match.win ? 'Win' : 'Loss'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
  {selectedMatch && averages && createPortal(
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#02061a]/95 p-4">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-[#11193d] via-[#0d1434] to-[#0a1028] p-5 shadow-2xl shadow-cyan-900/20">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Desglose profesional de partida</p>
            <p className="text-xs text-zinc-400">Match {selectedMatch.matchId.slice(-8)} · {shortQueue(selectedMatch.queueId)} · {formatDuration(selectedMatch.gameDurationSeconds)} · {formatAgo(selectedMatch.gameCreation)}</p>
          </div>
          <button type="button" onClick={() => setSelectedMatchId('')} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">Cerrar</button>
        </div>
        <div className="mb-4 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-zinc-700 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Mapa de rendimiento</p>
            <svg viewBox="0 0 240 240" className="mx-auto mt-2 h-56 w-56">
              {[35, 55, 75, 95].map((r) => <circle key={r} cx="120" cy="120" r={r} fill="none" stroke="#334155" strokeWidth="1" />)}
              {radarStats.map((_, i) => {
                const angle = (Math.PI * 2 * i) / radarStats.length - Math.PI / 2;
                return <line key={`axis-${i}`} x1="120" y1="120" x2={120 + Math.cos(angle) * 95} y2={120 + Math.sin(angle) * 95} stroke="#334155" strokeWidth="1" />;
              })}
              <polygon
                points={radarStats
                  .map((stat, i) => {
                    const angle = (Math.PI * 2 * i) / radarStats.length - Math.PI / 2;
                    const ratio = Math.max(0.2, Math.min(1, stat.value / Math.max(1, stat.avg)));
                    return `${120 + Math.cos(angle) * (ratio * 95)} ${120 + Math.sin(angle) * (ratio * 95)}`;
                  })
                  .join(' ')}
                fill="rgba(45,212,191,.25)"
                stroke="#2dd4bf"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">KDA</p><p className="text-2xl font-bold text-white">{selectedMatch.kills}/{selectedMatch.deaths}/{selectedMatch.assists}</p></div>
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Resultado</p><p className={clsx('text-2xl font-bold', selectedMatch.win ? 'text-emerald-300' : 'text-rose-300')}>{selectedMatch.win ? 'Victoria' : 'Derrota'}</p></div>
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Objetivos</p><p className="text-2xl font-bold text-white">{selectedMatch.objectiveTakedowns}</p></div>
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Tiempo muerto</p><p className="text-2xl font-bold text-white">{Math.round(selectedMatch.totalTimeSpentDead / 60)}m</p></div>
            <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Daño/min</p><p className="text-2xl font-bold text-white">{selectedMatch.damagePerMinute.toFixed(0)}</p></div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {renderComparison('CS/min', selectedMatch.csPerMinute, averages.cs)}
          {renderComparison('Vision Score', selectedMatch.visionScore, averages.vision, '', 160)}
          {renderComparison('Kill Participation', selectedMatch.killParticipation, averages.kp, '%')}
          {renderComparison('Damage/min', selectedMatch.damagePerMinute, averages.dpm, '', 160)}
          {renderComparison('Gold/min', selectedMatch.goldPerMinute, averages.gpm, '', 160)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-200">Qué hiciste bien</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-200">
              <li>• KP {selectedMatch.killParticipation.toFixed(1)}% ({getDeltaLabel(selectedMatch.killParticipation, averages.kp).text} vs promedio).</li>
              <li>• DPM {selectedMatch.damagePerMinute.toFixed(0)} ({getDeltaLabel(selectedMatch.damagePerMinute, averages.dpm).text}).</li>
              <li>• Oro/min {selectedMatch.goldPerMinute.toFixed(0)} ({getDeltaLabel(selectedMatch.goldPerMinute, averages.gpm).text}).</li>
            </ul>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-200">Riesgos detectados</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-200">
              <li>• Visión {selectedMatch.visionScore.toFixed(1)} ({getDeltaLabel(selectedMatch.visionScore, averages.vision).text} vs promedio).</li>
              <li>• Muertes: {selectedMatch.deaths} ({selectedMatch.deaths >= 7 ? 'alta exposición' : 'aceptable'}).</li>
              <li>• Objetivos: {selectedMatch.objectiveTakedowns} ({selectedMatch.objectiveTakedowns <= 1 ? 'impacto bajo en macro' : 'buena presencia'}).</li>
            </ul>
          </div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-xs uppercase tracking-wide text-sky-200">Plan para próxima partida</p>
            <ol className="mt-2 space-y-2 text-sm text-zinc-200">
              <li>1) Antes del min 14, coloca 1 ward de control por reset.</li>
              <li>2) {selectedMatch.objectiveTakedowns <= 1 ? 'Fuerza dragón/heraldo tras una kill para no perder tempo.' : 'Mantén rotación a objetivos cuando tengas prioridad.'}</li>
              <li>3) {selectedMatch.deaths >= 8 ? 'Reduce riesgo: juega con visión antes de pelear.' : 'Aprovecha picos de poder para buscar picks con tu equipo.'}</li>
            </ol>
          </div>
        </div>
        {matchDetailQuery.isLoading && (
          <div className="mt-5 rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-4 text-sm text-zinc-300">Cargando información avanzada de equipos...</div>
        )}
        {matchDetailQuery.data && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {matchDetailQuery.data.teams.map((team) => (
                <div key={team.teamId} className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Team {team.teamId}</p>
                  <p className={clsx('text-lg font-bold', team.win ? 'text-emerald-300' : 'text-rose-300')}>{team.win ? 'Victoria' : 'Derrota'}</p>
                  <p className="text-sm text-zinc-300">Kills: {team.totalKills} · Gold: {team.totalGold} · Damage: {team.totalDamage}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {matchDetailQuery.data.teams.map((team) => (
                <div key={`players-${team.teamId}`} className="rounded-md border border-zinc-800 bg-black/20 p-3">
                  <p className="mb-2 text-sm font-semibold text-zinc-200">Team {team.teamId} · jugadores y líneas</p>
                  <div className="space-y-2">
                    {team.participants.map((player) => (
                      <div key={player.puuid} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1">
                        <div className="flex items-center gap-2">
                          <img src={championIconUrl(dataDragonVersion, championCatalog?.[player.championId]?.id ?? player.championName)} alt="" className="h-8 w-8 rounded" />
                          <div>
                            <p className="text-xs text-zinc-100">{player.gameName}{player.tagLine ? `#${player.tagLine}` : ''}</p>
                            <p className="text-xs text-zinc-500">{player.teamPosition || player.lane}</p>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-300">{player.kills}/{player.deaths}/{player.assists}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {matchDetailQuery.isError && (
          <div className="mt-5 rounded-lg border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-200">
            No pudimos cargar el detalle extendido de esta partida en este momento. Intenta nuevamente.
          </div>
        )}
      </div>
      </div>
  , document.body)}
  </>
);
};
