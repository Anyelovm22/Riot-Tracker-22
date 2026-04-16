import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '../layouts/MainLayout';
import { SearchBar } from '../features/player/SearchBar';
import { riotApi } from '../services/riotApi';
import { ProfileHeader } from '../features/player/ProfileHeader';
import { MetricCard } from '../components/MetricCard';
import { RankedTable } from '../features/player/RankedTable';
import { ChampionMasteryList } from '../features/player/ChampionMasteryList';
import { MatchHistoryTable } from '../features/match/MatchHistoryTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';

interface SearchState {
  region: string;
  gameName: string;
  tagLine: string;
}

export const App = () => {
  const [search, setSearch] = useState<SearchState | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['summary', search],
    queryFn: () => riotApi.getSummary(search!.region, search!.gameName, search!.tagLine),
    enabled: Boolean(search)
  });

  const historyQuery = useQuery({
    queryKey: ['history', search, summaryQuery.data?.puuid],
    queryFn: async () => {
      const history = await riotApi.getHistory(search!.region, summaryQuery.data!.puuid, 10);
      const matchCalls = history.map((id) => riotApi.getMatch(search!.region, id));
      return Promise.all(matchCalls);
    },
    enabled: Boolean(search && summaryQuery.data?.puuid)
  });

  const liveQuery = useQuery({
    queryKey: ['live', search, summaryQuery.data?.puuid],
    queryFn: () => riotApi.getLive(search!.region, summaryQuery.data!.puuid),
    enabled: Boolean(search && summaryQuery.data?.puuid)
  });

  const isLoading = summaryQuery.isLoading || historyQuery.isLoading;
  const errorMessage = (summaryQuery.error as Error)?.message || (historyQuery.error as Error)?.message;

  const insights = useMemo(() => summaryQuery.data?.insights, [summaryQuery.data]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <SearchBar onSearch={setSearch} isLoading={isLoading} />

        {!search && (
          <EmptyState
            title="Busca un invocador para comenzar"
            description="Ingresa región, game name y tag para ver métricas, historial y recomendaciones en segundos."
          />
        )}

        {errorMessage && <ErrorState message={errorMessage} />}

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {summaryQuery.data && (
          <div className="space-y-6">
            <ProfileHeader profile={summaryQuery.data.profile} />

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Win Rate" value={`${insights?.winRate ?? 0}%`} highlight />
              <MetricCard label="KDA Promedio" value={`${insights?.avgKda ?? 0}`} />
              <MetricCard label="CS/min" value={`${insights?.avgCsMin ?? 0}`} />
              <MetricCard label="Visión / partida" value={`${insights?.visionPerGame ?? 0}`} />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {historyQuery.data && historyQuery.data.length > 0 ? (
                  <MatchHistoryTable matches={historyQuery.data} />
                ) : (
                  <EmptyState title="Sin historial reciente" description="No encontramos partidas recientes para este jugador." />
                )}
              </div>
              <ChampionMasteryList mastery={summaryQuery.data.masteryTop} />
            </section>

            <RankedTable ranked={summaryQuery.data.ranked} />

            <section>
              {liveQuery.data ? (
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-emerald-200">
                  <p className="font-semibold">Partida en vivo detectada</p>
                  <p className="text-sm opacity-90">Se encontró una partida activa para este invocador.</p>
                </div>
              ) : (
                <EmptyState title="No está en partida en vivo" description="Actualmente este invocador no está en una partida activa." />
              )}
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
