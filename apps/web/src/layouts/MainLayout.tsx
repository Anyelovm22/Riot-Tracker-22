import { PropsWithChildren } from 'react';

export const MainLayout = ({ children }: PropsWithChildren) => (
  <main className="min-h-screen bg-[#04081b] bg-[radial-gradient(circle_at_80%_0%,rgba(14,116,144,0.35),transparent_35%),linear-gradient(180deg,#111b4a_0%,#070d2e_38%,#050b25_100%)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 overflow-hidden rounded-2xl border border-indigo-500/30 bg-indigo-950/50 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-300" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">League intelligence</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Riot Tracker Pro</h1>
            <p className="mt-1 text-sm text-zinc-400">Perfil competitivo, coaching IA, LP flow y decisiones de partida en una sola vista.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[22rem]">
            <div className="rounded-md border border-teal-500/20 bg-teal-500/10 px-3 py-2">
              <p className="font-semibold uppercase tracking-wide text-teal-300">Riot API</p>
              <p className="mt-1 text-zinc-400">Match-V5</p>
            </div>
            <div className="rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2">
              <p className="font-semibold uppercase tracking-wide text-sky-300">Coach IA</p>
              <p className="mt-1 text-zinc-400">Guides</p>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="font-semibold uppercase tracking-wide text-amber-300">LP Flow</p>
              <p className="mt-1 text-zinc-400">Ranked</p>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  </main>
);
