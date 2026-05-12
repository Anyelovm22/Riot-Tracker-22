import clsx from 'clsx';
import { Card } from '../../components/Card';
import { MatchOverview, RankedEntry, RankedQueueKey } from '../../types/api';

const queueTypes: Record<RankedQueueKey, string> = {
  solo: 'RANKED_SOLO_5x5',
  flex: 'RANKED_FLEX_SR'
};

const queueLabels: Record<RankedQueueKey, string> = {
  solo: 'Solo/Duo',
  flex: 'Flex'
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getRankedEntry = (ranked: RankedEntry[], queue: RankedQueueKey) => ranked.find((entry) => entry.queueType === queueTypes[queue]);

const estimateLpDeltas = (matches: MatchOverview[], entry?: RankedEntry) => {
  const recent = matches.slice(0, 14).reverse();
  const rankedTotal = entry ? entry.wins + entry.losses : 0;
  const rankedWinRate = rankedTotal ? (entry!.wins / rankedTotal) * 100 : 50;
  const sampleWinRate = recent.length ? (recent.filter((match) => match.win).length / recent.length) * 100 : rankedWinRate;
  const blendedWinRate = rankedTotal ? rankedWinRate * 0.7 + sampleWinRate * 0.3 : sampleWinRate;
  const winLp = Math.round(clamp(20 + (blendedWinRate - 50) * 0.12, 15, 27));
  const lossLp = Math.round(clamp(19 - (blendedWinRate - 50) * 0.08, 14, 25));
  let cumulative = 0;

  return {
    winLp,
    lossLp,
    points: recent.map((match, index) => {
      const delta = match.win ? winLp : -lossLp;
      cumulative += delta;
      return {
        index,
        match,
        delta,
        cumulative
      };
    })
  };
};

const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value}`;

export const LpFlowChart = ({
  matches,
  ranked,
  activeQueue
}: {
  matches: MatchOverview[];
  ranked: RankedEntry[];
  activeQueue: RankedQueueKey;
}) => {
  const entry = getRankedEntry(ranked, activeQueue);
  const { winLp, lossLp, points } = estimateLpDeltas(matches, entry);
  const netLp = points.length ? points[points.length - 1].cumulative : 0;
  const wins = points.filter((point) => point.delta > 0).length;
  const losses = points.length - wins;
  const minCumulative = Math.min(0, ...points.map((point) => point.cumulative));
  const maxCumulative = Math.max(0, ...points.map((point) => point.cumulative));
  const cumulativeRange = Math.max(1, maxCumulative - minCumulative);
  const maxDelta = Math.max(1, ...points.map((point) => Math.abs(point.delta)));
  const width = Math.max(620, points.length * 48 + 80);
  const height = 230;
  const padding = { top: 22, right: 28, bottom: 42, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = 128;
  const zeroY = padding.top + chartHeight / 2;
  const lineBaseY = padding.top + chartHeight + 32;
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
  const linePoints = points
    .map((point, index) => {
      const x = padding.left + (points.length > 1 ? index * xStep : chartWidth / 2);
      const y = lineBaseY - ((point.cumulative - minCumulative) / cumulativeRange) * 58;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Card className="border-sky-500/20 bg-zinc-950/85" title="Flujo de LP ranked">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-sky-200">Cola</p>
          <p className="mt-1 text-lg font-bold text-white">{queueLabels[activeQueue]}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-black/25 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">LP actual</p>
          <p className="mt-1 text-lg font-bold text-white">{entry ? `${entry.leaguePoints} LP` : 'Unranked'}</p>
        </div>
        <div className={clsx('rounded-md border p-3', netLp >= 0 ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-rose-500/25 bg-rose-500/10')}>
          <p className={clsx('text-xs uppercase tracking-wide', netLp >= 0 ? 'text-emerald-200' : 'text-rose-200')}>Balance reciente</p>
          <p className="mt-1 text-lg font-bold text-white">{formatSigned(netLp)} LP</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-black/25 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Muestra</p>
          <p className="mt-1 text-lg font-bold text-white">
            {wins}W / {losses}L
          </p>
        </div>
      </div>

      {points.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay partidas clasificatorias recientes para construir la grafica.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]" role="img" aria-label="Grafica de ganancia y perdida estimada de LP">
            <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeDasharray="4 6" />
            <text x={padding.left} y={zeroY - 8} fill="#a1a1aa" fontSize="11">
              0 LP
            </text>
            {points.map((point, index) => {
              const x = padding.left + (points.length > 1 ? index * xStep : chartWidth / 2);
              const barHeight = (Math.abs(point.delta) / maxDelta) * 56;
              const y = point.delta >= 0 ? zeroY - barHeight : zeroY;
              return (
                <g key={point.match.matchId}>
                  <rect
                    x={x - 11}
                    y={y}
                    width="22"
                    height={barHeight}
                    rx="4"
                    fill={point.delta >= 0 ? '#34d399' : '#fb7185'}
                    opacity="0.82"
                  >
                    <title>{`${point.match.championName}: ${formatSigned(point.delta)} LP (${point.match.win ? 'Win' : 'Loss'})`}</title>
                  </rect>
                  <text x={x} y={height - 18} fill="#71717a" fontSize="10" textAnchor="middle">
                    {index + 1}
                  </text>
                </g>
              );
            })}
            {linePoints && <polyline points={linePoints} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((point, index) => {
              const x = padding.left + (points.length > 1 ? index * xStep : chartWidth / 2);
              const y = lineBaseY - ((point.cumulative - minCumulative) / cumulativeRange) * 58;
              return <circle key={`line-${point.match.matchId}`} cx={x} cy={y} r="4" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />;
            })}
          </svg>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">Win ~ +{winLp} LP</span>
        <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">Loss ~ -{lossLp} LP</span>
        <span className="rounded-md border border-zinc-800 bg-black/25 px-2 py-1">Estimado por resultado reciente; Riot no entrega delta LP por match.</span>
      </div>
    </Card>
  );
};
