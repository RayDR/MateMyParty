import { Injectable } from '@nestjs/common';

@Injectable()
export class PublicInvitationUrlService {
  build(token: string, eventHostname: string | null): string {
    const protocol =
      process.env.PUBLIC_APP_PROTOCOL ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const fallback = process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
    const useDevelopmentHost = fallback.startsWith('localhost');
    const hostname = useDevelopmentHost ? fallback : (eventHostname ?? fallback);
    return `${protocol}://${hostname}/i/${token}`;
  }
}
