export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-600/40 bg-rose-950/20 p-4 text-rose-200">
    <p className="font-medium">No se pudo cargar la información.</p>
    <p className="mt-1 text-sm opacity-90">{message}</p>
  </div>
);
