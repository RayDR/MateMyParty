import { Injectable } from '@nestjs/common';
import {
  invitationAccessGrantSchema,
  invitationLookupRequestSchema,
  normalizeSlug,
  type InvitationAccessGrant,
  type PublicInvitation,
} from '@matemyparty/contracts';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { InvitationLookupRateLimiter } from './invitation-lookup-rate-limiter.service';
import { InvitationLookupRepository } from './invitation-lookup.repository';
import { InvitationsService } from './invitations.service';

const GRANT_LIFETIME_MILLISECONDS = 10 * 60 * 1000;
const GRANT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const GENERIC_MESSAGE = 'We could not verify this invitation';

function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizedContact(value: string): { email: string } | { phone: string } | null {
  const candidate = value.normalize('NFKC').trim();
  if (candidate.includes('@')) {
    const email = candidate.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : null;
  }
  const phone = candidate.replace(/\D/g, '');
  return phone.length >= 7 && phone.length <= 15 ? { phone } : null;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class InvitationLookupService {
  constructor(
    private readonly repository: InvitationLookupRepository,
    private readonly invitations: InvitationsService,
    private readonly rateLimiter: InvitationLookupRateLimiter,
  ) {}

  async lookup(rawInput: unknown, clientAddress: string): Promise<InvitationAccessGrant> {
    if (!this.rateLimiter.consume(clientAddress)) throw this.failure(429);
    const parsed = invitationLookupRequestSchema.safeParse(rawInput);
    if (!parsed.success) return Promise.reject(this.failure());
    const displayName = normalizeName(parsed.data.displayName);
    const contact = normalizedContact(parsed.data.contact);
    if (!displayName || !contact) return Promise.reject(this.failure());

    return this.repository.transaction(async (executor) => {
      const matches = await this.repository.findMatches(
        normalizeSlug(parsed.data.publicSlug),
        displayName,
        contact,
        executor,
      );
      if (matches.length !== 1) throw this.failure();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + GRANT_LIFETIME_MILLISECONDS);
      const grant = randomBytes(32).toString('base64url');
      await this.repository.replaceGrant(
        matches[0]!.invitationId,
        tokenHash(grant),
        expiresAt,
        now,
        executor,
      );
      return invitationAccessGrantSchema.parse({ grant, expiresAt: expiresAt.toISOString() });
    });
  }

  resolve(grant: string, metadata: Record<string, string>): Promise<PublicInvitation> {
    if (!GRANT_PATTERN.test(grant)) return Promise.reject(this.failure(404));
    return this.repository.transaction(async (executor) => {
      const access = await this.repository.findActiveGrant(tokenHash(grant), new Date(), executor);
      if (!access) throw this.failure(404);
      return this.invitations.resolveInvitationAndTrack(access.invitationId, metadata, executor);
    });
  }

  private failure(status = 404): ApiError {
    return new ApiError(status, 'INVITATION_LOOKUP_FAILED', GENERIC_MESSAGE);
  }
}
