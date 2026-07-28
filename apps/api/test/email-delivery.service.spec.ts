import type {
  DatabaseExecutor,
  emailDeliveryAttempts,
  events,
  guests,
  invitations,
} from '@matemyparty/database';
import { EmailDeliveryRepository } from '../src/email/email-delivery.repository';
import { EmailDeliveryService } from '../src/email/email-delivery.service';
import type { EmailProvider } from '../src/email/email-provider';
import { EmailConcurrencyGate, EmailRateLimiter } from '../src/email/email-rate-limiter';
import { EventsRepository } from '../src/events/events.repository';
import { presentInvitation } from '../src/guests/guest.presenter';
import { InvitationsRepository } from '../src/invitations/invitations.repository';
import { InvitationsService } from '../src/invitations/invitations.service';

type AttemptRow = typeof emailDeliveryAttempts.$inferSelect;
type EventRow = typeof events.$inferSelect;
type GuestRow = typeof guests.$inferSelect;
type InvitationRow = typeof invitations.$inferSelect;

const now = new Date('2026-07-27T00:00:00.000Z');
const event = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Raymundo birthday',
  status: 'PUBLISHED',
  startsAt: new Date('2026-08-06T18:00:00.000Z'),
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: null,
  addressLine1: null,
  city: null,
  region: null,
  hostMessage: null,
  publicThumbnailRef: null,
} as EventRow;
const guest = {
  id: '55555555-5555-4555-8555-555555555555',
  eventId: event.id,
  displayName: 'Sample family',
  contactName: null,
  email: 'guest@example.test',
  phone: null,
  preferredChannel: 'EMAIL',
  locale: 'en-US',
  invitationCountMode: 'TOTAL_ONLY',
  totalInvited: 2,
  adultsInvited: null,
  childrenInvited: null,
  privateNotes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
} as GuestRow;
const invitation = {
  id: '77777777-7777-4777-8777-777777777777',
  eventId: event.id,
  guestId: guest.id,
  publicTokenHash: 'a'.repeat(64),
  publicTokenPrefix: '12345678',
  status: 'READY',
  locale: 'en-US',
  firstOpenedAt: null,
  lastOpenedAt: null,
  openCount: 0,
  createdAt: now,
  updatedAt: now,
  revokedAt: null,
} as InvitationRow;

