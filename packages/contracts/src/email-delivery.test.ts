import { describe, expect, it } from 'vitest';
import { sendInvitationEmailInputSchema, sendTestEmailInputSchema } from './email-delivery.js';
import { emailDeliveryAttemptSchema } from './invitations.js';

describe('email delivery contracts', () => {
  it('requires a UUID idempotency key and strips no unknown mutation fields', () => {
    expect(() => sendInvitationEmailInputSchema.parse({ idempotencyKey: 'repeat' })).toThrow();
    expect(() =>
      sendInvitationEmailInputSchema.parse({
        idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
        recipient: 'attacker@example.test',
      }),
    ).toThrow();
  });

  it('normalizes test destinations and rejects unsupported locales', () => {
    expect(
      sendTestEmailInputSchema.parse({ email: ' Guest@Example.TEST ', locale: 'es-MX' }),
    ).toEqual({ email: 'guest@example.test', locale: 'es-MX' });
    expect(() =>
      sendTestEmailInputSchema.parse({ email: 'guest@example.test', locale: 'fr-FR' }),
    ).toThrow();
  });

  it('keeps recipient addresses and provider diagnostics out of public attempts', () => {
    const result = emailDeliveryAttemptSchema.parse({
      id: '123e4567-e89b-42d3-a456-426614174001',
      invitationId: '123e4567-e89b-42d3-a456-426614174002',
      status: 'FAILED',
      provider: 'smtp',
      providerStatus: 'FAILED',
      attemptNumber: 1,
      locale: 'en-US',
      subject: 'Invitation: Birthday',
      retryable: true,
      safeErrorCode: 'SMTP_TEMPORARY_FAILURE',
      safeErrorMessage: 'The mail server is temporarily unavailable.',
      queuedAt: '2026-07-27T00:00:00.000Z',
      sentAt: null,
      deliveredAt: null,
      failedAt: '2026-07-27T00:00:01.000Z',
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:01.000Z',
      recipientHash: 'private',
      providerMessageId: 'private',
    });
    expect(result).not.toHaveProperty('recipientHash');
    expect(result).not.toHaveProperty('providerMessageId');
  });
});
