import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { HostAdminTokenGuard } from '../auth/host-admin-token.guard';
import { InvitationLookupService } from './invitation-lookup.service';

@Controller('api/internal/invitation-lookup')
@UseGuards(HostAdminTokenGuard)
export class InvitationLookupController {
  constructor(private readonly lookup: InvitationLookupService) {}

  @Post()
  verify(@Body() body: unknown, @Headers('x-client-address') clientAddress?: string) {
    return this.lookup.lookup(body, clientAddress?.slice(0, 128) || 'unknown');
  }
}
