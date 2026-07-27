import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import {
  eventDomains,
  eventLocalizations,
  events,
  guests,
  invitationAccessGrants,
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

  async revokeAccessGrants(invitationId: string, executor: DatabaseExecutor) {
    const now = new Date();
    await executor
      .update(invitationAccessGrants)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invitationAccessGrants.invitationId, invitationId),
          isNull(invitationAccessGrants.revokedAt),
        ),
      );
  }

  async findLookupMatch(
    eventIdentifier: string,
    displayName: string,
    method: 'EMAIL' | 'PHONE',
    contact: string,
    executor: DatabaseExecutor,
  ) {
    const identifier = eventIdentifier.trim();
    const contactCondition =
      method === 'EMAIL'
        ? sql`lower(trim(${guests.email})) = ${contact}`
        : sql`(case when left(trim(coalesce(${guests.phone}, '')), 1) = '+' then '+' else '' end || regexp_replace(coalesce(${guests.phone}, ''), '[^0-9]', '', 'g')) = ${contact}`;
    const rows = await executor
      .select({ invitation: invitations, guest: guests })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .innerJoin(events, eq(events.id, invitations.eventId))
      .where(
        and(
          or(
            sql`lower(${events.publicSlug}) = ${identifier.toLowerCase()}`,
            eq(events.publicCode, identifier.toUpperCase()),
          ),
          sql`lower(regexp_replace(trim(${guests.displayName}), '[[:space:]]+', ' ', 'g')) = ${displayName}`,
          contactCondition,
          isNull(guests.archivedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async insertAccessGrant(
    values: typeof invitationAccessGrants.$inferInsert,
    executor: DatabaseExecutor,
  ) {
    const rows = await executor.insert(invitationAccessGrants).values(values).returning();
    return rows[0]!;
  }

  async accessGrantCandidates(prefix: string, now: Date, executor: DatabaseExecutor) {
    return executor
      .select({ grant: invitationAccessGrants, invitation: invitations })
      .from(invitationAccessGrants)
      .innerJoin(invitations, eq(invitations.id, invitationAccessGrants.invitationId))
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .where(
        and(
          eq(invitationAccessGrants.grantTokenPrefix, prefix),
          isNull(invitationAccessGrants.revokedAt),
          gt(invitationAccessGrants.expiresAt, now),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      );
  }

  async markAccessGrantUsed(id: string, now: Date, executor: DatabaseExecutor) {
    const rows = await executor
      .update(invitationAccessGrants)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(invitationAccessGrants.id, id),
          isNull(invitationAccessGrants.revokedAt),
          gt(invitationAccessGrants.expiresAt, now),
        ),
      )
      .returning({ id: invitationAccessGrants.id });
    return rows.length === 1;
  }

  async cleanupAccessGrants(before: Date, executor: DatabaseExecutor) {
    await executor
      .delete(invitationAccessGrants)
      .where(lt(invitationAccessGrants.expiresAt, before));
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
      })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .innerJoin(events, eq(events.id, invitations.eventId))
      .where(
        and(
          eq(invitations.id, invitationId),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const [localizations, primaryHostname] = await Promise.all([
      executor
        .select()
        .from(eventLocalizations)
        .where(eq(eventLocalizations.eventId, row.event.id)),
      this.primaryHostname(row.event.id, executor),
    ]);
    return { ...row, localizations, primaryHostname };
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
      .where(
        and(
          eq(invitations.id, id),
          isNull(invitations.revokedAt),
          sql`exists (select 1 from ${guests} where ${guests.id} = ${invitations.guestId} and ${guests.archivedAt} is null)`,
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }
}
