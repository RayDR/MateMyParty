import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { EmailCsrfGuard } from './email-csrf.guard';
import { EmailDeliveryService } from './email-delivery.service';

@Controller('api/host')
@UseGuards(HostAdminTokenGuard)
export class EmailDeliveryController {
  constructor(private readonly email: EmailDeliveryService) {}

  @Get('guests/:guestId/email/preview')
  preview(
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Query('locale') locale?: string,
  ) {
    return this.email.preview(guestId, locale);
  }

  @Get('guests/:guestId/email/deliveries')
  history(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.email.history(guestId);
  }

  @Post('guests/:guestId/email/send')
  @UseGuards(EmailCsrfGuard)
  send(@Param('guestId', new ParseUUIDPipe()) guestId: string, @Body() body: unknown) {
    return this.email.send(guestId, body);
  }

  @Post('events/:identifier/email/test')
  @UseGuards(EmailCsrfGuard)
  test(@Param('identifier') identifier: string, @Body() body: unknown) {
    return this.email.test(identifier, body);
  }

  @Get('events/:identifier/email/statistics')
  statistics(@Param('identifier') identifier: string) {
    return this.email.statistics(identifier);
  }
}
