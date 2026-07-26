import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { InvitationsService } from './invitations.service';

@Controller('api/host')
@UseGuards(HostAdminTokenGuard)
export class HostInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post('guests/:guestId/invitations')
  create(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.invitations.createForGuest(guestId);
  }
  @Post('invitations/:invitationId/regenerate')
  regenerate(@Param('invitationId', new ParseUUIDPipe()) id: string) {
    return this.invitations.regenerate(id);
  }
  @Post('invitations/:invitationId/revoke')
  revoke(@Param('invitationId', new ParseUUIDPipe()) id: string) {
    return this.invitations.revoke(id);
  }
}
