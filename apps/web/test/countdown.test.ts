import { describe, expect, it } from 'vitest';
import { calculateCountdown } from '../lib/countdown';

describe('localized invitation countdown state', () => {
  it('calculates whole days, hours, and minutes before the event instant', () => {
    expect(
      calculateCountdown(
        '2026-08-06T18:00:00.000Z',
        '2026-08-06T20:00:00.000Z',
        new Date('2026-08-04T15:29:00.000Z'),
      ),
    ).toEqual({ status: 'UPCOMING', days: 2, hours: 2, minutes: 31 });
  });

  it('distinguishes started and completed events', () => {
    expect(
      calculateCountdown(
        '2026-08-06T18:00:00.000Z',
        '2026-08-06T20:00:00.000Z',
        new Date('2026-08-06T19:00:00.000Z'),
      ),
    ).toEqual({ status: 'STARTED' });
    expect(
      calculateCountdown(
        '2026-08-06T18:00:00.000Z',
        '2026-08-06T20:00:00.000Z',
        new Date('2026-08-06T20:00:00.000Z'),
      ),
    ).toEqual({ status: 'COMPLETED' });
  });
});
