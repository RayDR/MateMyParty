import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  events,
  guests,
  invitationAccessGrants,
  invitations,
  type DatabaseConnection,
  type DatabaseExecutor,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class InvitationLookupRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  findMatches(
    publicSlug: string,
    displayName: string,
    contact: { email: string } | { phone: string },
    executor: DatabaseExecutor,
  ) {
    const contactCondition =
      'email' in contact
        ? sql`lower(btrim(normalize(${guests.email}, NFKC))) = ${contact.email}`
        : sql`regexp_replace(coalesce(${guests.phone}, ''), '[^0-9]', '', 'g') = ${contact.phone}`;
    return executor
      .select({ invitationId: invitations.id, locale: invitations.locale })
      .from(invitations)
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .innerJoin(events, eq(events.id, invitations.eventId))
      .where(
        and(
          sql`lower(${events.publicSlug}) = ${publicSlug}`,
          sql`lower(regexp_replace(btrim(normalize(${guests.displayName}, NFKC)), '\\s+', ' ', 'g')) = ${displayName}`,
          contactCondition,
          isNull(guests.archivedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .limit(2);
  }

  async replaceGrant(
    invitationId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
    executor: DatabaseExecutor,
  ) {
    await executor
      .update(invitationAccessGrants)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invitationAccessGrants.invitationId, invitationId),
          isNull(invitationAccessGrants.revokedAt),
        ),
      );
    await executor.insert(invitationAccessGrants).values({ invitationId, tokenHash, expiresAt });
  }

  async findActiveGrant(tokenHash: string, now: Date, executor: DatabaseExecutor) {
    const rows = await executor
      .select({ invitationId: invitationAccessGrants.invitationId })
      .from(invitationAccessGrants)
      .innerJoin(invitations, eq(invitations.id, invitationAccessGrants.invitationId))
      .innerJoin(guests, eq(guests.id, invitations.guestId))
      .where(
        and(
          eq(invitationAccessGrants.tokenHash, tokenHash),
          gt(invitationAccessGrants.expiresAt, now),
          isNull(invitationAccessGrants.revokedAt),
          isNull(invitations.revokedAt),
          isNull(guests.archivedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }
}
