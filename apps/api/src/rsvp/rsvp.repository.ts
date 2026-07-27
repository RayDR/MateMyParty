import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  guests,
  invitations,
  rsvpHistory,
  rsvps,
  type DatabaseConnection,
  type DatabaseExecutor,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class RsvpRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }

  async lockInvitation(invitationId: string, executor: DatabaseExecutor) {
    const result = await executor.execute(
      sql`select ${invitations.id} from ${invitations} where ${invitations.id} = ${invitationId} for update`,
    );
    return (result.rowCount ?? 0) === 1;
  }

  async context(invitationId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ invitation: invitations, guest: guests })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
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

  async current(invitationId: string, executor: DatabaseExecutor) {
    const rows = await executor
      .select()
      .from(rsvps)
      .where(eq(rsvps.invitationId, invitationId))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(values: typeof rsvps.$inferInsert, executor: DatabaseExecutor) {
    const rows = await executor.insert(rsvps).values(values).returning();
    return rows[0]!;
  }

  async update(id: string, values: Partial<typeof rsvps.$inferInsert>, executor: DatabaseExecutor) {
    const rows = await executor
      .update(rsvps)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(rsvps.id, id))
      .returning();
    return rows[0]!;
  }

  async addHistory(row: typeof rsvps.$inferSelect, executor: DatabaseExecutor) {
    await executor.insert(rsvpHistory).values({
      rsvpId: row.id,
      invitationId: row.invitationId,
      status: row.status,
      totalAttending: row.totalAttending,
      adultsAttending: row.adultsAttending,
      childrenAttending: row.childrenAttending,
      dietaryNotes: row.dietaryNotes,
      guestMessage: row.guestMessage,
      source: 'INVITEE',
      respondedAt: row.respondedAt,
    });
  }

  async hostDetail(invitationId: string) {
    const rows = await this.connection.db
      .select({ invitation: invitations, guest: guests, rsvp: rsvps })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
      .where(eq(invitations.id, invitationId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const history = await this.connection.db
      .select()
      .from(rsvpHistory)
      .where(eq(rsvpHistory.invitationId, invitationId))
      .orderBy(desc(rsvpHistory.createdAt));
    return { ...row, history };
  }

  async eventResponses(eventId: string) {
    return this.connection.db
      .select({ rsvp: rsvps })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
      .where(
        and(
          eq(invitations.eventId, eventId),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      );
  }
}
