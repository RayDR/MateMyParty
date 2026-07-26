import { Module } from '@nestjs/common';
import { HostInvitationsController } from './host-invitations.controller';
import { InvitationLookupController } from './invitation-lookup.controller';
import { InvitationLookupRateLimiter } from './invitation-lookup-rate-limiter.service';
import { InvitationLookupRepository } from './invitation-lookup.repository';
import { InvitationLookupService } from './invitation-lookup.service';
import { InvitationTokenService } from './invitation-token.service';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';
import { PublicInvitationUrlService } from './public-invitation-url.service';
import { PublicInvitationsController } from './public-invitations.controller';
import { PublicInvitationAccessController } from './public-invitation-access.controller';

@Module({
  controllers: [
    HostInvitationsController,
    InvitationLookupController,
    PublicInvitationAccessController,
    PublicInvitationsController,
  ],
  providers: [
    InvitationsRepository,
    InvitationsService,
    InvitationLookupRateLimiter,
    InvitationLookupRepository,
    InvitationLookupService,
    InvitationTokenService,
    PublicInvitationUrlService,
  ],
  exports: [InvitationsRepository, InvitationsService],
})
export class InvitationsModule {}
