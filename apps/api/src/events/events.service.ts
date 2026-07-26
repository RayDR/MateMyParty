import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeHostname,
  normalizeSlug,
  publicEventSchema,
  type PublicEvent,
} from '@matemyparty/contracts';
import { EventsRepository } from './events.repository';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  async byHostname(rawHostname: string): Promise<PublicEvent> {
    return this.toPublicEvent(await this.repository.findByHostname(normalizeHostname(rawHostname)));
  }

  async bySlug(rawSlug: string): Promise<PublicEvent> {
    return this.toPublicEvent(await this.repository.findBySlug(normalizeSlug(rawSlug)));
  }

  private toPublicEvent(row: Awaited<ReturnType<EventsRepository['findBySlug']>>): PublicEvent {
    if (!row) throw new NotFoundException('Event not found');
    return publicEventSchema.parse({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      rsvpDeadline: row.rsvpDeadline?.toISOString() ?? null,
    });
  }
}
