import { Injectable } from '@nestjs/common';
import {
  createInvitationResultSchema,
  regenerateInvitationResultSchema,
  type CreateInvitationResult,
  type PrivateInvitation,
  type RegenerateInvitationResult,
  type PublicRsvpResponse,
} from '@matemyparty/contracts';
import type { DatabaseExecutor, guests } from '@matemyparty/database';
import { ApiError } from '../common/api-error';
import { presentPrivateInvitation } from '../events/presentation.presenter';
import { presentGuest, presentInvitation } from '../guests/guest.presenter';
import { InvitationTokenService } from './invitation-token.service';
import { InvitationsRepository } from './invitations.repository';
import { PublicInvitationUrlService } from './public-invitation-url.service';

type GuestRow = typeof guests.$inferSelect;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly repository: InvitationsRepository,
    private readonly tokens: InvitationTokenService,
    private readonly urls: PublicInvitationUrlService,
  ) {}

  createForGuest(guestId: string): Promise<CreateInvitationResult> {
    return this.repository.transaction(async (executor) => {
      const guest = await this.repository.guestById(guestId, executor);
      if (!guest || guest.archivedAt) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      return this.createForGuestInTransaction(guest, executor, 'CREATED');
    });
  }

  async createForGuestInTransaction(
    guest: GuestRow,
    executor: DatabaseExecutor,
    activityType: 'CREATED' | 'REGENERATED',
  ): Promise<CreateInvitationResult> {
    if (await this.repository.findActiveByGuest(guest.id, executor)) {
      throw new ApiError(409, 'ACTIVE_INVITATION_EXISTS', 'An active invitation already exists');
    }
    const generated = this.tokens.generate();
    const invitation = await this.repository.insert(
      {
        eventId: guest.eventId,
        guestId: guest.id,
        publicTokenHash: generated.hash,
        publicTokenPrefix: generated.prefix,
        status: 'READY',
        locale: guest.locale,
      },
      executor,
    );
    await this.repository.addActivity(invitation.id, activityType, null, executor);
    const hostname = await this.repository.primaryHostname(guest.eventId, executor);
    return createInvitationResultSchema.parse({
      guest: presentGuest(guest, invitation),
      invitation: presentInvitation(invitation),
      publicUrl: this.urls.build(generated.token, hostname),
      token: generated.token,
    });
  }

  regenerate(invitationId: string): Promise<RegenerateInvitationResult> {
    return this.repository.transaction((executor) =>
      this.regenerateInTransaction(invitationId, executor),
    );
  }

  async regenerateInTransaction(
    invitationId: string,
    executor: DatabaseExecutor,
  ): Promise<RegenerateInvitationResult> {
    const previous = await this.repository.findById(invitationId, executor);
    if (!previous) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    const active = await this.repository.findActiveByGuest(previous.guestId, executor);
    if (active && active.id !== previous.id) {
      throw new ApiError(
        409,
        'ACTIVE_INVITATION_EXISTS',
        'Another active invitation already exists',
      );
    }
    if (!previous.revokedAt) {
      await this.repository.revoke(previous.id, executor);
      await this.repository.addActivity(previous.id, 'REVOKED', null, executor);
    }
    await this.repository.revokeAccessGrants(previous.id, executor);
    const guest = await this.repository.guestById(previous.guestId, executor);
    if (!guest || guest.archivedAt) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
    const created = await this.createForGuestInTransaction(guest, executor, 'REGENERATED');
    return regenerateInvitationResultSchema.parse({
      invitation: created.invitation,
      publicUrl: created.publicUrl,
      newToken: created.token,
    });
  }

  revoke(invitationId: string) {
    return this.repository.transaction(async (executor) => {
      const existing = await this.repository.findById(invitationId, executor);
      if (!existing) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
      if (existing.revokedAt) {
        await this.repository.revokeAccessGrants(invitationId, executor);
        return presentInvitation(existing);
      }
      const revoked = await this.repository.revoke(invitationId, executor);
      if (!revoked) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
      await this.repository.addActivity(invitationId, 'REVOKED', null, executor);
      await this.repository.revokeAccessGrants(invitationId, executor);
      return presentInvitation(revoked);
    });
  }

  resolveAndTrack(token: string, metadata: Record<string, string>): Promise<PrivateInvitation> {
    if (!this.tokens.isValidFormat(token)) return Promise.reject(this.publicNotFound());
    return this.repository.transaction(async (executor) => {
      const expectedHash = this.tokens.hash(token);
      const candidates = await this.repository.candidatesByPrefix(token.slice(0, 8), executor);
      const invitation = candidates.find((candidate) =>
        this.tokens.matches(candidate.publicTokenHash, expectedHash),
      );
      if (!invitation || invitation.revokedAt) throw this.publicNotFound();
      const details = await this.repository.publicDetails(invitation.id, executor);
      if (!details) throw this.publicNotFound();
      return this.renderAndTrack(invitation, metadata, executor, details);
    });
  }

  resolveGrantAndTrack(
    grantToken: string,
    metadata: Record<string, string>,
  ): Promise<PrivateInvitation> {
    if (!this.tokens.isValidFormat(grantToken)) return Promise.reject(this.publicNotFound());
    return this.repository.transaction(async (executor) => {
      const now = new Date();
      const expectedHash = this.tokens.hash(grantToken);
      const candidates = await this.repository.accessGrantCandidates(
        grantToken.slice(0, 8),
        now,
        executor,
      );
      const candidate = candidates.find(({ grant }) =>
        this.tokens.matches(grant.grantTokenHash, expectedHash),
      );
      if (!candidate) throw this.publicNotFound();
      if (!(await this.repository.markAccessGrantUsed(candidate.grant.id, now, executor))) {
        throw this.publicNotFound();
      }
      const details = await this.repository.publicDetails(candidate.invitation.id, executor);
      if (!details) throw this.publicNotFound();
      return this.renderAndTrack(candidate.invitation, metadata, executor, details);
    });
  }

  async resolveAccess(
    permanentToken: string | undefined,
    grantToken: string | undefined,
    executor: DatabaseExecutor,
  ) {
    if (permanentToken && this.tokens.isValidFormat(permanentToken)) {
      const expectedHash = this.tokens.hash(permanentToken);
      const candidates = await this.repository.candidatesByPrefix(
        permanentToken.slice(0, 8),
        executor,
      );
      const invitation = candidates.find((candidate) =>
        this.tokens.matches(candidate.publicTokenHash, expectedHash),
      );
      if (invitation) return invitation;
    }
    if (grantToken && this.tokens.isValidFormat(grantToken)) {
      const now = new Date();
      const expectedHash = this.tokens.hash(grantToken);
      const candidates = await this.repository.accessGrantCandidates(
        grantToken.slice(0, 8),
        now,
        executor,
      );
      const candidate = candidates.find(({ grant }) =>
        this.tokens.matches(grant.grantTokenHash, expectedHash),
      );
      if (
        candidate &&
        (await this.repository.markAccessGrantUsed(candidate.grant.id, now, executor))
      ) {
        return candidate.invitation;
      }
    }
    throw this.publicNotFound();
  }

  private async renderAndTrack(
    invitation: Awaited<ReturnType<InvitationsRepository['findById']>> & object,
    metadata: Record<string, string>,
    executor: DatabaseExecutor,
    resolvedDetails?: NonNullable<Awaited<ReturnType<InvitationsRepository['publicDetails']>>>,
  ) {
    const openedPreviously = invitation.openCount > 0;
    const details =
      resolvedDetails ?? (await this.repository.publicDetails(invitation.id, executor));
    if (!details) throw this.publicNotFound();
    const now = new Date();
    const opened = await this.repository.recordOpen(invitation.id, now, executor);
    if (!opened) throw this.publicNotFound();
    await this.repository.addActivity(invitation.id, 'OPENED', metadata, executor);
    return presentPrivateInvitation(
      {
        event: details.event,
        localizations: details.localizations,
        primaryHostname: details.primaryHostname,
      },
      details.guest,
      opened.locale === 'es-MX' ? 'es-MX' : 'en-US',
      openedPreviously,
      details.rsvp ? this.presentRsvp(details.rsvp) : null,
      true,
    );
  }

  private presentRsvp(
    row: NonNullable<
      NonNullable<Awaited<ReturnType<InvitationsRepository['publicDetails']>>>['rsvp']
    >,
  ): PublicRsvpResponse {
    return {
      status: row.status,
      totalAttending: row.totalAttending,
      adultsAttending: row.adultsAttending,
      childrenAttending: row.childrenAttending,
      dietaryNotes: row.dietaryNotes,
      guestMessage: row.guestMessage,
      respondedAt: row.respondedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private publicNotFound() {
    return new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }
}
