import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export const MetricCard = ({ label, value, highlight }: MetricCardProps) => (
  <Card className={highlight ? 'border-brand-500 bg-brand-500/10' : ''}>
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
  </Card>
);
