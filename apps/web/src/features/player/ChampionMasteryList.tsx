import { Card } from '../../components/Card';
import { ChampionMastery } from '../../types/api';

export const ChampionMasteryList = ({ mastery }: { mastery: ChampionMastery[] }) => (
  <Card title="Campeones más usados">
    <div className="space-y-2">
      {mastery.map((item) => (
        <div key={item.championId} className="flex items-center justify-between rounded-lg bg-slate-950/80 px-3 py-2 text-sm">
          <span className="text-slate-300">Champion ID {item.championId}</span>
          <span className="font-semibold text-white">{item.championPoints.toLocaleString()} pts</span>
        </div>
      ))}
    </div>
  </Card>
);
