import { emailDeliveryAttemptSchema, type EmailDeliveryAttempt } from '@matemyparty/contracts';
import type { emailDeliveryAttempts } from '@matemyparty/database';

type AttemptRow = typeof emailDeliveryAttempts.$inferSelect;

export function presentEmailAttempt(row: AttemptRow): EmailDeliveryAttempt {
  return emailDeliveryAttemptSchema.parse({
    id: row.id,
    invitationId: row.invitationId,
    status: row.status,
    provider: row.provider,
    providerStatus: row.providerStatus,
    attemptNumber: row.attemptNumber,
    locale: row.locale,
    subject: row.subjectSnapshot,
    retryable: row.retryable,
    safeErrorCode: row.safeErrorCode,
    safeErrorMessage: row.safeErrorMessage,
    queuedAt: row.queuedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
