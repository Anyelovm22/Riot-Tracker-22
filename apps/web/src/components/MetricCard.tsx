import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export const MetricCard = ({ label, value, highlight }: MetricCardProps) => (
  <Card className={highlight ? 'border-teal-400/60 bg-teal-500/10' : 'bg-zinc-950/75'}>
    <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
    <p className={highlight ? 'mt-2 text-2xl font-bold text-teal-100' : 'mt-2 text-2xl font-bold text-white'}>{value}</p>
  </Card>
);
