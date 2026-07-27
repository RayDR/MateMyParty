import { Injectable } from '@nestjs/common';
import {
  invitationLookupRequestSchema,
  invitationLookupResultSchema,
  normalizeLookupEmail,
  normalizeLookupName,
  normalizeLookupPhone,
  type InvitationLookupResult,
} from '@matemyparty/contracts';
import { ApiError } from '../common/api-error';
import { InvitationLookupRateLimiter } from './invitation-lookup-rate-limiter';
import { InvitationTokenService } from './invitation-token.service';
import { InvitationsRepository } from './invitations.repository';

const grantLifetimeMilliseconds = 12 * 60 * 1000;

@Injectable()
export class InvitationLookupService {
  constructor(
    private readonly repository: InvitationsRepository,
    private readonly tokens: InvitationTokenService,
    private readonly rateLimiter: InvitationLookupRateLimiter,
  ) {}

  async lookup(rawInput: unknown, requestAddress: string): Promise<InvitationLookupResult> {
    if (!this.rateLimiter.consume(requestAddress)) {
      throw new ApiError(429, 'LOOKUP_RATE_LIMITED', 'Invitation could not be verified');
    }
    const parsed = invitationLookupRequestSchema.safeParse(rawInput);
    if (!parsed.success) return { verified: false };
    const input = parsed.data;
    return this.repository.transaction(async (executor) => {
      const contact =
        input.method === 'EMAIL'
          ? normalizeLookupEmail(input.contact)
          : normalizeLookupPhone(input.contact);
      const match = await this.repository.findLookupMatch(
        input.eventIdentifier,
        normalizeLookupName(input.displayName),
        input.method,
        contact,
        executor,
      );
      if (!match) return invitationLookupResultSchema.parse({ verified: false });
      const generated = this.tokens.generate();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + grantLifetimeMilliseconds);
      await this.repository.cleanupAccessGrants(
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        executor,
      );
      await this.repository.insertAccessGrant(
        {
          invitationId: match.invitation.id,
          grantTokenHash: generated.hash,
          grantTokenPrefix: generated.prefix,
          lookupMethod: input.method,
          expiresAt,
        },
        executor,
      );
      return invitationLookupResultSchema.parse({
        verified: true,
        grantToken: generated.token,
        expiresAt: expiresAt.toISOString(),
      });
    });
  }
}
