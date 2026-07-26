import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import type { DatabaseConnection } from '@matemyparty/database';
import { eventDomains, events } from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

const publicSelection = {
  celebrantName: events.celebrantName,
  celebrantAge: events.celebrantAge,
  locale: events.locale,
  publicSlug: events.publicSlug,
  templateKey: events.templateKey,
  templateVersion: events.templateVersion,
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

  async listForHost() {
    return this.connection.db
      .select({
        id: events.id,
        title: events.title,
        publicSlug: events.publicSlug,
        primaryHostname: sql<string | null>`(
          select ${eventDomains.hostname}
          from ${eventDomains}
          where ${eventDomains.eventId} = ${events.id}
          order by ${eventDomains.isPrimary} desc, ${eventDomains.createdAt} asc
          limit 1
        )`,
      })
      .from(events)
      .orderBy(asc(events.createdAt));
  }
}
