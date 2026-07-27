export type CountdownState =
  | { status: 'UPCOMING'; days: number; hours: number; minutes: number }
  | { status: 'STARTED' }
  | { status: 'COMPLETED' };

export function calculateCountdown(
  startsAt: string,
  endsAt: string | null,
  now: Date,
): CountdownState | null {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : null;
  const current = now.getTime();
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) return null;
  if (end !== null && current >= end) return { status: 'COMPLETED' };
  if (current >= start) return { status: 'STARTED' };
  const remainingMinutes = Math.max(0, Math.floor((start - current) / 60_000));
  return {
    status: 'UPCOMING',
    days: Math.floor(remainingMinutes / 1440),
    hours: Math.floor((remainingMinutes % 1440) / 60),
    minutes: remainingMinutes % 60,
  };
}
