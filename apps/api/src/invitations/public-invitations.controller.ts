import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { InvitationLookupService } from './invitation-lookup.service';
import { InvitationsService } from './invitations.service';

@Controller('api/invitations')
export class PublicInvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly lookupService: InvitationLookupService,
  ) {}

  @Post('lookup')
  lookup(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.lookupService.lookup(body, request.ip);
  }

  @Get('access')
  access(
    @Headers('x-invitation-grant') grantToken?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!grantToken) return this.invitations.resolveGrantAndTrack('', {});
    return this.invitations.resolveGrantAndTrack(grantToken, this.metadata(userAgent));
  }

  @Get(':token')
  resolve(
    @Param('token') token: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
    @Query('locale') requestedLocale?: string,
  ) {
    const metadata = this.metadata(userAgent);
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

  private metadata(userAgent?: string) {
    const metadata: Record<string, string> = {};
    if (userAgent) metadata.userAgent = userAgent.slice(0, 160);
    return metadata;
  }
}
