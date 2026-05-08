const getFriendlyTitle = (message: string) => {
  if (message.includes('RIOT_API_KEY')) return 'La key de Riot necesita atencion.';
  if (message.toLowerCase().includes('limitando') || message.toLowerCase().includes('rate limit')) return 'Riot esta limitando las consultas.';
  if (message.toLowerCase().includes('no se pudo conectar')) return 'La API local no responde.';
  return 'No se pudo cargar la informacion.';
};

export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-amber-600/40 bg-amber-950/25 p-4 text-amber-100 shadow-xl shadow-black/20">
    <p className="font-medium">{getFriendlyTitle(message)}</p>
    <p className="mt-1 text-sm opacity-90">{message}</p>
  </div>
);
