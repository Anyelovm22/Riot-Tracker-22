import { Card } from '../../components/Card';
import { RankedEntry, RankedQueueKey } from '../../types/api';

const queueTypes: Record<RankedQueueKey, string> = {
  solo: 'RANKED_SOLO_5x5',
  flex: 'RANKED_FLEX_SR'
};

const queueLabel = (queueType: string) => {
  if (queueType === 'RANKED_SOLO_5x5') return 'Solo/Duo';
  if (queueType === 'RANKED_FLEX_SR') return 'Flex';
  return queueType.replace('RANKED_', '');
};

export const RankedTable = ({ ranked, activeQueue }: { ranked: RankedEntry[]; activeQueue?: RankedQueueKey }) => (
  <Card title="Ranked Queues">
    {ranked.length === 0 ? (
      <p className="text-sm text-zinc-400">Sin clasificatorias registradas.</p>
    ) : (
      <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="py-2">Queue</th>
            <th>Tier</th>
            <th>LP</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry) => {
            const total = entry.wins + entry.losses;
            const winRate = total === 0 ? 0 : (entry.wins / total) * 100;
            const isActive = activeQueue ? entry.queueType === queueTypes[activeQueue] : false;
            return (
              <tr key={entry.queueType} className={isActive ? 'border-b border-teal-900/50 bg-teal-500/5 text-zinc-100' : 'border-b border-zinc-900 text-zinc-200'}>
                <td className="py-2">{queueLabel(entry.queueType)}</td>
                <td>
                  {entry.tier} {entry.rank}
                </td>
                <td>{entry.leaguePoints}</td>
                <td>{winRate.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    )}
  </Card>
);
