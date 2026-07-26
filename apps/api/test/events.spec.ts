import { NotFoundException } from '@nestjs/common';
import type { UpdateHostEventInput } from '@matemyparty/contracts';
import type { DatabaseExecutor, eventLocalizations, events } from '@matemyparty/database';
import type { EventsRepository, HostEventRecord } from '../src/events/events.repository';
import { EventsService } from '../src/events/events.service';

type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;

const publicRow = {
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

const event: EventRow = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  ...publicRow,
  publicCode: 'SQ52LQE9',
  animationMode: 'IMMERSIVE',
  videoBackgroundRef: '/private-media/raymundo-6/dragons-intro.mp4',
  staticFallbackRef: null,
  audioRef: '/private-media/raymundo-6/dragons-theme.mp3',
  animationEnabled: true,
  audioEnabled: true,
  overlayIntensity: 50,
  thumbnailImageRef: null,
  staticBackgroundRef: null,
  mapsUrl: null,
  createdAt: new Date('2026-07-26T00:00:00.000Z'),
  updatedAt: new Date('2026-07-26T00:00:00.000Z'),
};

const localization = (locale: 'en-US' | 'es-MX', title: string): LocalizationRow => ({
  id:
    locale === 'en-US'
      ? '77777777-7777-4777-8777-777777777777'
      : '88888888-8888-4888-8888-888888888888',
  eventId: event.id,
  locale,
  title,
  celebrantName: 'Raymundo',
  venueName: 'Kids Empire Dallas Hillcrest',
  hostMessage: null,
  arrivalInstructions: null,
  thumbnailAltText: title,
  createdAt: new Date('2026-07-26T00:00:00.000Z'),
  updatedAt: new Date('2026-07-26T00:00:00.000Z'),
});

const hostRecord: HostEventRecord = {
  event,
  localizations: [
    localization('en-US', 'Raymundo’s 6th Birthday'),
    localization('es-MX', 'Sexto cumpleaños de Raymundo'),
  ],
  primaryHostname: 'raymundo6th.domoforge.com',
  statistics: { guestCount: 4, invitationCount: 3, openedCount: 2 },
  revisionNumber: 1,
};

const update: UpdateHostEventInput = {
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY',
  status: 'DRAFT',
  startsAt: '2026-08-06T18:00:00.000Z',
  endsAt: null,
  timezone: 'America/Chicago',
  defaultLocale: 'en-US',
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  mapsUrl: null,
  thumbnailImageRef: null,
  staticBackgroundRef: null,
  localizedContent: {
    'en-US': {
      title: 'Raymundo’s 6th Birthday',
      celebrantName: 'Raymundo',
      venueName: 'Kids Empire Dallas Hillcrest',
      hostMessage: null,
      arrivalInstructions: null,
      thumbnailAltText: 'Raymundo’s 6th birthday',
    },
    'es-MX': {
      title: 'Sexto cumpleaños de Raymundo',
      celebrantName: 'Raymundo',
      venueName: 'Kids Empire Dallas Hillcrest',
      hostMessage: null,
      arrivalInstructions: null,
      thumbnailAltText: 'Sexto cumpleaños de Raymundo',
    },
  },
  template: {
    key: 'kids-night-dragon',
    version: 1,
    animationMode: 'IMMERSIVE',
    videoBackgroundRef: '/private-media/raymundo-6/dragons-intro.mp4',
    staticFallbackRef: null,
    audioRef: '/private-media/raymundo-6/dragons-theme.mp3',
    animationEnabled: true,
    audioEnabled: true,
    overlayIntensity: 50,
  },
};

describe('EventsService', () => {
  it('normalizes and resolves an event by hostname', async () => {
    let received = '';
    const repository = {
      findByHostname: async (hostname: string) => {
        received = hostname;
        return publicRow;
      },
      findBySlug: async () => publicRow,
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

  it.each(['raymundo-6', 'SQ52LQE9'])(
    'resolves host events by public identifier %s',
    async (identifier) => {
      const findHostRecordByIdentifier = jest.fn().mockResolvedValue(hostRecord);
      const repository = { findHostRecordByIdentifier } as unknown as EventsRepository;
      const result = await new EventsService(repository).hostEvent(identifier);
      expect(findHostRecordByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result.identifier).toBe('raymundo-6');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('ownerUserId');
    },
  );

  it('builds a localized share preview without guest or contact data', async () => {
    const repository = {
      findHostRecordByIdentifier: jest.fn().mockResolvedValue(hostRecord),
    } as unknown as EventsRepository;
    const preview = await new EventsService(repository).invitationSharePreview(
      'raymundo-6',
      'es-MX',
    );
    expect(preview).toMatchObject({
      locale: 'es-MX',
      eventTitle: 'Sexto cumpleaños de Raymundo',
      hostname: 'raymundo6th.domoforge.com',
    });
    expect(preview.smsText).toContain('https://raymundo6th.domoforge.com/i/…');
    expect(preview).not.toHaveProperty('guest');
    expect(preview).not.toHaveProperty('email');
  });

  it('builds dashboard statistics without exposing UUIDs', async () => {
    const repository = {
      listHostRecords: jest.fn().mockResolvedValue([hostRecord]),
    } as unknown as EventsRepository;
    const [summary] = await new EventsService(repository).listHostEvents();
    expect(summary?.title).toContain('Raymundo');
    expect(summary?.statistics).toEqual(
      expect.objectContaining({ guestCount: 4, invitationCount: 3, openedCount: 2 }),
    );
    expect(summary).not.toHaveProperty('id');
  });

  it('updates the event and creates the next revision in the same transaction', async () => {
    const executor = {} as DatabaseExecutor;
    const insertRevision = jest.fn().mockResolvedValue(undefined);
    const repository = {
      transaction: (operation: (value: DatabaseExecutor) => Promise<unknown>) =>
        operation(executor),
      findInternalIdByIdentifier: jest.fn().mockResolvedValue(event.id),
      lockById: jest.fn().mockResolvedValue(true),
      updateEvent: jest.fn().mockResolvedValue(true),
      upsertLocalizations: jest.fn().mockResolvedValue(undefined),
      findHostRecordById: jest.fn().mockResolvedValue(hostRecord),
      insertRevision,
    } as unknown as EventsRepository;
    const result = await new EventsService(repository).updateHostEvent('raymundo-6', update);
    expect(result.revisionNumber).toBe(2);
    expect(insertRevision).toHaveBeenCalledWith(
      event.id,
      2,
      expect.objectContaining({ publicSlug: 'raymundo-6' }),
      executor,
    );
  });
});
