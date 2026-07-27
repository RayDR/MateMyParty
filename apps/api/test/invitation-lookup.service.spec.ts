import type { DatabaseExecutor } from '@matemyparty/database';
import { InvitationLookupRateLimiter } from '../src/invitations/invitation-lookup-rate-limiter';
import { InvitationLookupService } from '../src/invitations/invitation-lookup.service';
import { InvitationTokenService } from '../src/invitations/invitation-token.service';
import type { InvitationsRepository } from '../src/invitations/invitations.repository';

class LookupRepository {
  executor = {} as DatabaseExecutor;
  match = true;
  archived = false;
  revoked = false;
  inserted: Record<string, unknown> | null = null;
  opens = 0;
  lastLookup: unknown[] = [];

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return operation(this.executor);
  }

  async findLookupMatch(...values: unknown[]) {
    this.lastLookup = values.slice(0, 4);
    return this.match && !this.archived && !this.revoked
      ? { invitation: { id: '77777777-7777-4777-8777-777777777777' } }
      : null;
  }

  async cleanupAccessGrants() {}

  async insertAccessGrant(values: Record<string, unknown>) {
    this.inserted = values;
    return values;
  }
}

function setup(maximumAttempts = 100) {
  const repository = new LookupRepository();
  const service = new InvitationLookupService(
    repository as unknown as InvitationsRepository,
    new InvitationTokenService(),
    new InvitationLookupRateLimiter(maximumAttempts, 600_000),
  );
  return { repository, service };
}

const base = {
  eventIdentifier: 'raymundo-6',
  displayName: ' Family   Sample ',
};

describe('InvitationLookupService', () => {
  it('stores only a privacy-preserving rate-limit key', () => {
    const limiter = new InvitationLookupRateLimiter();
    limiter.consume('192.0.2.88');
    const buckets = (limiter as unknown as { buckets: Map<string, unknown> }).buckets;
    const [storedKey] = buckets.keys();
    expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
    expect(storedKey).not.toContain('192.0.2.88');
  });

  it('rejects name-only lookup with the same generic result', async () => {
    const { repository, service } = setup();
    await expect(service.lookup(base, '192.0.2.1')).resolves.toEqual({ verified: false });
    expect(repository.inserted).toBeNull();
  });

  it('does not reveal a valid email when the name is wrong', async () => {
    const { repository, service } = setup();
    repository.match = false;
    await expect(
      service.lookup(
        { ...base, displayName: 'Wrong Family', method: 'EMAIL', contact: 'guest@example.test' },
        '192.0.2.2',
      ),
    ).resolves.toEqual({ verified: false });
  });

  it.each([
    ['EMAIL', ' Guest@Example.TEST ', 'guest@example.test'],
    ['PHONE', ' +1 (214) 555-0100 ', '+12145550100'],
  ] as const)('normalizes and verifies a full %s lookup', async (method, contact, normalized) => {
    const { repository, service } = setup();
    const result = await service.lookup({ ...base, method, contact }, '192.0.2.3');
    expect(result).toMatchObject({ verified: true });
    expect(repository.lastLookup).toEqual(['raymundo-6', 'family sample', method, normalized]);
    expect(repository.opens).toBe(0);
  });

  it.each(['archived', 'revoked'] as const)(
    'excludes a guest with %s access state',
    async (state) => {
      const { repository, service } = setup();
      repository[state] = true;
      await expect(
        service.lookup({ ...base, method: 'EMAIL', contact: 'guest@example.test' }, '192.0.2.4'),
      ).resolves.toEqual({ verified: false });
    },
  );

  it('stores only the grant hash and never returns the permanent invitation token', async () => {
    const { repository, service } = setup();
    const result = await service.lookup(
      { ...base, method: 'EMAIL', contact: 'guest@example.test' },
      '192.0.2.5',
    );
    expect(result.verified).toBe(true);
    if (!result.verified) throw new Error('Expected a verified lookup');
    expect(repository.inserted?.grantTokenHash).not.toBe(result.grantToken);
    expect(JSON.stringify(repository.inserted)).not.toContain(result.grantToken);
    expect(result).not.toHaveProperty('permanentToken');
    expect(result).not.toHaveProperty('invitationId');
    expect(repository.inserted).not.toHaveProperty('email');
    expect(repository.inserted).not.toHaveProperty('phone');
    expect(repository.inserted).not.toHaveProperty('displayName');
  });

  it('does not write raw lookup values or grant tokens to console output', async () => {
    const spies = ['log', 'info', 'warn', 'error'].map((method) =>
      jest.spyOn(console, method as 'log').mockImplementation(() => undefined),
    );
    const { service } = setup();
    await service.lookup(
      { ...base, method: 'EMAIL', contact: 'private-address@example.test' },
      '192.0.2.6',
    );
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });

  it('rate limits repeated attempts using a generic error', async () => {
    const { service } = setup(2);
    const input = { ...base, method: 'EMAIL', contact: 'guest@example.test' };
    await service.lookup(input, '192.0.2.7');
    await service.lookup(input, '192.0.2.7');
    await expect(service.lookup(input, '192.0.2.7')).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({ message: 'Invitation could not be verified' }),
    });
  });
});
