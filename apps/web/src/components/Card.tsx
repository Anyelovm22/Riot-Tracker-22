import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps extends PropsWithChildren {
  className?: string;
  title?: string;
}

export const Card = ({ children, className, title }: CardProps) => {
  return (
    <section className={clsx('rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30', className)}>
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>}
      {children}
    </section>
  );
};
