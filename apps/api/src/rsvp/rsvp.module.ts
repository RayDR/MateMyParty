import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { HostRsvpController } from './host-rsvp.controller';
import { PublicRsvpController } from './public-rsvp.controller';
import { RsvpRateLimiter } from './rsvp-rate-limiter';
import { RsvpRepository } from './rsvp.repository';
import { RsvpService } from './rsvp.service';

@Module({
  imports: [EventsModule, InvitationsModule],
  controllers: [PublicRsvpController, HostRsvpController],
  providers: [RsvpRepository, RsvpService, RsvpRateLimiter],
  exports: [RsvpService],
})
export class RsvpModule {}
