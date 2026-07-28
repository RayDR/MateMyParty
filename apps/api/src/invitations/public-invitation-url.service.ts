import { Injectable } from '@nestjs/common';
import { publicEventUrl } from '../common/public-url';

@Injectable()
export class PublicInvitationUrlService {
  build(token: string, eventHostname: string | null): string {
    return publicEventUrl(`/i/${token}`, eventHostname);
  }
}
