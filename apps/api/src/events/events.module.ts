import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { HostEventsController } from './host-events.controller';
import { PublicEventCodeService } from './public-event-code.service';

@Module({
  controllers: [EventsController, HostEventsController],
  providers: [EventsRepository, EventsService, PublicEventCodeService],
  exports: [EventsRepository],
})
export class EventsModule {}
