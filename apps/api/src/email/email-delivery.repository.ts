import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, lt, max } from 'drizzle-orm';
import {
  emailDeliveryAttempts,
  guests,
  type DatabaseConnection,
  type DatabaseExecutor,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class EmailDeliveryRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}
  private executor(executor?: DatabaseExecutor) {
    return executor ?? (this.connection.db as unknown as DatabaseExecutor);
  }

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }

  async guestById(guestId: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(guests)
      .where(eq(guests.id, guestId))
      .limit(1);
    return rows[0] ?? null;
  }

  guestsForEvent(eventId: string) {
    return this.connection.db
      .select()
      .from(guests)
      .where(and(eq(guests.eventId, eventId), isNull(guests.archivedAt)));
  }

  async lockGuest(guestId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ id: guests.id })
      .from(guests)
      .where(eq(guests.id, guestId))
      .for('update')
      .limit(1);
    return Boolean(rows[0]);
  }

  async byIdempotencyKey(key: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(emailDeliveryAttempts)
      .where(eq(emailDeliveryAttempts.idempotencyKey, key))
      .limit(1);
    return rows[0] ?? null;
  }

  async nextAttemptNumber(guestId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ value: max(emailDeliveryAttempts.attemptNumber) })
      .from(emailDeliveryAttempts)
      .where(eq(emailDeliveryAttempts.guestId, guestId));
    return Number(rows[0]?.value ?? 0) + 1;
  }

  async insert(values: typeof emailDeliveryAttempts.$inferInsert, executor: DatabaseExecutor) {
    const rows = await executor.insert(emailDeliveryAttempts).values(values).returning();
    return rows[0]!;
  }

  async markSending(id: string) {
    const now = new Date();
    const rows = await this.connection.db
      .update(emailDeliveryAttempts)
      .set({ status: 'SENDING', updatedAt: now })
      .where(and(eq(emailDeliveryAttempts.id, id), eq(emailDeliveryAttempts.status, 'QUEUED')))
      .returning();
    return rows[0] ?? null;
  }

  async markSent(id: string, values: { providerMessageId: string | null; providerStatus: string }) {
    const now = new Date();
    const rows = await this.connection.db
      .update(emailDeliveryAttempts)
      .set({
        status: 'SENT',
        providerMessageId: values.providerMessageId,
        providerStatus: values.providerStatus.slice(0, 80),
        retryable: false,
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(emailDeliveryAttempts.id, id))
      .returning();
    return rows[0]!;
  }

  async markFailed(
    id: string,
    values: {
      providerStatus: string;
      retryable: boolean;
      safeErrorCode: string;
      safeErrorMessage: string;
    },
  ) {
    const now = new Date();
    const rows = await this.connection.db
      .update(emailDeliveryAttempts)
      .set({
        status: 'FAILED',
        providerStatus: values.providerStatus.slice(0, 80),
        retryable: values.retryable,
        safeErrorCode: values.safeErrorCode.slice(0, 80),
        safeErrorMessage: values.safeErrorMessage.slice(0, 300),
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(emailDeliveryAttempts.id, id))
      .returning();
    return rows[0]!;
  }

  async markInterrupted(before: Date) {
    const now = new Date();
    return this.connection.db
      .update(emailDeliveryAttempts)
      .set({
        status: 'FAILED',
        providerStatus: 'INTERRUPTED',
        retryable: true,
        safeErrorCode: 'SEND_INTERRUPTED',
        safeErrorMessage: 'The previous send was interrupted and may be retried.',
        failedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(emailDeliveryAttempts.status, 'SENDING'),
          lt(emailDeliveryAttempts.updatedAt, before),
        ),
      )
      .returning({ id: emailDeliveryAttempts.id });
  }

  async latestForGuest(guestId: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(emailDeliveryAttempts)
      .where(eq(emailDeliveryAttempts.guestId, guestId))
      .orderBy(desc(emailDeliveryAttempts.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  historyForGuest(guestId: string) {
    return this.connection.db
      .select()
      .from(emailDeliveryAttempts)
      .where(eq(emailDeliveryAttempts.guestId, guestId))
      .orderBy(desc(emailDeliveryAttempts.createdAt))
      .limit(100);
  }

  async statusCounts(eventId: string) {
    return this.connection.db
      .select({ status: emailDeliveryAttempts.status, value: count() })
      .from(emailDeliveryAttempts)
      .where(eq(emailDeliveryAttempts.eventId, eventId))
      .groupBy(emailDeliveryAttempts.status)
      .orderBy(asc(emailDeliveryAttempts.status));
  }
}
