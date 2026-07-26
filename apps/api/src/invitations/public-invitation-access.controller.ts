import { Controller, Get, Header, Headers, Param } from '@nestjs/common';
import { InvitationLookupService } from './invitation-lookup.service';

@Controller('api/invitation-access')
export class PublicInvitationAccessController {
  constructor(private readonly lookup: InvitationLookupService) {}

  @Get(':grant')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
  resolve(
    @Param('grant') grant: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
  ) {
    const metadata: Record<string, string> = {};
    if (userAgent) metadata.userAgent = userAgent.slice(0, 160);
    if (referrer) {
      try {
        metadata.referrerHost = new URL(referrer).hostname.slice(0, 253);
      } catch {
        /* Invalid referrers are omitted. */
      }
    }
    return this.lookup.resolve(grant, metadata);
  }
}
