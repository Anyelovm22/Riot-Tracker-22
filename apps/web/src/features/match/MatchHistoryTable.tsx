import { Card } from '../../components/Card';
import { ChampionCatalogMap, championIconUrl, itemIconUrl } from '../../services/dataDragon';
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
  title = 'Historial reciente'
}: {
  matches: MatchOverview[];
  dataDragonVersion?: string;
  championCatalog?: ChampionCatalogMap;
  title?: string;
}) => (
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
              <tr key={match.matchId} className="border-b border-zinc-900 text-zinc-200">
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
);
