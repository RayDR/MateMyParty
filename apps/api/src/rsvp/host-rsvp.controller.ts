import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { RsvpService } from './rsvp.service';

@Controller('api/host')
@UseGuards(HostAdminTokenGuard)
export class HostRsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get('events/:eventIdentifier/rsvp-statistics')
  statistics(@Param('eventIdentifier') eventIdentifier: string) {
    return this.rsvp.statistics(eventIdentifier);
  }

  @Get('invitations/:invitationId/rsvp')
  detail(@Param('invitationId', new ParseUUIDPipe()) invitationId: string) {
    return this.rsvp.hostDetail(invitationId);
  }
}
