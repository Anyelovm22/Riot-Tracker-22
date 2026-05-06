import { Card } from '../../components/Card';
import { ChampionCatalogMap, championIconUrl } from '../../services/dataDragon';
import { ChampionMastery } from '../../types/api';

export const ChampionMasteryList = ({
  mastery,
  dataDragonVersion,
  championCatalog
}: {
  mastery: ChampionMastery[];
  dataDragonVersion?: string;
  championCatalog?: ChampionCatalogMap;
}) => (
  <Card title="Campeones más usados">
    {mastery.length === 0 ? (
      <p className="text-sm text-zinc-400">Sin maestrias visibles.</p>
    ) : (
      <div className="space-y-2">
        {mastery.map((item) => {
          const champion = championCatalog?.[item.championId];
          return (
            <div key={item.championId} className="flex items-center justify-between rounded-md bg-black/24 px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                {champion ? (
                  <img src={championIconUrl(dataDragonVersion, champion.id)} alt="" className="h-9 w-9 rounded-md object-cover" />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-zinc-800 text-xs text-zinc-400">#{item.championId}</div>
                )}
                <div>
                  <p className="font-semibold text-zinc-100">{champion?.name ?? `Champion ${item.championId}`}</p>
                  <p className="text-xs text-zinc-500">Maestria {item.championLevel}</p>
                </div>
              </div>
              <span className="font-semibold text-white">{item.championPoints.toLocaleString()} pts</span>
            </div>
          );
        })}
      </div>
    )}
  </Card>
);
