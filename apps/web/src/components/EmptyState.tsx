export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-lg border border-dashed border-zinc-700/90 bg-zinc-950/55 p-6 text-center shadow-inner shadow-black/20">
    <h4 className="text-lg font-semibold text-zinc-200">{title}</h4>
    <p className="mt-2 text-sm text-zinc-400">{description}</p>
  </div>
);
