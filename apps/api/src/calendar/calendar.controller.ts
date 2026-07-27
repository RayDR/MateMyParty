import { Controller, Get, Headers, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { CalendarService } from './calendar.service';

@Controller('api/calendar')
export class PublicCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  event(
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
    @Query('locale') locale?: string,
  ) {
    return this.calendar.privateEvent({ permanentToken, grantToken }, locale);
  }

  @Get('ics')
  async ics(
    @Res({ passthrough: true }) response: FastifyReply,
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
    @Query('locale') locale?: string,
  ) {
    const result = await this.calendar.privateIcs({ permanentToken, grantToken }, locale);
    setIcsHeaders(response, result.filename);
    return result.body;
  }
}

@Controller('api/host/events')
@UseGuards(HostAdminTokenGuard)
export class HostCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':identifier/calendar-preview')
  preview(@Param('identifier') identifier: string, @Query('locale') locale?: string) {
    return this.calendar.hostPreview(identifier, locale);
  }

  @Get(':identifier/calendar-preview/ics')
  async ics(
    @Param('identifier') identifier: string,
    @Res({ passthrough: true }) response: FastifyReply,
    @Query('locale') locale?: string,
  ) {
    const result = await this.calendar.hostIcs(identifier, locale);
    setIcsHeaders(response, result.filename);
    return result.body;
  }
}

function setIcsHeaders(response: FastifyReply, filename: string) {
  response.header('content-type', 'text/calendar; charset=utf-8');
  response.header('content-disposition', `attachment; filename="${filename}"`);
  response.header('cache-control', 'no-store, private');
  response.header('x-content-type-options', 'nosniff');
}
