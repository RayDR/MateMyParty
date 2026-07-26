import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { HostEventsController } from './host-events.controller';

@Module({
  controllers: [EventsController, HostEventsController],
  providers: [EventsRepository, EventsService],
})
export class EventsModule {}
