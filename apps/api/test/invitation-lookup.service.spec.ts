import type { DatabaseExecutor } from '@matemyparty/database';
import { ApiError } from '../src/common/api-error';
import { InvitationLookupRateLimiter } from '../src/invitations/invitation-lookup-rate-limiter.service';
import type { InvitationLookupRepository } from '../src/invitations/invitation-lookup.repository';
import { InvitationLookupService } from '../src/invitations/invitation-lookup.service';
import type { InvitationsService } from '../src/invitations/invitations.service';

const invitationId = '77777777-7777-4777-8777-777777777777';

class MemoryLookupRepository {
  executor = {} as DatabaseExecutor;
  grant: {
    invitationId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null = null;
  match = true;
  lastMatch:
    | { publicSlug: string; displayName: string; contact: { email: string } | { phone: string } }
    | undefined;

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return operation(this.executor);
  }

  async findMatches(
    publicSlug: string,
    displayName: string,
    contact: { email: string } | { phone: string },
  ) {
    this.lastMatch = { publicSlug, displayName, contact };
    return this.match ? [{ invitationId, locale: 'en-US' }] : [];
  }

  async replaceGrant(id: string, tokenHash: string, expiresAt: Date) {
    this.grant = { invitationId: id, tokenHash, expiresAt, revokedAt: null };
  }

  async findActiveGrant(tokenHash: string, now: Date) {
    return this.grant &&
      this.grant.tokenHash === tokenHash &&
      !this.grant.revokedAt &&
      this.grant.expiresAt > now
      ? { invitationId: this.grant.invitationId }
      : null;
  }
}

function setup() {
  const repository = new MemoryLookupRepository();
  const invitations = {
    resolveInvitationAndTrack: jest.fn().mockResolvedValue({ guestDisplayName: 'Family Sample' }),
  };
  const service = new InvitationLookupService(
    repository as unknown as InvitationLookupRepository,
    invitations as unknown as InvitationsService,
    new InvitationLookupRateLimiter(),
  );
  return { invitations, repository, service };
}

describe('InvitationLookupService', () => {
  afterEach(() => jest.useRealTimers());

  it('normalizes exact name and email matching and stores only a short-lived grant hash', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-26T20:00:00Z'));
    const { repository, service } = setup();
    const result = await service.lookup(
      {
        publicSlug: 'Raymundo-6',
        displayName: '  Family   Sample ',
        contact: ' Guest@Example.TEST ',
      },
      '203.0.113.10',
    );

    expect(repository.lastMatch).toEqual({
      publicSlug: 'raymundo-6',
      displayName: 'family sample',
      contact: { email: 'guest@example.test' },
    });
    expect(repository.grant?.tokenHash).not.toBe(result.grant);
    expect(JSON.stringify(repository.grant)).not.toContain(result.grant);
    expect(result.expiresAt).toBe('2026-07-26T20:10:00.000Z');
  });

  it('uses the same generic failure for name-only and unknown lookups', async () => {
    const { repository, service } = setup();
    await expect(
      service.lookup(
        { publicSlug: 'raymundo-6', displayName: 'Family Sample', contact: '' },
        '203.0.113.11',
      ),
    ).rejects.toMatchObject({ status: 404 });
    repository.match = false;
    await expect(
      service.lookup(
        {
          publicSlug: 'raymundo-6',
          displayName: 'Unknown Family',
          contact: 'unknown@example.test',
        },
        '203.0.113.12',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects an expired grant without needing a permanent invitation token', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-26T20:00:00Z'));
    const { invitations, service } = setup();
    const result = await service.lookup(
      {
        publicSlug: 'raymundo-6',
        displayName: 'Family Sample',
        contact: 'guest@example.test',
      },
      '203.0.113.13',
    );
    await expect(service.resolve(result.grant, {})).resolves.toMatchObject({
      guestDisplayName: 'Family Sample',
    });
    expect(invitations.resolveInvitationAndTrack).toHaveBeenCalledWith(
      invitationId,
      {},
      expect.anything(),
    );
    jest.setSystemTime(new Date('2026-07-26T20:11:00Z'));
    await expect(service.resolve(result.grant, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('rate limits repeated verification attempts per hashed client address', async () => {
    const { repository, service } = setup();
    repository.match = false;
    const input = {
      publicSlug: 'raymundo-6',
      displayName: 'Unknown Family',
      contact: 'unknown@example.test',
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.lookup(input, '203.0.113.14')).rejects.toMatchObject({ status: 404 });
    }
    await expect(service.lookup(input, '203.0.113.14')).rejects.toMatchObject({ status: 429 });
  });
});
