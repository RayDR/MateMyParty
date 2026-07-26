import { Module } from '@nestjs/common';
import { HostInvitationsController } from './host-invitations.controller';
import { InvitationTokenService } from './invitation-token.service';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';
import { PublicInvitationUrlService } from './public-invitation-url.service';
import { PublicInvitationsController } from './public-invitations.controller';

@Module({
  controllers: [HostInvitationsController, PublicInvitationsController],
  providers: [
    InvitationsRepository,
    InvitationsService,
    InvitationTokenService,
    PublicInvitationUrlService,
  ],
  exports: [InvitationsRepository, InvitationsService],
})
export class InvitationsModule {}
