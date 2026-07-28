import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { HostCalendarController, PublicCalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [EventsModule, InvitationsModule],
  controllers: [PublicCalendarController, HostCalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
