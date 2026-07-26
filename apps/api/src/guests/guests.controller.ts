import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { GuestsService } from './guests.service';

@Controller('api/host')
@UseGuards(HostAdminTokenGuard)
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get('events/:eventId/guests')
  list(
    @Param('eventId') eventIdentifier: string,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived: boolean,
  ) {
    return this.guests.list(eventIdentifier, includeArchived);
  }

  @Get('events/:eventId/guest-statistics')
  statistics(@Param('eventId') eventIdentifier: string) {
    return this.guests.statistics(eventIdentifier);
  }

  @Post('events/:eventId/guests')
  create(@Param('eventId') eventIdentifier: string, @Body() body: unknown) {
    return this.guests.create(eventIdentifier, body);
  }

  @Patch('guests/:guestId')
  update(@Param('guestId', new ParseUUIDPipe()) guestId: string, @Body() body: unknown) {
    return this.guests.update(guestId, body);
  }

  @Post('guests/:guestId/archive')
  archive(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.guests.archive(guestId);
  }

  @Post('guests/:guestId/restore')
  restore(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.guests.restore(guestId);
  }
}
