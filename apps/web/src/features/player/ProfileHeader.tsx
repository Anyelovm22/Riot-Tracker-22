import { Card } from '../../components/Card';
import { profileIconUrl } from '../../services/dataDragon';
import { RankedEntry, RankedQueueKey, SummonerProfile } from '../../types/api';

const queueTypes: Record<RankedQueueKey, string> = {
  solo: 'RANKED_SOLO_5x5',
  flex: 'RANKED_FLEX_SR'
};

const queueLabels: Record<RankedQueueKey, string> = {
  solo: 'Solo/Duo',
  flex: 'Flex'
};

const rankedLabel = (ranked: RankedEntry[], queue: RankedQueueKey) => {
  const entry = ranked.find((item) => item.queueType === queueTypes[queue]);
  if (!entry) return 'Unranked';
  return `${entry.tier} ${entry.rank} - ${entry.leaguePoints} LP`;
};
const rankedEntry = (ranked: RankedEntry[], queue: RankedQueueKey) => ranked.find((item) => item.queueType === queueTypes[queue]);
const rankBadge = (tier?: string) => (tier ? tier.slice(0, 2).toUpperCase() : '--');

export const ProfileHeader = ({
  profile,
  ranked,
  activeQueue,
  dataDragonVersion
}: {
  profile: SummonerProfile;
  ranked: RankedEntry[];
  activeQueue: RankedQueueKey;
  dataDragonVersion?: string;
}) => (
  <Card className="flex flex-col justify-between gap-4 border-teal-400/25 bg-zinc-950/85 sm:flex-row sm:items-center">
    <div className="flex items-center gap-4">
      <img
        src={profileIconUrl(dataDragonVersion, profile.profileIconId)}
        alt=""
        className="h-16 w-16 rounded-lg border border-teal-400/30 bg-zinc-900 object-cover"
      />
      <div>
        <h2 className="text-2xl font-bold text-white">
          {profile.gameName}#{profile.tagLine}
        </h2>
        <p className="text-sm text-zinc-400">Nivel {profile.summonerLevel}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm sm:text-right">
      <div className="rounded-md border border-zinc-800 bg-black/20 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{queueLabels[activeQueue]}</p>
        <div className="flex items-center justify-end gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-300/50 bg-emerald-500/15 text-xs font-bold text-emerald-200">
            {rankBadge(rankedEntry(ranked, activeQueue)?.tier)}
          </span>
          <p className="font-semibold text-zinc-100">{rankedLabel(ranked, activeQueue)}</p>
        </div>
      </div>
      <div className="rounded-md border border-zinc-800 bg-black/20 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Icono</p>
        <p className="font-semibold text-zinc-100">#{profile.profileIconId}</p>
      </div>
    </div>
  </Card>
);
