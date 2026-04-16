import { PropsWithChildren } from 'react';

export const MainLayout = ({ children }: PropsWithChildren) => (
  <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">Riot Tracker Pro</h1>
        <p className="text-slate-400">Analítica premium para League of Legends con Riot API.</p>
      </header>
      {children}
    </div>
  </main>
);
