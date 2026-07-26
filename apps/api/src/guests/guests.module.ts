import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { GuestsController } from './guests.controller';
import { GuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';

@Module({
  imports: [InvitationsModule],
  controllers: [GuestsController],
  providers: [GuestsRepository, GuestsService],
})
export class GuestsModule {}
