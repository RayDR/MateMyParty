import type {
  DatabaseExecutor,
  eventLocalizations,
  events,
  guests,
  invitationAccessGrants,
  invitations,
} from '@matemyparty/database';
import { ApiError } from '../src/common/api-error';
import { InvitationTokenService } from '../src/invitations/invitation-token.service';
import type { InvitationsRepository } from '../src/invitations/invitations.repository';
import { InvitationsService } from '../src/invitations/invitations.service';
import { PublicInvitationUrlService } from '../src/invitations/public-invitation-url.service';

type GuestRow = typeof guests.$inferSelect;
type InvitationRow = typeof invitations.$inferSelect;
type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;
type GrantRow = typeof invitationAccessGrants.$inferSelect;

const guest: GuestRow = {
  id: '55555555-5555-4555-8555-555555555555',
  eventId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Family Sample',
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
  createdAt: new Date('2026-07-26T00:00:00Z'),
  updatedAt: new Date('2026-07-26T00:00:00Z'),
  archivedAt: null,
};
const event: EventRow = {
  id: guest.eventId,
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  title: 'Birthday',
  celebrantName: 'Raymundo',
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY',
  status: 'DRAFT',
  startsAt: new Date('2026-08-06T18:00:00Z'),
  endsAt: null,
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  publicSlug: 'raymundo-6',
  publicCode: 'SQ52LQE9',
  templateKey: 'kids-night-dragon',
  templateVersion: 1,
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
  hostMessage: null,
  rsvpDeadline: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const localizations: LocalizationRow[] = [
  {
    id: '88888888-8888-4888-8888-888888888881',
    eventId: event.id,
    locale: 'en-US',
    title: 'Raymundo’s 6th Birthday',
    celebrantName: 'Raymundo',
    venueName: 'Celebration Center',
    hostMessage: null,
    arrivalInstructions: null,
    thumbnailAltText: 'Birthday illustration',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '88888888-8888-4888-8888-888888888882',
    eventId: event.id,
    locale: 'es-MX',
    title: 'Sexto cumpleaños de Raymundo',
    celebrantName: 'Raymundo',
    venueName: 'Centro de celebraciones',
    hostMessage: null,
    arrivalInstructions: null,
    thumbnailAltText: 'Ilustración de cumpleaños',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

class MemoryInvitationsRepository {
  invitations: InvitationRow[] = [];
  activities: Array<{ invitationId: string; type: string }> = [];
  grants: GrantRow[] = [];
  guestArchived = false;
  sequence = 0;
  executor = {} as DatabaseExecutor;
  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return operation(this.executor);
  }
  async guestById(id: string) {
    return id === guest.id
      ? { ...guest, archivedAt: this.guestArchived ? new Date() : null }
      : null;
  }
  async findById(id: string) {
    return this.invitations.find((value) => value.id === id) ?? null;
  }
  async findActiveByGuest(id: string) {
    return this.invitations.find((value) => value.guestId === id && !value.revokedAt) ?? null;
  }
  async insert(values: typeof invitations.$inferInsert) {
    const now = new Date();
    const row: InvitationRow = {
      id: `77777777-7777-4777-8777-${String(++this.sequence).padStart(12, '0')}`,
      eventId: values.eventId,
      guestId: values.guestId,
      publicTokenHash: values.publicTokenHash,
      publicTokenPrefix: values.publicTokenPrefix,
      status: values.status ?? 'READY',
      locale: values.locale,
      firstOpenedAt: null,
      lastOpenedAt: null,
      openCount: 0,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    };
    this.invitations.push(row);
    return row;
  }
  async addActivity(invitationId: string, type: string) {
    this.activities.push({ invitationId, type });
  }
  async revoke(id: string) {
    const row = await this.findById(id);
    if (!row || row.revokedAt) return row;
    row.status = 'REVOKED';
    row.revokedAt = new Date();
    return row;
  }
  async revokeAccessGrants(invitationId: string) {
    const now = new Date();
    for (const grant of this.grants) {
      if (grant.invitationId === invitationId && !grant.revokedAt) grant.revokedAt = now;
    }
  }
  async primaryHostname() {
    return 'raymundo6th.domoforge.com';
  }
  async candidatesByPrefix(prefix: string) {
    if (this.guestArchived) return [];
    return this.invitations.filter(
      (value) => value.publicTokenPrefix === prefix && !value.revokedAt,
    );
  }
  async accessGrantCandidates(prefix: string, now: Date) {
    if (this.guestArchived) return [];
    return this.grants
      .filter(
        (grant) => grant.grantTokenPrefix === prefix && !grant.revokedAt && grant.expiresAt > now,
      )
      .flatMap((grant) => {
        const invitation = this.invitations.find(
          (candidate) => candidate.id === grant.invitationId && !candidate.revokedAt,
        );
        return invitation ? [{ grant, invitation }] : [];
      });
  }
  async markAccessGrantUsed(id: string, now: Date) {
    const grant = this.grants.find(
      (candidate) => candidate.id === id && !candidate.revokedAt && candidate.expiresAt > now,
    );
    if (!grant) return false;
    grant.lastUsedAt = now;
    return true;
  }
  async publicDetails(id: string) {
    if (this.guestArchived) return null;
    const invitation = await this.findById(id);
    return invitation
      ? {
          invitation,
          guest,
          event,
          localizations,
          primaryHostname: 'raymundo6th.domoforge.com',
        }
      : null;
  }
  async recordOpen(id: string, now: Date) {
    const row = await this.findById(id);
    if (!row || row.revokedAt) return null;
    row.firstOpenedAt ??= now;
    row.lastOpenedAt = now;
    row.openCount += 1;
    if (row.status === 'READY' || row.status === 'SENT') row.status = 'OPENED';
    return row;
  }
}

describe('InvitationsService lifecycle', () => {
  const originalHostname = process.env.PRIMARY_APP_HOSTNAME;
  beforeEach(() => {
    process.env.PRIMARY_APP_HOSTNAME = 'localhost:3000';
    process.env.PUBLIC_APP_PROTOCOL = 'http';
  });
  afterEach(() => {
    process.env.PRIMARY_APP_HOSTNAME = originalHostname;
  });

  function setup() {
    const repository = new MemoryInvitationsRepository();
    const tokens = new InvitationTokenService();
    const service = new InvitationsService(
      repository as unknown as InvitationsRepository,
      tokens,
      new PublicInvitationUrlService(),
    );
    return { repository, service, tokens };
  }

  it('creates a token once while retaining only its hash', async () => {
    const { repository, service } = setup();
    const result = await service.createForGuest(guest.id);
    expect(result.publicUrl).toBe(`http://localhost:3000/i/${result.token}`);
    expect(repository.invitations[0]!.publicTokenHash).not.toBe(result.token);
    expect(JSON.stringify(repository.invitations[0])).not.toContain(result.token);
  });

  it('allows only one active invitation per guest', async () => {
    const { service } = setup();
    await service.createForGuest(guest.id);
    await expect(service.createForGuest(guest.id)).rejects.toMatchObject({ status: 409 });
  });

  it('does not create invitations for archived guests', async () => {
    const { repository, service } = setup();
    repository.guestArchived = true;
    await expect(service.createForGuest(guest.id)).rejects.toMatchObject({ status: 404 });
  });

  it('tracks first and later openings without changing the first timestamp', async () => {
    const { repository, service } = setup();
    const created = await service.createForGuest(guest.id);
    const first = await service.resolveAndTrack(created.token, {});
    const firstOpenedAt = repository.invitations[0]!.firstOpenedAt;
    expect(first.openedPreviously).toBe(false);
    const second = await service.resolveAndTrack(created.token, {});
    expect(second.openedPreviously).toBe(true);
    expect(repository.invitations[0]!.firstOpenedAt).toEqual(firstOpenedAt);
    expect(repository.invitations[0]!.lastOpenedAt).toBeInstanceOf(Date);
    expect(repository.invitations[0]!.openCount).toBe(2);
  });

  it('renders through a short-lived grant and records the open only when rendered', async () => {
    const { repository, service, tokens } = setup();
    const created = await service.createForGuest(guest.id);
    const generated = tokens.generate();
    repository.grants.push({
      id: '99999999-9999-4999-8999-999999999999',
      invitationId: created.invitation.id,
      grantTokenHash: generated.hash,
      grantTokenPrefix: generated.prefix,
      lookupMethod: 'EMAIL',
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: null,
      createdAt: new Date(),
      revokedAt: null,
    });
    expect(repository.invitations[0]!.openCount).toBe(0);
    await expect(service.resolveGrantAndTrack(generated.token, {})).resolves.toMatchObject({
      guestDisplayName: 'Family Sample',
    });
    expect(repository.invitations[0]!.openCount).toBe(1);
    expect(repository.grants[0]!.lastUsedAt).toBeInstanceOf(Date);
  });

  it.each(['expired', 'revoked'] as const)('rejects a %s access grant neutrally', async (state) => {
    const { repository, service, tokens } = setup();
    const created = await service.createForGuest(guest.id);
    const generated = tokens.generate();
    repository.grants.push({
      id: '99999999-9999-4999-8999-999999999999',
      invitationId: created.invitation.id,
      grantTokenHash: generated.hash,
      grantTokenPrefix: generated.prefix,
      lookupMethod: 'PHONE',
      expiresAt: new Date(Date.now() + (state === 'expired' ? -60_000 : 60_000)),
      lastUsedAt: null,
      createdAt: new Date(),
      revokedAt: state === 'revoked' ? new Date() : null,
    });
    await expect(service.resolveGrantAndTrack(generated.token, {})).rejects.toMatchObject({
      status: 404,
    });
    expect(repository.invitations[0]!.openCount).toBe(0);
  });

  it('invalidates related grants when the invitation is revoked', async () => {
    const { repository, service, tokens } = setup();
    const created = await service.createForGuest(guest.id);
    const generated = tokens.generate();
    repository.grants.push({
      id: '99999999-9999-4999-8999-999999999999',
      invitationId: created.invitation.id,
      grantTokenHash: generated.hash,
      grantTokenPrefix: generated.prefix,
      lookupMethod: 'EMAIL',
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: null,
      createdAt: new Date(),
      revokedAt: null,
    });
    await service.revoke(created.invitation.id);
    expect(repository.grants[0]!.revokedAt).toBeInstanceOf(Date);
    await expect(service.resolveGrantAndTrack(generated.token, {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('uses the same public 404 for unknown and revoked tokens', async () => {
    const { service } = setup();
    await expect(service.resolveAndTrack('A'.repeat(43), {})).rejects.toMatchObject({
      status: 404,
    });
    const created = await service.createForGuest(guest.id);
    await service.revoke(created.invitation.id);
    await expect(service.resolveAndTrack(created.token, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('regenerates historically, disables the previous token, and enables the new token', async () => {
    const { repository, service } = setup();
    const created = await service.createForGuest(guest.id);
    const regenerated = await service.regenerate(created.invitation.id);
    expect(repository.invitations[0]!.status).toBe('REVOKED');
    expect(repository.invitations).toHaveLength(2);
    await expect(service.resolveAndTrack(created.token, {})).rejects.toMatchObject({ status: 404 });
    await expect(service.resolveAndTrack(regenerated.newToken, {})).resolves.toMatchObject({
      guestDisplayName: 'Family Sample',
    });
  });

  it('excludes archived guests from public resolution and regeneration', async () => {
    const { repository, service } = setup();
    const created = await service.createForGuest(guest.id);
    repository.guestArchived = true;
    await expect(service.resolveAndTrack(created.token, {})).rejects.toMatchObject({ status: 404 });
    await expect(service.regenerate(created.invitation.id)).rejects.toMatchObject({ status: 404 });
  });

  it('revokes idempotently without duplicate activity', async () => {
    const { repository, service } = setup();
    const created = await service.createForGuest(guest.id);
    await service.revoke(created.invitation.id);
    await service.revoke(created.invitation.id);
    expect(repository.activities.filter((activity) => activity.type === 'REVOKED')).toHaveLength(1);
  });
});
