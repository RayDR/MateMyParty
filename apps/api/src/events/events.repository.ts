import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DatabaseConnection } from '@matemyparty/database';
import { eventDomains, events } from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

const publicSelection = {
  title: events.title,
  celebrantName: events.celebrantName,
  celebrantAge: events.celebrantAge,
  eventType: events.eventType,
  status: events.status,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  timezone: events.timezone,
  locale: events.locale,
  venueName: events.venueName,
  addressLine1: events.addressLine1,
  addressLine2: events.addressLine2,
  city: events.city,
  region: events.region,
  postalCode: events.postalCode,
  countryCode: events.countryCode,
  publicSlug: events.publicSlug,
  templateKey: events.templateKey,
  templateVersion: events.templateVersion,
  hostMessage: events.hostMessage,
  rsvpDeadline: events.rsvpDeadline,
};

export type PublicEventRow = Awaited<ReturnType<EventsRepository['findBySlug']>>;

@Injectable()
export class EventsRepository {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async findByHostname(hostname: string) {
    const rows = await this.connection.db
      .select(publicSelection)
      .from(events)
      .innerJoin(eventDomains, eq(eventDomains.eventId, events.id))
      .where(sql`lower(${eventDomains.hostname}) = ${hostname}`)
      .limit(1);
    return rows[0] ?? null;
  }

  async findBySlug(slug: string) {
    const rows = await this.connection.db
      .select(publicSelection)
      .from(events)
      .where(sql`lower(${events.publicSlug}) = ${slug}`)
      .limit(1);
    return rows[0] ?? null;
  }
}
