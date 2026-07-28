import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  events,
  guests,
  invitations,
  rsvps,
  type DatabaseConnection,
  type DatabaseExecutor,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class GuestsRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}
  private executor(executor?: DatabaseExecutor) {
    return executor ?? (this.connection.db as unknown as DatabaseExecutor);
  }

  async eventExists(eventId: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return Boolean(rows[0]);
  }

  async insert(
    eventId: string,
    values: Omit<
      typeof guests.$inferInsert,
      'id' | 'eventId' | 'createdAt' | 'updatedAt' | 'archivedAt'
    >,
    executor: DatabaseExecutor,
  ) {
    const rows = await executor
      .insert(guests)
      .values({ eventId, ...values })
      .returning();
    return rows[0]!;
  }

  async findById(guestId: string, includeArchived = false, executor?: DatabaseExecutor) {
    const conditions = [eq(guests.id, guestId)];
    if (!includeArchived) conditions.push(isNull(guests.archivedAt));
    const rows = await this.executor(executor)
      .select()
      .from(guests)
      .where(and(...conditions))
      .limit(1);
    return rows[0] ?? null;
  }

  async update(
    guestId: string,
    values: Partial<typeof guests.$inferInsert>,
    executor: DatabaseExecutor,
  ) {
    const rows = await executor
      .update(guests)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(guests.id, guestId))
      .returning();
    return rows[0] ?? null;
  }

  async archive(guestId: string, executor: DatabaseExecutor) {
    const now = new Date();
    const rows = await executor
      .update(guests)
      .set({ archivedAt: now, updatedAt: now })
      .where(and(eq(guests.id, guestId), isNull(guests.archivedAt)))
      .returning();
    return rows[0] ?? this.findById(guestId, true, executor);
  }

  async restore(guestId: string, executor: DatabaseExecutor) {
    const now = new Date();
    const rows = await executor
      .update(guests)
      .set({ archivedAt: null, updatedAt: now })
      .where(and(eq(guests.id, guestId), isNotNull(guests.archivedAt)))
      .returning();
    return rows[0] ?? this.findById(guestId, true, executor);
  }

  async list(eventId: string, includeArchived: boolean) {
    const conditions = [eq(guests.eventId, eventId)];
    conditions.push(includeArchived ? isNotNull(guests.id) : isNull(guests.archivedAt));
    const guestRows = await this.connection.db
      .select()
      .from(guests)
      .where(and(...conditions))
      .orderBy(guests.displayName);
    return Promise.all(
      guestRows.map(async (guest) => {
        const latest = await this.connection.db
          .select({ invitation: invitations, rsvp: rsvps })
          .from(invitations)
          .leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
          .where(eq(invitations.guestId, guest.id))
          .orderBy(desc(invitations.createdAt))
          .limit(1);
        return {
          guest,
          invitation: latest[0]?.invitation ?? null,
          rsvp: latest[0]?.rsvp ?? null,
        };
      }),
    );
  }
}
