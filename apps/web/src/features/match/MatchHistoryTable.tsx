import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Card } from '../../components/Card';
import { ChampionCatalogMap, championIconUrl, itemIconUrl } from '../../services/dataDragon';
import { riotApi } from '../../services/riotApi';
import { MatchOverview } from '../../types/api';

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

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

  return (
  <>
  <Card title={title}>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
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
              <tr key={match.matchId} className="cursor-pointer border-b border-zinc-900 text-zinc-200 transition hover:bg-zinc-900/40" onClick={() => setSelectedMatchId(match.matchId)}>
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
  {selectedMatch && averages && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-[#08122d] to-[#060b1d] p-5 shadow-2xl shadow-cyan-900/20">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Desglose profesional de partida</p>
            <p className="text-xs text-zinc-400">Match {selectedMatch.matchId.slice(-8)} · {shortQueue(selectedMatch.queueId)} · {formatDuration(selectedMatch.gameDurationSeconds)}</p>
          </div>
          <button type="button" onClick={() => setSelectedMatchId('')} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">Cerrar</button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">KDA</p><p className="text-2xl font-bold text-white">{selectedMatch.kills}/{selectedMatch.deaths}/{selectedMatch.assists}</p></div>
          <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Resultado</p><p className={clsx('text-2xl font-bold', selectedMatch.win ? 'text-emerald-300' : 'text-rose-300')}>{selectedMatch.win ? 'Victoria' : 'Derrota'}</p></div>
          <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Objetivos</p><p className="text-2xl font-bold text-white">{selectedMatch.objectiveTakedowns}</p></div>
          <div className="rounded-md border border-zinc-800 bg-black/20 p-3"><p className="text-xs text-zinc-500">Tiempo muerto</p><p className="text-2xl font-bold text-white">{Math.round(selectedMatch.totalTimeSpentDead / 60)}m</p></div>
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
              <li>2) Si vas por delante, convierte ventaja en 1 objetivo neutral.</li>
              <li>3) En peleas, entra después de CC principal para subir supervivencia.</li>
            </ol>
          </div>
        </div>
        {matchDetailQuery.isFetching && <p className="mt-4 text-sm text-zinc-400">Cargando desglose completo de ambos equipos...</p>}
        {matchDetailQuery.error && <p className="mt-4 text-sm text-rose-300">No se pudo cargar el detalle completo de la partida.</p>}
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
      </div>
    </div>
  )}
  </>
);
};
