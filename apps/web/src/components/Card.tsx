import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps extends PropsWithChildren {
  className?: string;
  title?: string;
}

export const Card = ({ children, className, title }: CardProps) => {
  return (
    <section className={clsx('rounded-lg border border-zinc-800/90 bg-zinc-950/80 p-4 shadow-xl shadow-black/20 backdrop-blur', className)}>
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">{title}</h3>}
      {children}
    </section>
  );
};
