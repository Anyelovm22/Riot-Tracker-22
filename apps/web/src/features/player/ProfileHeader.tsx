import { Card } from '../../components/Card';
import { SummonerProfile } from '../../types/api';

export const ProfileHeader = ({ profile }: { profile: SummonerProfile }) => (
  <Card className="flex items-center justify-between gap-4">
    <div>
      <h2 className="text-2xl font-bold text-white">
        {profile.gameName}#{profile.tagLine}
      </h2>
      <p className="text-sm text-slate-400">Nivel {profile.summonerLevel}</p>
    </div>
    <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Icono #{profile.profileIconId}</div>
  </Card>
);
