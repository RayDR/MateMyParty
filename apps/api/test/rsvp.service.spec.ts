import type { DatabaseExecutor, rsvps } from '@matemyparty/database';
import { ApiError } from '../src/common/api-error';
import type { EventsRepository } from '../src/events/events.repository';
import type { InvitationsService } from '../src/invitations/invitations.service';
import { RsvpRateLimiter } from '../src/rsvp/rsvp-rate-limiter';
import type { RsvpRepository } from '../src/rsvp/rsvp.repository';
import { RsvpService } from '../src/rsvp/rsvp.service';

type RsvpRow = typeof rsvps.$inferSelect;
const invitationId = '77777777-7777-4777-8777-777777777777';
const guestId = '55555555-5555-4555-8555-555555555555';
const eventId = '22222222-2222-4222-8222-222222222222';

class MemoryRsvpRepository {
  row: RsvpRow | null = null;
  history: RsvpRow[] = [];
  lockCount = 0;
  mode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN' = 'TOTAL_ONLY';
  executor = {} as DatabaseExecutor;

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return operation(this.executor);
  }
  async lockInvitation() {
    this.lockCount += 1;
    return true;
  }
  async context() {
    return {
      invitation: { id: invitationId },
      guest: {
        id: guestId,
        invitationCountMode: this.mode,
        totalInvited: 4,
        adultsInvited: this.mode === 'ADULTS_AND_CHILDREN' ? 2 : null,
        childrenInvited: this.mode === 'ADULTS_AND_CHILDREN' ? 2 : null,
      },
    };
  }
  async current() {
    return this.row;
  }
  async insert(values: Partial<RsvpRow>) {
    const now = new Date('2026-07-27T01:00:00.000Z');
    this.row = {
      id: '99999999-9999-4999-8999-999999999999',
      invitationId,
      status: values.status!,
      totalAttending: values.totalAttending ?? null,
      adultsAttending: values.adultsAttending ?? null,
      childrenAttending: values.childrenAttending ?? null,
      dietaryNotes: values.dietaryNotes ?? null,
      guestMessage: values.guestMessage ?? null,
      respondedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    return this.row;
  }
  async update(_id: string, values: Partial<RsvpRow>) {
    this.row = {
      ...this.row!,
      ...values,
      updatedAt: new Date(this.row!.updatedAt.getTime() + 1000),
    };
    return this.row;
  }
  async addHistory(row: RsvpRow) {
    this.history.push({ ...row });
  }
  async eventResponses() {
    return [
      { rsvp: this.row },
      { rsvp: null },
      { rsvp: { ...this.row!, status: 'DECLINED' as const, totalAttending: null } },
      { rsvp: { ...this.row!, status: 'NOT_SURE' as const, totalAttending: null } },
      { rsvp: { ...this.row!, status: 'CANCELLED' as const, totalAttending: null } },
    ];
  }
}

function setup() {
  const repository = new MemoryRsvpRepository();
  const invitations = {
    resolveAccess: jest.fn().mockResolvedValue({ id: invitationId }),
  } as unknown as InvitationsService;
  const events = {
    findInternalIdByIdentifier: jest.fn().mockResolvedValue(eventId),
  } as unknown as EventsRepository;
  const service = new RsvpService(repository as unknown as RsvpRepository, invitations, events);
  return { repository, invitations, service };
}

