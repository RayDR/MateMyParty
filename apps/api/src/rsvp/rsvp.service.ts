import { Injectable } from '@nestjs/common';
import {
  cancelPublicRsvpRequestSchema,
  createPublicRsvpRequestSchema,
  hostInvitationRsvpDetailSchema,
  hostRsvpStatisticsSchema,
  publicRsvpResponseSchema,
  updatePublicRsvpRequestSchema,
  type CreatePublicRsvpRequest,
  type HostInvitationRsvpDetail,
  type HostRsvpStatistics,
  type PublicRsvpResponse,
} from '@matemyparty/contracts';
import type { rsvps } from '@matemyparty/database';
import { ApiError, parseInput } from '../common/api-error';
import { EventsRepository } from '../events/events.repository';
import { InvitationsService } from '../invitations/invitations.service';
import { RsvpRepository } from './rsvp.repository';

type RsvpRow = typeof rsvps.$inferSelect;
type Credentials = { permanentToken?: string; grantToken?: string };

@Injectable()
export class RsvpService {
  constructor(
    private readonly repository: RsvpRepository,
    private readonly invitations: InvitationsService,
    private readonly events: EventsRepository,
  ) {}

  current(credentials: Credentials): Promise<PublicRsvpResponse | null> {
    return this.repository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      return this.present(await this.repository.current(invitation.id, executor));
    });
  }

  create(credentials: Credentials, rawInput: unknown): Promise<PublicRsvpResponse> {
    const input = parseInput(createPublicRsvpRequestSchema, rawInput);
    return this.repository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      await this.repository.lockInvitation(invitation.id, executor);
      const context = await this.repository.context(invitation.id, executor);
      if (!context) throw this.publicNotFound();
      if (await this.repository.current(invitation.id, executor)) {
        throw new ApiError(409, 'RSVP_ALREADY_EXISTS', 'An RSVP response already exists');
      }
      const values = this.normalize(input, context.guest);
      const row = await this.repository.insert(
        { invitationId: invitation.id, ...values },
        executor,
      );
      await this.repository.addHistory(row, executor);
      return this.present(row)!;
    });
  }

  update(credentials: Credentials, rawInput: unknown): Promise<PublicRsvpResponse> {
    const input = parseInput(updatePublicRsvpRequestSchema, rawInput);
    return this.repository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      await this.repository.lockInvitation(invitation.id, executor);
      const context = await this.repository.context(invitation.id, executor);
      const current = await this.repository.current(invitation.id, executor);
      if (!context || !current) throw this.publicNotFound();
      const values = this.normalize(input, context.guest);
      if (this.same(current, values)) return this.present(current)!;
      const updated = await this.repository.update(current.id, values, executor);
      await this.repository.addHistory(updated, executor);
      return this.present(updated)!;
    });
  }

  cancel(credentials: Credentials, rawInput: unknown): Promise<PublicRsvpResponse> {
    parseInput(cancelPublicRsvpRequestSchema, rawInput);
    return this.repository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      await this.repository.lockInvitation(invitation.id, executor);
      if (!(await this.repository.context(invitation.id, executor))) throw this.publicNotFound();
      const current = await this.repository.current(invitation.id, executor);
      if (!current || current.status !== 'ACCEPTED') {
        throw new ApiError(409, 'RSVP_CANNOT_CANCEL', 'The RSVP cannot be cancelled');
      }
      const updated = await this.repository.update(
        current.id,
        {
          status: 'CANCELLED',
          totalAttending: null,
          adultsAttending: null,
          childrenAttending: null,
        },
        executor,
      );
      await this.repository.addHistory(updated, executor);
      return this.present(updated)!;
    });
  }

  async hostDetail(invitationId: string): Promise<HostInvitationRsvpDetail> {
    const detail = await this.repository.hostDetail(invitationId);
    if (!detail) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    return hostInvitationRsvpDetailSchema.parse({
      invitationId: detail.invitation.id,
      guestId: detail.guest.id,
      guestDisplayName: detail.guest.displayName,
      invitationCountMode: detail.guest.invitationCountMode,
      invited: {
        total: detail.guest.totalInvited,
        adults: detail.guest.adultsInvited,
        children: detail.guest.childrenInvited,
      },
      current: this.present(detail.rsvp),
      history: detail.history.map((row) => ({
        id: row.id,
        source: row.source,
        status: row.status,
        totalAttending: row.totalAttending,
        adultsAttending: row.adultsAttending,
        childrenAttending: row.childrenAttending,
        dietaryNotes: row.dietaryNotes,
        guestMessage: row.guestMessage,
        respondedAt: row.respondedAt.toISOString(),
        updatedAt: row.createdAt.toISOString(),
      })),
    });
  }

  async statistics(eventIdentifier: string): Promise<HostRsvpStatistics> {
    const eventId = await this.events.findInternalIdByIdentifier(eventIdentifier);
    if (!eventId) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const responses = await this.repository.eventResponses(eventId);
    const statusCount = (status: RsvpRow['status']) =>
      responses.filter(({ rsvp }) => rsvp?.status === status).length;
    const accepted = responses.flatMap(({ rsvp }) => (rsvp?.status === 'ACCEPTED' ? [rsvp] : []));
    const pending = responses.filter(({ rsvp }) => !rsvp).length;
    return hostRsvpStatisticsSchema.parse({
      pending,
      accepted: statusCount('ACCEPTED'),
      declined: statusCount('DECLINED'),
      notSure: statusCount('NOT_SURE'),
      cancelled: statusCount('CANCELLED'),
      confirmedTotal: accepted.reduce((sum, row) => sum + (row.totalAttending ?? 0), 0),
      confirmedAdults: accepted.reduce((sum, row) => sum + (row.adultsAttending ?? 0), 0),
      confirmedChildren: accepted.reduce((sum, row) => sum + (row.childrenAttending ?? 0), 0),
      invitationsWithoutResponse: pending,
    });
  }

  private normalize(
    input: CreatePublicRsvpRequest,
    guest: {
      invitationCountMode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN';
      totalInvited: number;
      adultsInvited: number | null;
      childrenInvited: number | null;
    },
  ) {
    const notes = input.dietaryNotes?.trim() || null;
    const message = input.guestMessage?.trim() || null;
    if (input.status !== 'ACCEPTED') {
      return {
        status: input.status,
        totalAttending: null,
        adultsAttending: null,
        childrenAttending: null,
        dietaryNotes: notes,
        guestMessage: message,
      };
    }
    if (guest.invitationCountMode === 'TOTAL_ONLY') {
      const total = input.totalAttending;
      if (total == null || total < 1 || total > guest.totalInvited) throw this.invalidAttendance();
      if (input.adultsAttending != null || input.childrenAttending != null)
        throw this.invalidAttendance();
      return {
        status: input.status,
        totalAttending: total,
        adultsAttending: null,
        childrenAttending: null,
        dietaryNotes: notes,
        guestMessage: message,
      };
    }
    const adults = input.adultsAttending;
    const children = input.childrenAttending;
    if (
      adults == null ||
      children == null ||
      adults > (guest.adultsInvited ?? 0) ||
      children > (guest.childrenInvited ?? 0) ||
      adults + children < 1 ||
      input.totalAttending != null
    )
      throw this.invalidAttendance();
    return {
      status: input.status,
      totalAttending: adults + children,
      adultsAttending: adults,
      childrenAttending: children,
      dietaryNotes: notes,
      guestMessage: message,
    };
  }

  private same(current: RsvpRow, next: ReturnType<RsvpService['normalize']>) {
    return (
      current.status === next.status &&
      current.totalAttending === next.totalAttending &&
      current.adultsAttending === next.adultsAttending &&
      current.childrenAttending === next.childrenAttending &&
      current.dietaryNotes === next.dietaryNotes &&
      current.guestMessage === next.guestMessage
    );
  }

  private present(row: RsvpRow | null): PublicRsvpResponse | null {
    if (!row) return null;
    return publicRsvpResponseSchema.parse({
      status: row.status,
      totalAttending: row.totalAttending,
      adultsAttending: row.adultsAttending,
      childrenAttending: row.childrenAttending,
      dietaryNotes: row.dietaryNotes,
      guestMessage: row.guestMessage,
      respondedAt: row.respondedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private invalidAttendance() {
    return new ApiError(400, 'INVALID_ATTENDANCE', 'Attendance is outside the invited party');
  }

  private publicNotFound() {
    return new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }
}
