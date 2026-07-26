import { NotFoundException } from '@nestjs/common';
import type { EventsRepository } from '../src/events/events.repository';
import { EventsService } from '../src/events/events.service';

const row = {
  title: 'Raymundo’s 6th Birthday',
  celebrantName: 'Raymundo',
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY' as const,
  status: 'DRAFT' as const,
  startsAt: new Date('2026-08-06T18:00:00.000Z'),
  endsAt: null,
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: 'Kids Empire Dallas Hillcrest',
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  publicSlug: 'raymundo-6',
  templateKey: 'kids-night-dragon',
  templateVersion: 1,
  hostMessage: null,
  rsvpDeadline: null,
};

describe('EventsService', () => {
  it('normalizes and resolves an event by hostname', async () => {
    let received = '';
    const repository = {
      findByHostname: async (hostname: string) => {
        received = hostname;
        return row;
      },
      findBySlug: async () => row,
    } as unknown as EventsRepository;
    const result = await new EventsService(repository).byHostname(
      ' Raymundo6th.Domoforge.com:443 ',
    );
    expect(received).toBe('raymundo6th.domoforge.com');
    expect(result.publicSlug).toBe('raymundo-6');
    expect(result).not.toHaveProperty('id');
  });

  it('returns 404 semantics for an unknown hostname', async () => {
    const repository = {
      findByHostname: async () => null,
      findBySlug: async () => null,
    } as unknown as EventsRepository;
    await expect(
      new EventsService(repository).byHostname('unknown.example'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
