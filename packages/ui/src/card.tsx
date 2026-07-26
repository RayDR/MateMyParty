import type { PropsWithChildren } from 'react';

export function Card({ children }: PropsWithChildren) {
  return (
    <section className="rounded-3xl border border-white/15 bg-slate-950/65 p-6 shadow-2xl backdrop-blur">
      {children}
    </section>
  );
}
