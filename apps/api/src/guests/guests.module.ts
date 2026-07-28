import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { EmailModule } from '../email/email.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { GuestsController } from './guests.controller';
import { GuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';

@Module({
  imports: [EventsModule, InvitationsModule, EmailModule],
  controllers: [GuestsController],
  providers: [GuestsRepository, GuestsService],
})
export class GuestsModule {}
