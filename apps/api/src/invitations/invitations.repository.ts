import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  eventDomains,
  eventLocalizations,
  events,
  guests,
  invitationActivities,
  invitations,
  type DatabaseConnection,
  type DatabaseExecutor,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class InvitationsRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}
  private executor(executor?: DatabaseExecutor) {
    return executor ?? (this.connection.db as unknown as DatabaseExecutor);
  }

  async findById(id: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveByGuest(guestId: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(invitations)
      .where(and(eq(invitations.guestId, guestId), isNull(invitations.revokedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findLatestByGuest(guestId: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select()
      .from(invitations)
      .where(eq(invitations.guestId, guestId))
      .orderBy(desc(invitations.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async guestById(guestId: string, executor: DatabaseExecutor) {
    const rows = await executor.select().from(guests).where(eq(guests.id, guestId)).limit(1);
    return rows[0] ?? null;
  }

  async insert(values: typeof invitations.$inferInsert, executor: DatabaseExecutor) {
    const rows = await executor.insert(invitations).values(values).returning();
    return rows[0]!;
  }

  async addActivity(
    invitationId: string,
    type: typeof invitationActivities.$inferInsert.type,
    metadata: Record<string, unknown> | null,
    executor: DatabaseExecutor,
  ) {
    await executor.insert(invitationActivities).values({ invitationId, type, metadata });
  }

  async revoke(id: string, executor: DatabaseExecutor) {
    const now = new Date();
    const rows = await executor
      .update(invitations)
      .set({ status: 'REVOKED', revokedAt: now, updatedAt: now })
      .where(and(eq(invitations.id, id), isNull(invitations.revokedAt)))
      .returning();
    return rows[0] ?? this.findById(id, executor);
  }

  async primaryHostname(eventId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ hostname: eventDomains.hostname })
      .from(eventDomains)
      .where(eq(eventDomains.eventId, eventId))
      .orderBy(desc(eventDomains.isPrimary))
      .limit(1);
    return rows[0]?.hostname ?? null;
  }

  async candidatesByPrefix(prefix: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ invitation: invitations })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .where(
        and(
          eq(invitations.publicTokenPrefix, prefix),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      );
    return rows.map(({ invitation }) => invitation);
  }

  async publicDetails(invitationId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({
        invitation: invitations,
        guest: guests,
        event: events,
        localization: eventLocalizations,
      })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .innerJoin(events, eq(events.id, invitations.eventId))
      .leftJoin(
        eventLocalizations,
        and(
          eq(eventLocalizations.eventId, events.id),
          eq(eventLocalizations.locale, invitations.locale),
        ),
      )
      .where(
        and(
          eq(invitations.id, invitationId),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async recordOpen(id: string, now: Date, executor: DatabaseExecutor) {
    const rows = await executor
      .update(invitations)
      .set({
        firstOpenedAt: sql`coalesce(${invitations.firstOpenedAt}, ${now})`,
        lastOpenedAt: now,
        openCount: sql`${invitations.openCount} + 1`,
        status: sql`case when ${invitations.status} in ('READY', 'SENT') then 'OPENED'::invitation_status else ${invitations.status} end`,
        updatedAt: now,
      })
      .where(and(eq(invitations.id, id), isNull(invitations.revokedAt)))
      .returning();
    return rows[0] ?? null;
  }

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }
}
