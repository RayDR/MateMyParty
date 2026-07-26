import { Injectable, NotFoundException } from '@nestjs/common';
import {
  hostEventSummarySchema,
  normalizeHostname,
  normalizeSlug,
  publicEventPreviewSchema,
  type HostEventSummary,
  type PublicEventPreview,
} from '@matemyparty/contracts';
import { EventsRepository } from './events.repository';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  async byHostname(rawHostname: string): Promise<PublicEventPreview> {
    return this.toPublicEvent(await this.repository.findByHostname(normalizeHostname(rawHostname)));
  }

  async bySlug(rawSlug: string): Promise<PublicEventPreview> {
    return this.toPublicEvent(await this.repository.findBySlug(normalizeSlug(rawSlug)));
  }

  async listForHost(): Promise<HostEventSummary[]> {
    return (await this.repository.listForHost()).map((event) =>
      hostEventSummarySchema.parse(event),
    );
  }

  private toPublicEvent(
    row: Awaited<ReturnType<EventsRepository['findBySlug']>>,
  ): PublicEventPreview {
    if (!row) throw new NotFoundException('Event not found');
    return publicEventPreviewSchema.parse(row);
  }
}
