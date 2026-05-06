import { PropsWithChildren } from 'react';

export const MainLayout = ({ children }: PropsWithChildren) => (
  <main className="min-h-screen bg-[#080b0f] bg-[linear-gradient(180deg,#0d1317_0%,#080b0f_36%,#0b0d10_100%)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">League intelligence</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Riot Tracker Pro</h1>
            <p className="mt-1 text-sm text-zinc-400">Perfil competitivo, rendimiento y decisiones de partida en una sola vista.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs sm:min-w-56">
            <div className="rounded-md border border-teal-500/20 bg-teal-500/10 px-3 py-2">
              <p className="font-semibold uppercase tracking-wide text-teal-300">Riot API</p>
              <p className="mt-1 text-zinc-400">Match-V5</p>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="font-semibold uppercase tracking-wide text-amber-300">Data</p>
              <p className="mt-1 text-zinc-400">Live</p>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  </main>
);
