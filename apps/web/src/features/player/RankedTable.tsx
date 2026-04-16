import { Card } from '../../components/Card';
import { RankedEntry } from '../../types/api';

export const RankedTable = ({ ranked }: { ranked: RankedEntry[] }) => (
  <Card title="Ranked Queues">
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
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
            return (
              <tr key={entry.queueType} className="border-b border-slate-900 text-slate-200">
                <td className="py-2">{entry.queueType.replace('RANKED_', '')}</td>
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
  </Card>
);
