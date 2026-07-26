import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { EventsService } from './events.service';

@Controller('api/host/events')
@UseGuards(HostAdminTokenGuard)
export class HostEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.listHostEvents();
  }

  @Get(':identifier')
  detail(@Param('identifier') identifier: string) {
    return this.events.hostEvent(identifier);
  }

  @Get(':identifier/share-preview')
  sharePreview(@Param('identifier') identifier: string, @Query('locale') locale?: string) {
    return this.events.invitationSharePreview(identifier, locale);
  }

  @Patch(':identifier')
  update(@Param('identifier') identifier: string, @Body() body: unknown) {
    return this.events.updateHostEvent(identifier, body);
  }
}
