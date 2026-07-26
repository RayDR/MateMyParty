import { Controller, Get, UseGuards } from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { EventsService } from './events.service';

@Controller('api/host/events')
@UseGuards(HostAdminTokenGuard)
export class HostEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list() {
    return this.eventsService.listForHost();
  }
}
