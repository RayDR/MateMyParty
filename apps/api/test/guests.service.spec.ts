import type { HostGuest } from '@matemyparty/contracts';
import type { DatabaseConnection, DatabaseExecutor, guests } from '@matemyparty/database';
import { presentGuest } from '../src/guests/guest.presenter';
import type { GuestsRepository } from '../src/guests/guests.repository';
import { calculateGuestInvitationStatistics, GuestsService } from '../src/guests/guests.service';
import type { EventsRepository } from '../src/events/events.repository';
import type { InvitationsRepository } from '../src/invitations/invitations.repository';
import type { InvitationsService } from '../src/invitations/invitations.service';
import type { EmailDeliveryService } from '../src/email/email-delivery.service';

type GuestRow = typeof guests.$inferSelect;

const eventId = '22222222-2222-4222-8222-222222222222';
const guestId = '55555555-5555-4555-8555-555555555555';

function setup() {
  const executor = {} as DatabaseExecutor;
  let row: GuestRow | null = null;
  const connection = {
    db: {
      transaction: (operation: (value: DatabaseExecutor) => Promise<unknown>) =>
        operation(executor),
    },
  } as unknown as DatabaseConnection;
  const events = {
    findInternalIdByIdentifier: jest.fn().mockResolvedValue(eventId),
  } as unknown as EventsRepository;
  const repository = {
    insert: jest.fn().mockImplementation(async (_eventId: string, value: Omit<GuestRow, 'id'>) => {
      const now = new Date('2026-07-26T00:00:00.000Z');
      row = {
        ...value,
        id: guestId,
        eventId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      } as GuestRow;
      return row;
    }),
    findById: jest
      .fn()
      .mockImplementation(async (_id: string, includeArchived: boolean) =>
        row && (includeArchived || !row.archivedAt) ? row : null,
      ),
    update: jest.fn().mockImplementation(async (_id: string, value: Partial<GuestRow>) => {
      row = row ? { ...row, ...value, updatedAt: new Date() } : null;
      return row;
    }),
    archive: jest.fn().mockImplementation(async () => {
      row = row ? { ...row, archivedAt: new Date(), updatedAt: new Date() } : null;
      return row;
    }),
    restore: jest.fn().mockImplementation(async () => {
      row = row ? { ...row, archivedAt: null, updatedAt: new Date() } : null;
      return row;
    }),
  } as unknown as GuestsRepository;
  const invitationsRepository = {
    findLatestByGuest: jest.fn().mockResolvedValue(null),
  } as unknown as InvitationsRepository;
  const invitations = {} as InvitationsService;
  const emailDelivery = {
    guestSummary: jest.fn(),
  } as unknown as EmailDeliveryService;
  return {
    service: new GuestsService(
      connection,
      events,
      repository,
      invitationsRepository,
      invitations,
      emailDelivery,
    ),
    current: () => row,
  };
}

describe('GuestsService', () => {
  it('creates, edits, archives, and restores a guest while deriving counts', async () => {
    const { service } = setup();
    const created = await service.create('raymundo-6', {
      displayName: ' Family Sample ',
      contactName: null,
      email: null,
      phone: null,
      preferredChannel: 'MANUAL',
      locale: 'en-US',
      invitationCountMode: 'TOTAL_ONLY',
      totalInvited: 4,
      adultsInvited: null,
      childrenInvited: null,
      privateNotes: null,
      createInvitation: false,
    });
    expect(created).toMatchObject({
      displayName: 'Family Sample',
      totalInvited: 4,
      notificationEligibility: { canNotifyAutomatically: false, reason: 'NO_CONTACT' },
    });

    const updated = await service.update(guestId, {
      invitationCountMode: 'ADULTS_AND_CHILDREN',
      adultsInvited: 2,
      childrenInvited: 3,
    });
    expect(updated).toMatchObject({ totalInvited: 5, adultsInvited: 2, childrenInvited: 3 });

    expect((await service.archive(guestId)).archivedAt).not.toBeNull();
    expect((await service.restore(guestId)).archivedAt).toBeNull();
  });

  it('reports automatic notification eligibility for a validated email channel', () => {
    const now = new Date();
    const row = {
      id: guestId,
      eventId,
      displayName: 'Email guest',
      contactName: null,
      email: 'guest@example.test',
      phone: null,
      preferredChannel: 'EMAIL',
      locale: 'en-US',
      invitationCountMode: 'TOTAL_ONLY',
      totalInvited: 1,
      adultsInvited: null,
      childrenInvited: null,
      privateNotes: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    } satisfies GuestRow;
    expect(presentGuest(row, null).notificationEligibility).toEqual({
      canNotifyAutomatically: true,
      canEmail: true,
      canSms: false,
      reason: 'ELIGIBLE',
    });
  });
});

describe('guest invitation dashboard statistics', () => {
  it('counts active guests, people, lifecycle states, and notification gaps', () => {
    const base = {
      id: guestId,
      displayName: 'Family',
      contactName: null,
      email: null,
      phone: null,
      preferredChannel: 'MANUAL',
      locale: 'en-US',
      invitationCountMode: 'TOTAL_ONLY',
      totalInvited: 4,
      adultsInvited: null,
      childrenInvited: null,
      privateNotes: null,
      notificationEligibility: {
        canNotifyAutomatically: false,
        canEmail: false,
        canSms: false,
        reason: 'NO_CONTACT',
      },
      invitation: null,
      createdAt: '2026-07-26T00:00:00.000Z',
      updatedAt: '2026-07-26T00:00:00.000Z',
      archivedAt: null,
    } satisfies HostGuest;
    const opened: HostGuest = {
      ...base,
      id: '66666666-6666-4666-8666-666666666666',
      totalInvited: 2,
      notificationEligibility: {
        canNotifyAutomatically: true,
        canEmail: true,
        canSms: false,
        reason: 'ELIGIBLE',
      },
      invitation: {
        id: '77777777-7777-4777-8777-777777777777',
        status: 'OPENED',
        locale: 'en-US',
        tokenPrefix: 'abcdefgh',
        firstOpenedAt: '2026-07-26T01:00:00.000Z',
        lastOpenedAt: '2026-07-26T01:00:00.000Z',
        openCount: 1,
        createdAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-26T01:00:00.000Z',
        revokedAt: null,
      },
    };
    const archived = {
      ...base,
      id: '88888888-8888-4888-8888-888888888888',
      archivedAt: '2026-07-26T02:00:00.000Z',
    };
    expect(calculateGuestInvitationStatistics([base, opened, archived])).toEqual({
      totalGuests: 2,
      totalPeopleInvited: 6,
      generated: 1,
      notGenerated: 1,
      opened: 1,
      notOpened: 0,
      revoked: 0,
      notContactable: 1,
    });
  });
});
