import {
  hostGuestSchema,
  invitationSummarySchema,
  type HostGuest,
  type InvitationSummary,
} from '@matemyparty/contracts';
import type { guests, invitations } from '@matemyparty/database';

export type GuestRow = typeof guests.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;

export function presentInvitation(row: InvitationRow): InvitationSummary {
  return invitationSummarySchema.parse({
    id: row.id,
    status: row.status,
    locale: row.locale,
    tokenPrefix: row.publicTokenPrefix,
    firstOpenedAt: row.firstOpenedAt?.toISOString() ?? null,
    lastOpenedAt: row.lastOpenedAt?.toISOString() ?? null,
    openCount: row.openCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  });
}

export function presentGuest(row: GuestRow, invitation: InvitationRow | null): HostGuest {
  return hostGuestSchema.parse({
    id: row.id,
    displayName: row.displayName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    preferredChannel: row.preferredChannel,
    locale: row.locale,
    adultsPlanned: row.adultsPlanned,
    childrenPlanned: row.childrenPlanned,
    privateNotes: row.privateNotes,
    invitation: invitation ? presentInvitation(invitation) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  });
}
