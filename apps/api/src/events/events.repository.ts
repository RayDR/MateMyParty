import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { UpdateHostEventInput } from '@matemyparty/contracts';
import type { DatabaseConnection, DatabaseExecutor } from '@matemyparty/database';
import {
  eventDomains,
  eventLocalizations,
  eventRevisions,
  events,
  guests,
  invitations,
  rsvps,
} from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

export type PublicEventRow = Awaited<ReturnType<EventsRepository['findBySlug']>>;
export type HostEventRecord = NonNullable<
  Awaited<ReturnType<EventsRepository['findHostRecordByIdentifier']>>
>;

@Injectable()
export class EventsRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private executor(executor?: DatabaseExecutor) {
    return executor ?? (this.connection.db as unknown as DatabaseExecutor);
  }

  async findByHostname(hostname: string) {
    const rows = await this.connection.db
      .select({ event: events })
      .from(events)
      .innerJoin(eventDomains, eq(eventDomains.eventId, events.id))
      .where(sql`lower(${eventDomains.hostname}) = ${hostname}`)
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const [localizations, domains] = await Promise.all([
      this.connection.db
        .select()
        .from(eventLocalizations)
        .where(eq(eventLocalizations.eventId, row.event.id)),
      this.connection.db
        .select()
        .from(eventDomains)
        .where(eq(eventDomains.eventId, row.event.id))
        .orderBy(desc(eventDomains.isPrimary)),
    ]);
    return {
      event: row.event,
      localizations,
      primaryHostname: domains[0]?.hostname ?? null,
    };
  }

  async findBySlug(slug: string) {
    const rows = await this.connection.db
      .select()
      .from(events)
      .where(sql`lower(${events.publicSlug}) = ${slug}`)
      .limit(1);
    const event = rows[0];
    if (!event) return null;
    const [localizations, domains] = await Promise.all([
      this.connection.db
        .select()
        .from(eventLocalizations)
        .where(eq(eventLocalizations.eventId, event.id)),
      this.connection.db
        .select()
        .from(eventDomains)
        .where(eq(eventDomains.eventId, event.id))
        .orderBy(desc(eventDomains.isPrimary)),
    ]);
    return { event, localizations, primaryHostname: domains[0]?.hostname ?? null };
  }

  async isPublicCodeTaken(code: string, executor?: DatabaseExecutor): Promise<boolean> {
    const rows = await this.executor(executor)
      .select({ id: events.id })
      .from(events)
      .where(eq(events.publicCode, code))
      .limit(1);
    return Boolean(rows[0]);
  }

  async findInternalIdByIdentifier(identifier: string, executor?: DatabaseExecutor) {
    const rows = await this.executor(executor)
      .select({ id: events.id })
      .from(events)
      .where(this.identifierCondition(identifier))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async listHostRecords() {
    const rows = await this.connection.db
      .select({ id: events.id })
      .from(events)
      .orderBy(desc(events.startsAt));
    const records = await Promise.all(rows.map(({ id }) => this.findHostRecordById(id)));
    return records.filter((record): record is HostEventRecord => Boolean(record));
  }

  async findHostRecordByIdentifier(identifier: string, executor?: DatabaseExecutor) {
    const eventId = await this.findInternalIdByIdentifier(identifier, executor);
    return eventId ? this.findHostRecordById(eventId, executor) : null;
  }

  async findHostRecordById(eventId: string, executor?: DatabaseExecutor) {
    const database = this.executor(executor);
    const eventRows = await database.select().from(events).where(eq(events.id, eventId)).limit(1);
    const event = eventRows[0];
    if (!event) return null;
    const [localizations, domains, guestStats, invitationStats, revisions] = await Promise.all([
      database.select().from(eventLocalizations).where(eq(eventLocalizations.eventId, eventId)),
      database
        .select()
        .from(eventDomains)
        .where(eq(eventDomains.eventId, eventId))
        .orderBy(desc(eventDomains.isPrimary)),
      database
        .select({ value: count() })
        .from(guests)
        .where(and(eq(guests.eventId, eventId), isNull(guests.archivedAt))),
      database
        .select({
          invitationCount: count(),
          openedCount: count(sql`case when ${invitations.openCount} > 0 then 1 end`),
          rsvpPending: count(sql`case when ${rsvps.id} is null then 1 end`),
          rsvpAccepted: count(sql`case when ${rsvps.status} = 'ACCEPTED' then 1 end`),
          rsvpDeclined: count(sql`case when ${rsvps.status} = 'DECLINED' then 1 end`),
          rsvpNotSure: count(sql`case when ${rsvps.status} = 'NOT_SURE' then 1 end`),
          rsvpCancelled: count(sql`case when ${rsvps.status} = 'CANCELLED' then 1 end`),
          confirmedTotal: sql<number>`coalesce(sum(case when ${rsvps.status} = 'ACCEPTED' then ${rsvps.totalAttending} else 0 end), 0)`,
          confirmedAdults: sql<number>`coalesce(sum(case when ${rsvps.status} = 'ACCEPTED' then ${rsvps.adultsAttending} else 0 end), 0)`,
          confirmedChildren: sql<number>`coalesce(sum(case when ${rsvps.status} = 'ACCEPTED' then ${rsvps.childrenAttending} else 0 end), 0)`,
        })
        .from(invitations)
        .innerJoin(guests, eq(guests.id, invitations.guestId))
        .leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
        .where(
          and(
            eq(invitations.eventId, eventId),
            isNull(invitations.revokedAt),
            isNull(guests.archivedAt),
          ),
        ),
      database
        .select({ revisionNumber: eventRevisions.revisionNumber })
        .from(eventRevisions)
        .where(eq(eventRevisions.eventId, eventId))
        .orderBy(desc(eventRevisions.revisionNumber))
        .limit(1),
    ]);
    return {
      event,
      localizations,
      primaryHostname: domains[0]?.hostname ?? null,
      statistics: {
        guestCount: Number(guestStats[0]?.value ?? 0),
        invitationCount: Number(invitationStats[0]?.invitationCount ?? 0),
        openedCount: Number(invitationStats[0]?.openedCount ?? 0),
        rsvp: {
          pending: Number(invitationStats[0]?.rsvpPending ?? 0),
          accepted: Number(invitationStats[0]?.rsvpAccepted ?? 0),
          declined: Number(invitationStats[0]?.rsvpDeclined ?? 0),
          notSure: Number(invitationStats[0]?.rsvpNotSure ?? 0),
          cancelled: Number(invitationStats[0]?.rsvpCancelled ?? 0),
          confirmedTotal: Number(invitationStats[0]?.confirmedTotal ?? 0),
          confirmedAdults: Number(invitationStats[0]?.confirmedAdults ?? 0),
          confirmedChildren: Number(invitationStats[0]?.confirmedChildren ?? 0),
          invitationsWithoutResponse: Number(invitationStats[0]?.rsvpPending ?? 0),
        },
      },
      revisionNumber: revisions[0]?.revisionNumber ?? 0,
    };
  }

  async lockById(eventId: string, executor: DatabaseExecutor) {
    const result = await executor.execute(
      sql`select ${events.id} from ${events} where ${events.id} = ${eventId} for update`,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateEvent(eventId: string, input: UpdateHostEventInput, executor: DatabaseExecutor) {
    const canonical = input.localizedContent[input.defaultLocale];
    const rows = await executor
      .update(events)
      .set({
        title: canonical.title,
        celebrantName: canonical.celebrantName,
        celebrantAge: input.celebrantAge,
        eventType: input.eventType,
        status: input.status,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone,
        locale: input.defaultLocale,
        venueName: canonical.venueName,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        mapsUrl: input.mapsUrl,
        thumbnailImageRef: input.thumbnailImageRef,
        staticBackgroundRef: input.staticBackgroundRef,
        templateKey: input.template.key,
        templateVersion: input.template.version,
        animationMode: input.template.animationMode,
        videoBackgroundRef: input.template.videoBackgroundRef,
        staticFallbackRef: input.template.staticFallbackRef,
        audioRef: input.template.audioRef,
        animationEnabled: input.template.animationEnabled,
        audioEnabled: input.template.audioEnabled,
        overlayIntensity: input.template.overlayIntensity,
        hostMessage: canonical.hostMessage,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning({ id: events.id });
    return Boolean(rows[0]);
  }

  async upsertLocalizations(
    eventId: string,
    content: UpdateHostEventInput['localizedContent'],
    executor: DatabaseExecutor,
  ) {
    for (const locale of ['en-US', 'es-MX'] as const) {
      const value = content[locale];
      await executor
        .insert(eventLocalizations)
        .values({ eventId, locale, ...value })
        .onConflictDoUpdate({
          target: [eventLocalizations.eventId, eventLocalizations.locale],
          set: { ...value, updatedAt: new Date() },
        });
    }
  }

  async insertRevision(
    eventId: string,
    revisionNumber: number,
    snapshot: Record<string, unknown>,
    executor: DatabaseExecutor,
  ) {
    await executor.insert(eventRevisions).values({
      eventId,
      revisionNumber,
      snapshot,
      changeReason: 'HOST_EVENT_UPDATE',
    });
  }

  transaction<T>(operation: (executor: DatabaseExecutor) => Promise<T>) {
    return this.connection.db.transaction(operation);
  }

  private identifierCondition(identifier: string) {
    const normalized = identifier.trim();
    return or(
      sql`lower(${events.publicSlug}) = ${normalized.toLowerCase()}`,
      eq(events.publicCode, normalized.toUpperCase()),
    );
  }
}
