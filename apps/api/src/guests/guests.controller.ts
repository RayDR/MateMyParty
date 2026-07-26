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
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived: boolean,
  ) {
    return this.guests.list(eventId, includeArchived);
  }

  @Post('events/:eventId/guests')
  create(@Param('eventId', new ParseUUIDPipe()) eventId: string, @Body() body: unknown) {
    return this.guests.create(eventId, body);
  }

  @Patch('guests/:guestId')
  update(@Param('guestId', new ParseUUIDPipe()) guestId: string, @Body() body: unknown) {
    return this.guests.update(guestId, body);
  }

  @Post('guests/:guestId/archive')
  archive(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.guests.archive(guestId);
  }
}
