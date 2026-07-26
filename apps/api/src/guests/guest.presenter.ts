import {
  hostGuestSchema,
  invitationSummarySchema,
  type HostGuest,
  type InvitationSummary,
  type NotificationEligibility,
} from '@matemyparty/contracts';
import type { guests, invitations } from '@matemyparty/database';

export type GuestRow = typeof guests.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
export function notificationEligibilityForGuest(row: GuestRow): NotificationEligibility {
  const canEmail = Boolean(row.email);
  const canSms = Boolean(row.phone);
  const canNotifyAutomatically =
    (row.preferredChannel === 'EMAIL' && canEmail) ||
    (row.preferredChannel === 'SMS' && canSms) ||
    (row.preferredChannel === 'BOTH' && canEmail && canSms);
  return {
    canNotifyAutomatically,
    canEmail,
    canSms,
    reason: canNotifyAutomatically
      ? 'ELIGIBLE'
      : canEmail || canSms
        ? 'NOT_CONFIGURED'
        : 'NO_CONTACT',
  };
}

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
    invitationCountMode: row.invitationCountMode,
    totalInvited: row.totalInvited,
    adultsInvited: row.adultsInvited,
    childrenInvited: row.childrenInvited,
    privateNotes: row.privateNotes,
    notificationEligibility: notificationEligibilityForGuest(row),
    invitation: invitation ? presentInvitation(invitation) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  });
}
