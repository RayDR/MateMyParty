import { Inject, Injectable } from '@nestjs/common';
import {
  createGuestInputSchema,
  createGuestRequestSchema,
  updateGuestInputSchema,
  guestInvitationStatisticsSchema,
  type GuestInvitationStatistics,
  type HostGuest,
} from '@matemyparty/contracts';
import type { DatabaseConnection } from '@matemyparty/database';
import { ApiError, parseInput } from '../common/api-error';
import { DATABASE } from '../database/database.module';
import { EventsRepository } from '../events/events.repository';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { InvitationsService } from '../invitations/invitations.service';
import { presentGuest } from './guest.presenter';
import { GuestsRepository } from './guests.repository';

@Injectable()
export class GuestsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly events: EventsRepository,
    private readonly guests: GuestsRepository,
    private readonly invitationsRepository: InvitationsRepository,
    private readonly invitations: InvitationsService,
  ) {}

  async list(eventIdentifier: string, includeArchived: boolean): Promise<HostGuest[]> {
    const eventId = await this.events.findInternalIdByIdentifier(eventIdentifier);
    if (!eventId) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return (await this.guests.list(eventId, includeArchived)).map(({ guest, invitation }) =>
      presentGuest(guest, invitation),
    );
  }

  async statistics(eventIdentifier: string): Promise<GuestInvitationStatistics> {
    const guests = await this.list(eventIdentifier, true);
    return calculateGuestInvitationStatistics(guests);
  }

  create(eventIdentifier: string, rawInput: unknown) {
    const request = parseInput(createGuestRequestSchema, rawInput);
    const { createInvitation, ...guestRequest } = request;
    const input = parseInput(createGuestInputSchema, guestRequest);
    return this.connection.db.transaction(async (executor) => {
      const eventId = await this.events.findInternalIdByIdentifier(eventIdentifier, executor);
      if (!eventId) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
      const guest = await this.guests.insert(eventId, input, executor);
      if (createInvitation)
        return this.invitations.createForGuestInTransaction(guest, executor, 'CREATED');
      return presentGuest(guest, null);
    });
  }

  update(guestId: string, rawInput: unknown) {
    const patch = parseInput(updateGuestInputSchema, rawInput);
    return this.connection.db.transaction(async (executor) => {
      const existing = await this.guests.findById(guestId, false, executor);
      if (!existing) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      const normalized = parseInput(createGuestInputSchema, {
        displayName: patch.displayName ?? existing.displayName,
        contactName: patch.contactName === undefined ? existing.contactName : patch.contactName,
        email: patch.email === undefined ? existing.email : patch.email,
        phone: patch.phone === undefined ? existing.phone : patch.phone,
        preferredChannel: patch.preferredChannel ?? existing.preferredChannel,
        locale: patch.locale ?? existing.locale,
        invitationCountMode: patch.invitationCountMode ?? existing.invitationCountMode,
        totalInvited: patch.totalInvited === undefined ? existing.totalInvited : patch.totalInvited,
        adultsInvited:
          patch.adultsInvited === undefined ? existing.adultsInvited : patch.adultsInvited,
        childrenInvited:
          patch.childrenInvited === undefined ? existing.childrenInvited : patch.childrenInvited,
        privateNotes: patch.privateNotes === undefined ? existing.privateNotes : patch.privateNotes,
      });
      const updated = await this.guests.update(guestId, normalized, executor);
      if (!updated) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      return presentGuest(
        updated,
        await this.invitationsRepository.findLatestByGuest(guestId, executor),
      );
    });
  }

  archive(guestId: string) {
    return this.connection.db.transaction(async (executor) => {
      const archived = await this.guests.archive(guestId, executor);
      if (!archived) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      return presentGuest(
        archived,
        await this.invitationsRepository.findLatestByGuest(guestId, executor),
      );
    });
  }

  restore(guestId: string) {
    return this.connection.db.transaction(async (executor) => {
      const restored = await this.guests.restore(guestId, executor);
      if (!restored) throw new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      return presentGuest(
        restored,
        await this.invitationsRepository.findLatestByGuest(guestId, executor),
      );
    });
  }
}

export function calculateGuestInvitationStatistics(guests: HostGuest[]): GuestInvitationStatistics {
  const activeGuests = guests.filter((guest) => !guest.archivedAt);
  const activeInvitations = activeGuests.filter(
    (guest) => guest.invitation && !guest.invitation.revokedAt,
  );
  return guestInvitationStatisticsSchema.parse({
    totalGuests: activeGuests.length,
    totalPeopleInvited: activeGuests.reduce((total, guest) => total + guest.totalInvited, 0),
    generated: activeInvitations.length,
    notGenerated: activeGuests.length - activeInvitations.length,
    opened: activeInvitations.filter((guest) => (guest.invitation?.openCount ?? 0) > 0).length,
    notOpened: activeInvitations.filter((guest) => (guest.invitation?.openCount ?? 0) === 0).length,
    revoked: activeGuests.filter((guest) => Boolean(guest.invitation?.revokedAt)).length,
    notContactable: activeGuests.filter(
      (guest) => !guest.notificationEligibility.canNotifyAutomatically,
    ).length,
  });
}
