import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}
  @Get('by-hostname/:hostname') byHostname(@Param('hostname') hostname: string) {
    return this.eventsService.byHostname(hostname);
  }
  @Get('by-slug/:slug') bySlug(@Param('slug') slug: string) {
    return this.eventsService.bySlug(slug);
  }
}
