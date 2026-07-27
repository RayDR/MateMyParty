'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@matemyparty/i18n';
import { calculateCountdown, type CountdownState } from '../lib/countdown';

export function EventCountdown({
  startsAt,
  endsAt,
  dictionary,
}: {
  startsAt: string;
  endsAt: string | null;
  dictionary: Dictionary;
}) {
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  useEffect(() => {
    const update = () => setCountdown(calculateCountdown(startsAt, endsAt, new Date()));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [endsAt, startsAt]);

  if (!countdown) {
    return <div aria-hidden="true" className="mt-6 h-20 rounded-2xl bg-white/5" />;
  }
  if (countdown.status === 'STARTED' || countdown.status === 'COMPLETED') {
    return (
      <p role="timer" className="mt-6 rounded-2xl bg-violet-500/15 p-5 text-center font-black">
        {countdown.status === 'STARTED'
          ? dictionary.invitation.countdownStarted
          : dictionary.invitation.countdownCompleted}
      </p>
    );
  }
  return (
    <section aria-label={dictionary.invitation.countdownTitle} className="mt-6">
      <h2 className="text-center text-sm font-bold uppercase tracking-wider text-cyan-200">
        {dictionary.invitation.countdownTitle}
      </h2>
      <dl role="timer" className="mt-3 grid grid-cols-3 gap-3 text-center">
        <CountdownValue value={countdown.days} label={dictionary.invitation.countdownDays} />
        <CountdownValue value={countdown.hours} label={dictionary.invitation.countdownHours} />
        <CountdownValue value={countdown.minutes} label={dictionary.invitation.countdownMinutes} />
      </dl>
    </section>
  );
}

function CountdownValue({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <dd className="text-3xl font-black tabular-nums">{value}</dd>
      <dt className="mt-1 text-xs text-slate-300">{label}</dt>
    </div>
  );
}
