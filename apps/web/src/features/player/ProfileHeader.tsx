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
const rankIconUrl = (tier?: string) =>
  tier ? `https://raw.githubusercontent.com/mrtolkien/league-assets/main/ranked-emblems/Emblem_${tier.toUpperCase()}.png` : '';

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
          {rankedEntry(ranked, activeQueue)?.tier && (
            <img src={rankIconUrl(rankedEntry(ranked, activeQueue)?.tier)} alt="" className="h-9 w-9 object-contain" />
          )}
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