describe('RsvpService', () => {
  it('represents pending as no row and accepts a bounded total-only response', async () => {
    const { repository, service } = setup();
    await expect(service.current({ permanentToken: 'token' })).resolves.toBeNull();
    await expect(
      service.create(
        { permanentToken: 'token' },
        {
          status: 'ACCEPTED',
          totalAttending: 3,
          dietaryNotes: ' No peanuts ',
          guestMessage: ' Thank you ',
        },
      ),
    ).resolves.toMatchObject({
      status: 'ACCEPTED',
      totalAttending: 3,
      adultsAttending: null,
      dietaryNotes: 'No peanuts',
      guestMessage: 'Thank you',
    });
    expect(repository.lockCount).toBe(1);
    expect(repository.history).toHaveLength(1);
  });

  it('rejects over-capacity, zero, and wrong-mode attendance', async () => {
    const { service } = setup();
    for (const payload of [
      { status: 'ACCEPTED', totalAttending: 5 },
      { status: 'ACCEPTED', totalAttending: 0 },
      { status: 'ACCEPTED', totalAttending: 2, adultsAttending: 1 },
    ]) {
      await expect(service.create({ permanentToken: 'token' }, payload)).rejects.toMatchObject({
        status: 400,
      });
    }
  });

  it('enforces adult/child bounds and derives the total', async () => {
    const { repository, service } = setup();
    repository.mode = 'ADULTS_AND_CHILDREN';
    await expect(
      service.create(
        { grantToken: 'grant' },
        { status: 'ACCEPTED', adultsAttending: 2, childrenAttending: 1 },
      ),
    ).resolves.toMatchObject({
      totalAttending: 3,
      adultsAttending: 2,
      childrenAttending: 1,
    });
    const second = setup();
    second.repository.mode = 'ADULTS_AND_CHILDREN';
    await expect(
      second.service.create(
        { grantToken: 'grant' },
        { status: 'ACCEPTED', adultsAttending: 3, childrenAttending: 0 },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('clears attendance when declining and blocks duplicate creation', async () => {
    const { repository, service } = setup();
    await service.create({ permanentToken: 'token' }, { status: 'DECLINED', totalAttending: 4 });
    expect(repository.row).toMatchObject({
      status: 'DECLINED',
      totalAttending: null,
      adultsAttending: null,
      childrenAttending: null,
    });
    await expect(
      service.create({ permanentToken: 'token' }, { status: 'NOT_SURE' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('clears attendance for an explicit not-sure response', async () => {
    const { repository, service } = setup();
    await service.create(
      { permanentToken: 'token' },
      { status: 'NOT_SURE', totalAttending: 4, adultsAttending: 2, childrenAttending: 2 },
    );
    expect(repository.row).toMatchObject({
      status: 'NOT_SURE',
      totalAttending: null,
      adultsAttending: null,
      childrenAttending: null,
    });
  });

  it('records only meaningful updates and supports cancellation after acceptance', async () => {
    const { repository, service } = setup();
    const payload = { status: 'ACCEPTED' as const, totalAttending: 2 };
    await service.create({ permanentToken: 'token' }, payload);
    await service.update({ permanentToken: 'token' }, payload);
    expect(repository.history).toHaveLength(1);
    await service.update({ permanentToken: 'token' }, { ...payload, totalAttending: 3 });
    expect(repository.history).toHaveLength(2);
    await expect(service.cancel({ permanentToken: 'token' }, {})).resolves.toMatchObject({
      status: 'CANCELLED',
      totalAttending: null,
    });
    expect(repository.history.map((entry) => entry.status)).toEqual([
      'ACCEPTED',
      'ACCEPTED',
      'CANCELLED',
    ]);
  });

  it('does not allow cancellation before an accepted response', async () => {
    const { service } = setup();
    await service.create({ permanentToken: 'token' }, { status: 'DECLINED' });
    await expect(service.cancel({ permanentToken: 'token' }, {})).rejects.toMatchObject({
      status: 409,
    });
  });

  it('calculates operational host statistics from current responses only', async () => {
    const { service } = setup();
    await service.create({ permanentToken: 'token' }, { status: 'ACCEPTED', totalAttending: 3 });
    await expect(service.statistics('raymundo-6')).resolves.toEqual({
      pending: 1,
      accepted: 1,
      declined: 1,
      notSure: 1,
      cancelled: 1,
      confirmedTotal: 3,
      confirmedAdults: 0,
      confirmedChildren: 0,
      invitationsWithoutResponse: 1,
    });
  });

  it('passes opaque grant access to the invitation resolver without returning it', async () => {
    const { invitations, service } = setup();
    const result = await service.current({ grantToken: 'opaque-grant' });
    expect(invitations.resolveAccess).toHaveBeenCalledWith(
      undefined,
      'opaque-grant',
      expect.anything(),
    );
    expect(JSON.stringify(result)).not.toContain('opaque-grant');
  });

  it.each(['invalid', 'revoked', 'archived', 'expired'])(
    'propagates the same neutral invitation error for %s access',
    async () => {
      const { invitations, service } = setup();
      jest
        .mocked(invitations.resolveAccess)
        .mockRejectedValue(new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found'));
      await expect(service.current({ permanentToken: 'invalid' })).rejects.toMatchObject({
        status: 404,
      });
    },
  );
});

describe('RsvpRateLimiter', () => {
  it('limits a privacy-hashed credential bucket within the window', () => {
    const limiter = RsvpRateLimiter.createForTesting({
      maximumAttempts: 2,
      windowMilliseconds: 60_000,
      now: () => 1000,
    });
    expect(limiter.consume('127.0.0.1|secret')).toBe(true);
    expect(limiter.consume('127.0.0.1|secret')).toBe(true);
    expect(limiter.consume('127.0.0.1|secret')).toBe(false);
    expect(limiter.consume('127.0.0.1|other')).toBe(true);
  });
});