function attemptRow(values: typeof emailDeliveryAttempts.$inferInsert): AttemptRow {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    invitationId: values.invitationId,
    guestId: values.guestId,
    eventId: values.eventId,
    channel: values.channel ?? 'EMAIL',
    status: values.status ?? 'QUEUED',
    provider: values.provider,
    providerMessageId: null,
    providerStatus: null,
    attemptNumber: values.attemptNumber,
    recipientHash: values.recipientHash,
    locale: values.locale,
    subjectSnapshot: values.subjectSnapshot,
    templateVersion: values.templateVersion,
    idempotencyKey: values.idempotencyKey,
    retryable: false,
    safeErrorCode: null,
    safeErrorMessage: null,
    queuedAt: now,
    sentAt: null,
    deliveredAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

type ProviderResult = Awaited<ReturnType<EmailProvider['send']>>;

function setup(options?: {
  existingInvitation?: InvitationRow;
  providerResult?: ProviderResult;
  seedStatuses?: AttemptRow['status'][];
}) {
  const invitationRows: InvitationRow[] = options?.existingInvitation
    ? [options.existingInvitation]
    : [];
  const attempts: AttemptRow[] = (options?.seedStatuses ?? []).map((status, index) => ({
    ...attemptRow({
      invitationId: options?.existingInvitation?.id ?? invitation.id,
      guestId: guest.id,
      eventId: event.id,
      provider: 'smtp',
      attemptNumber: index + 1,
      recipientHash: 'a'.repeat(64),
      locale: 'en-US',
      subjectSnapshot: 'Invitation: Raymundo birthday',
      templateVersion: 1,
      idempotencyKey: `123e4567-e89b-42d3-a456-42661417400${index}`,
    }),
    id: `99999999-9999-4999-8999-${String(index + 1).padStart(12, '0')}`,
    status,
    retryable: status === 'FAILED',
    failedAt: status === 'FAILED' ? now : null,
    sentAt: status === 'SENT' || status === 'DELIVERED' ? now : null,
    deliveredAt: status === 'DELIVERED' ? now : null,
  }));
  const repository = {
    transaction: <T>(operation: (executor: DatabaseExecutor) => Promise<T>) =>
      operation({} as DatabaseExecutor),
    lockGuest: async () => true,
    byIdempotencyKey: async (key: string) =>
      attempts.find((candidate) => candidate.idempotencyKey === key) ?? null,
    latestForGuest: async () => attempts.at(-1) ?? null,
    guestById: async () => guest,
    guestsForEvent: async () => [guest],
    nextAttemptNumber: async () => attempts.length + 1,
    insert: async (values: typeof emailDeliveryAttempts.$inferInsert) => {
      const row = {
        ...attemptRow(values),
        id: `99999999-9999-4999-8999-${String(attempts.length + 1).padStart(12, '0')}`,
      };
      attempts.push(row);
      return row;
    },
    markSending: async (id: string) => updateAttempt(attempts, id, { status: 'SENDING' }),
    markSent: async (
      id: string,
      result: { providerMessageId: string | null; providerStatus: string },
    ) =>
      updateAttempt(attempts, id, {
        status: 'SENT',
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus,
        sentAt: now,
      })!,
    markFailed: async (
      id: string,
      result: {
        providerStatus: string;
        retryable: boolean;
        safeErrorCode: string;
        safeErrorMessage: string;
      },
    ) =>
      updateAttempt(attempts, id, {
        status: 'FAILED',
        providerStatus: result.providerStatus,
        retryable: result.retryable,
        safeErrorCode: result.safeErrorCode,
        safeErrorMessage: result.safeErrorMessage,
        failedAt: now,
      })!,
    historyForGuest: async () => [...attempts].reverse(),
    statusCounts: async () =>
      [...new Set(attempts.map((row) => row.status))].map((status) => ({
        status,
        value: attempts.filter((row) => row.status === status).length,
      })),
  } as unknown as EmailDeliveryRepository;
  const record = {
    event,
    localizations: [],
    primaryHostname: 'raymundo6th.domoforge.com',
  };
  const events = {
    findHostRecordById: async () => record,
    findHostRecordByIdentifier: async () => record,
  } as unknown as EventsRepository;
  const invitationRepository = {
    findActiveByGuest: async () => invitationRows.find((row) => !row.revokedAt) ?? null,
    findLatestByGuest: async () => invitationRows.at(-1) ?? null,
    findById: async (id: string) => invitationRows.find((row) => row.id === id) ?? null,
    markSent: async (id: string) => {
      const row = invitationRows.find((candidate) => candidate.id === id);
      if (row) row.status = 'SENT';
      return row ?? null;
    },
  } as unknown as InvitationsRepository;
  const generatedInvitation = (sequence: number): InvitationRow => ({
    ...invitation,
    id:
      sequence === 1
        ? invitation.id
        : `88888888-8888-4888-8888-${String(sequence).padStart(12, '0')}`,
  });
  const generate = async () => {
    const row = generatedInvitation(invitationRows.length + 1);
    invitationRows.push(row);
    return {
      guest,
      invitation: presentInvitation(row),
      publicUrl: 'https://raymundo6th.domoforge.com/i/raw-private-token',
      token: 'raw-private-token',
    };
  };
  const invitations = {
    createForGuestInTransaction: generate,
    regenerateInTransaction: async (id: string) => {
      const previous = invitationRows.find((row) => row.id === id);
      if (previous) {
        previous.status = 'REVOKED';
        previous.revokedAt = now;
      }
      const created = await generate();
      return {
        invitation: created.invitation,
        publicUrl: created.publicUrl,
        newToken: created.token,
      };
    },
  } as unknown as InvitationsService;
  const send = jest.fn(
    async () =>
      options?.providerResult ?? {
        accepted: true,
        providerMessageId: 'provider-id',
        providerStatus: 'ACCEPTED',
        retryable: false,
        safeErrorCode: null,
        safeErrorMessage: null,
      },
  );
  const provider = { name: 'stub', enabled: () => true, send } satisfies EmailProvider;
  const gate = {
    run: <T>(operation: () => Promise<T>) => operation(),
  } as EmailConcurrencyGate;
  return {
    service: new EmailDeliveryService(
      provider,
      repository,
      events,
      invitationRepository,
      invitations,
      { assertAllowed: jest.fn() } as unknown as EmailRateLimiter,
      gate,
    ),
    attempts,
    invitationRows,
    send,
  };
}

function updateAttempt(
  attempts: AttemptRow[],
  id: string,
  values: Partial<AttemptRow>,
): AttemptRow | null {
  const index = attempts.findIndex((candidate) => candidate.id === id);
  if (index < 0) return null;
  attempts[index] = { ...attempts[index]!, ...values, updatedAt: now };
  return attempts[index]!;
}

describe('EmailDeliveryService workflow', () => {
  it('queues token-free audit state and calls the provider only once for a repeated key', async () => {
    const { service, attempts, send } = setup();
    const input = { idempotencyKey: '123e4567-e89b-42d3-a456-426614174010' };
    const first = await service.send(guest.id, input);
    const repeated = await service.send(guest.id, input);
    expect(first).toMatchObject({ duplicate: false, attempt: { status: 'SENT' } });
    expect(repeated).toMatchObject({ duplicate: true, attempt: { status: 'SENT' } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(attempts[0]).not.toHaveProperty('recipient');
    expect(JSON.stringify(attempts)).not.toContain('raw-private-token');
    expect(JSON.stringify(attempts)).not.toContain(guest.email!);
  });

  it('persists a sanitized FAILED result without leaking the provider exception', async () => {
    const { service, attempts } = setup({
      providerResult: {
        accepted: false,
        providerMessageId: null,
        providerStatus: 'FAILED',
        retryable: true,
        safeErrorCode: 'SMTP_TEMPORARY_FAILURE',
        safeErrorMessage: 'The mail server is temporarily unavailable.',
      },
    });
    const result = await service.send(guest.id, {
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174011',
    });
    expect(result.attempt).toMatchObject({
      status: 'FAILED',
      retryable: true,
      safeErrorCode: 'SMTP_TEMPORARY_FAILURE',
    });
    expect(attempts[0]?.failedAt).toEqual(now);
  });

  it('rejects revoked or unrecoverable links until explicit regeneration is requested', async () => {
    const revoked = { ...invitation, status: 'REVOKED', revokedAt: now } as InvitationRow;
    const revokedHarness = setup({ existingInvitation: revoked });
    await expect(
      revokedHarness.service.send(guest.id, {
        idempotencyKey: '123e4567-e89b-42d3-a456-426614174012',
      }),
    ).rejects.toThrow('revoked invitation must be regenerated');
    expect(revokedHarness.send).not.toHaveBeenCalled();

    const activeHarness = setup({ existingInvitation: { ...invitation } });
    await expect(
      activeHarness.service.send(guest.id, {
        idempotencyKey: '123e4567-e89b-42d3-a456-426614174013',
      }),
    ).rejects.toThrow('Regeneration is required');
  });

  it('retries by preserving the failure and creating a new attempt plus rotated invitation', async () => {
    const harness = setup({ existingInvitation: { ...invitation }, seedStatuses: ['FAILED'] });
    const result = await harness.service.send(guest.id, {
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174014',
      regenerate: true,
    });
    expect(result.attempt).toMatchObject({ status: 'SENT', attemptNumber: 2 });
    expect(harness.attempts).toHaveLength(2);
    expect(harness.invitationRows[0]?.revokedAt).toEqual(now);
    expect(harness.invitationRows[1]?.id).not.toBe(invitation.id);
  });

  it('keeps preview and test email out of guest delivery history', async () => {
    const harness = setup();
    const preview = await harness.service.preview(guest.id, 'es-MX');
    expect(preview).toMatchObject({ locale: 'es-MX', usesPlaceholderLink: true });
    expect(harness.attempts).toHaveLength(0);
    const testResult = await harness.service.test(event.id, {
      email: 'host@example.test',
      locale: 'en-US',
    });
    expect(testResult.accepted).toBe(true);
    expect(harness.attempts).toHaveLength(0);
    expect(harness.send).toHaveBeenCalledTimes(1);
  });

  it('returns event statistics from preserved attempts and current eligibility', async () => {
    const harness = setup({ seedStatuses: ['SENT', 'FAILED', 'DELIVERED'] });
    await expect(harness.service.statistics(event.id)).resolves.toMatchObject({
      eligibleGuests: 1,
      ineligibleGuests: 0,
      sent: 1,
      failed: 1,
      delivered: 1,
    });
  });
});
