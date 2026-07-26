import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

@Controller('api/invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  resolve(
    @Param('token') token: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
    @Query('locale') requestedLocale?: string,
  ) {
    const metadata: Record<string, string> = {};
    if (userAgent) metadata.userAgent = userAgent.slice(0, 160);
    if (requestedLocale === 'en-US' || requestedLocale === 'es-MX')
      metadata.requestedLocale = requestedLocale;
    if (referrer) {
      try {
        metadata.referrerHost = new URL(referrer).hostname.slice(0, 253);
      } catch {
        /* Invalid referrers are omitted. */
      }
    }
    return this.invitations.resolveAndTrack(token, metadata);
  }
}
