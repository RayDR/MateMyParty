import { z } from 'zod';
import { eventMediaReferenceSchema, publicEventSchema } from './events.js';

export const supportedLocaleSchema = z.enum(['en-US', 'es-MX']);
export const preferredChannelSchema = z.enum(['EMAIL', 'SMS', 'BOTH', 'MANUAL']);
export const invitationCountModeSchema = z.enum(['TOTAL_ONLY', 'ADULTS_AND_CHILDREN']);
export const invitationStatusSchema = z.enum(['DRAFT', 'READY', 'SENT', 'OPENED', 'REVOKED']);

const optionalTrimmedString = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional().nullable();

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const guestInputObjectSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  contactName: optionalTrimmedString(160),
  email: z.string().trim().toLowerCase().email().max(254).optional().nullable(),
  phone: z.string().trim().min(3).max(40).transform(normalizePhone).optional().nullable(),
  preferredChannel: preferredChannelSchema,
  locale: supportedLocaleSchema,
  invitationCountMode: invitationCountModeSchema,
  totalInvited: z.number().int().nonnegative().max(200).optional().nullable(),
  adultsInvited: z.number().int().nonnegative().max(100).optional().nullable(),
  childrenInvited: z.number().int().nonnegative().max(100).optional().nullable(),
  privateNotes: optionalTrimmedString(2000),
});

export const createGuestInputSchema = guestInputObjectSchema
  .superRefine((value, context) => {
    if (value.invitationCountMode === 'TOTAL_ONLY' && value.totalInvited == null) {
      context.addIssue({
        code: 'custom',
        path: ['totalInvited'],
        message: 'Total invited is required for TOTAL_ONLY',
      });
    }
    if (
      value.invitationCountMode === 'ADULTS_AND_CHILDREN' &&
      (value.adultsInvited == null || value.childrenInvited == null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['adultsInvited'],
        message: 'Adult and child counts are required for ADULTS_AND_CHILDREN',
      });
    }
    if (value.preferredChannel === 'EMAIL' && !value.email)
      context.addIssue({ code: 'custom', path: ['email'], message: 'Email is required for EMAIL' });
    if (value.preferredChannel === 'SMS' && !value.phone)
      context.addIssue({ code: 'custom', path: ['phone'], message: 'Phone is required for SMS' });
    if (value.preferredChannel === 'BOTH' && (!value.email || !value.phone))
      context.addIssue({
        code: 'custom',
        path: ['preferredChannel'],
        message: 'Email and phone are required for BOTH',
      });
    if (value.preferredChannel === 'MANUAL' && (value.email || value.phone))
      context.addIssue({
        code: 'custom',
        path: ['preferredChannel'],
        message: 'MANUAL cannot include email or phone',
      });
  })
  .transform((value) => {
    if (value.invitationCountMode === 'TOTAL_ONLY') {
      return {
        ...value,
        totalInvited: value.totalInvited!,
        adultsInvited: null,
        childrenInvited: null,
      };
    }
    return {
      ...value,
      totalInvited: value.adultsInvited! + value.childrenInvited!,
      adultsInvited: value.adultsInvited!,
      childrenInvited: value.childrenInvited!,
    };
  });

export const createGuestRequestSchema = guestInputObjectSchema.extend({
  createInvitation: z.boolean().optional().default(false),
});

export const updateGuestInputSchema = guestInputObjectSchema.partial().strict();

export const invitationSummarySchema = z.object({
  id: z.uuid(),
  status: invitationStatusSchema,
  locale: supportedLocaleSchema,
  tokenPrefix: z.string().min(4).max(16),
  firstOpenedAt: z.iso.datetime().nullable(),
  lastOpenedAt: z.iso.datetime().nullable(),
  openCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});

export const notificationEligibilitySchema = z.object({
  canNotifyAutomatically: z.boolean(),
  canEmail: z.boolean(),
  canSms: z.boolean(),
  reason: z.enum(['ELIGIBLE', 'NO_CONTACT', 'NOT_CONFIGURED']),
});

export const hostGuestSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  preferredChannel: preferredChannelSchema,
  locale: supportedLocaleSchema,
  invitationCountMode: invitationCountModeSchema,
  totalInvited: z.number().int().nonnegative(),
  adultsInvited: z.number().int().nonnegative().nullable(),
  childrenInvited: z.number().int().nonnegative().nullable(),
  privateNotes: z.string().nullable(),
  notificationEligibility: notificationEligibilitySchema,
  invitation: invitationSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});

export const guestInvitationStatisticsSchema = z.object({
  totalGuests: z.number().int().nonnegative(),
  totalPeopleInvited: z.number().int().nonnegative(),
  generated: z.number().int().nonnegative(),
  notGenerated: z.number().int().nonnegative(),
  opened: z.number().int().nonnegative(),
  notOpened: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
  notContactable: z.number().int().nonnegative(),
});

export const invitationSharePreviewSchema = z.object({
  eventTitle: z.string().min(1),
  invitationText: z.string().min(1),
  smsText: z.string().min(1),
  hostname: z.string().nullable(),
  thumbnailImageRef: eventMediaReferenceSchema.nullable(),
  thumbnailAltText: z.string().min(1),
  locale: supportedLocaleSchema,
});

export const createInvitationResultSchema = z.object({
  guest: hostGuestSchema,
  invitation: invitationSummarySchema,
  publicUrl: z.url(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const regenerateInvitationResultSchema = z.object({
  invitation: invitationSummarySchema,
  publicUrl: z.url(),
  newToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const publicInvitationShareMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  thumbnailImageRef: eventMediaReferenceSchema.nullable(),
  thumbnailAltText: z.string().min(1),
});

export const publicInvitationSchema = z.object({
  event: publicEventSchema,
  guestDisplayName: z.string().min(1),
  status: invitationStatusSchema.exclude(['REVOKED']),
  locale: supportedLocaleSchema,
  openedPreviously: z.boolean(),
  shareMetadata: publicInvitationShareMetadataSchema,
  capabilities: z.object({
    canRespond: z.literal(false),
    canAddToCalendar: z.literal(false),
  }),
});

export type CreateGuestInput = z.infer<typeof createGuestInputSchema>;
export type HostGuest = z.infer<typeof hostGuestSchema>;
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export type NotificationEligibility = z.infer<typeof notificationEligibilitySchema>;
export type GuestInvitationStatistics = z.infer<typeof guestInvitationStatisticsSchema>;
export type InvitationSharePreview = z.infer<typeof invitationSharePreviewSchema>;
export type CreateInvitationResult = z.infer<typeof createInvitationResultSchema>;
export type RegenerateInvitationResult = z.infer<typeof regenerateInvitationResultSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
