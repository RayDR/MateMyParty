import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
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

  @Patch(':identifier')
  update(@Param('identifier') identifier: string, @Body() body: unknown) {
    return this.events.updateHostEvent(identifier, body);
  }
}
