export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-rose-600/40 bg-rose-950/25 p-4 text-rose-100 shadow-xl shadow-black/20">
    <p className="font-medium">No se pudo cargar la información.</p>
    <p className="mt-1 text-sm opacity-90">{message}</p>
  </div>
);
