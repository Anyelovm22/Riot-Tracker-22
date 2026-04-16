import { Card } from '../../components/Card';
import { MatchOverview } from '../../types/api';

export const MatchHistoryTable = ({ matches }: { matches: MatchOverview[] }) => (
  <Card title="Historial reciente">
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
            <th className="py-2">Match</th>
            <th>Champion</th>
            <th>KDA</th>
            <th>CS/min</th>
            <th>Visión</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.matchId} className="border-b border-slate-900 text-slate-200">
              <td className="py-2">{match.matchId.slice(-8)}</td>
              <td>{match.championName}</td>
              <td>
                {match.kills}/{match.deaths}/{match.assists}
              </td>
              <td>{match.csPerMinute.toFixed(2)}</td>
              <td>{match.visionScore}</td>
              <td className={match.win ? 'text-emerald-400' : 'text-rose-400'}>{match.win ? 'Win' : 'Loss'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
