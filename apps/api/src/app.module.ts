import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { GuestsModule } from './guests/guests.module';
import { InvitationsModule } from './invitations/invitations.module';
import { RsvpModule } from './rsvp/rsvp.module';
import { CalendarModule } from './calendar/calendar.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    EventsModule,
    InvitationsModule,
    GuestsModule,
    RsvpModule,
    CalendarModule,
    EmailModule,
  ],
})
export class AppModule {}
