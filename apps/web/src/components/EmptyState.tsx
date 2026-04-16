export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
    <h4 className="text-lg font-semibold text-slate-200">{title}</h4>
    <p className="mt-2 text-sm text-slate-400">{description}</p>
  </div>
);
