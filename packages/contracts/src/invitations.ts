import { z } from 'zod';
import { publicEventSchema } from './events.js';

export const supportedLocaleSchema = z.enum(['en-US', 'es-MX']);
export const preferredChannelSchema = z.enum(['EMAIL', 'SMS', 'BOTH', 'MANUAL']);
export const invitationStatusSchema = z.enum(['DRAFT', 'READY', 'SENT', 'OPENED', 'REVOKED']);

const optionalTrimmedString = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional().nullable();

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export const createGuestInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    contactName: optionalTrimmedString(160),
    email: z.string().trim().toLowerCase().email().max(254).optional().nullable(),
    phone: z.string().trim().min(3).max(40).transform(normalizePhone).optional().nullable(),
    preferredChannel: preferredChannelSchema,
    locale: supportedLocaleSchema,
    adultsPlanned: z.number().int().nonnegative().max(100).optional().nullable(),
    childrenPlanned: z.number().int().nonnegative().max(100).optional().nullable(),
    privateNotes: optionalTrimmedString(2000),
  })
  .superRefine((value, context) => {
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
  });

export const createGuestRequestSchema = z.object({
  displayName: z.string(),
  contactName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  preferredChannel: preferredChannelSchema,
  locale: supportedLocaleSchema,
  adultsPlanned: z.number().optional().nullable(),
  childrenPlanned: z.number().optional().nullable(),
  privateNotes: z.string().optional().nullable(),
  createInvitation: z.boolean().optional().default(false),
});

export const updateGuestInputSchema = z
  .object({
    displayName: z.string().optional(),
    contactName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    preferredChannel: preferredChannelSchema.optional(),
    locale: supportedLocaleSchema.optional(),
    adultsPlanned: z.number().optional().nullable(),
    childrenPlanned: z.number().optional().nullable(),
    privateNotes: z.string().optional().nullable(),
  })
  .strict();

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

export const hostGuestSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  preferredChannel: preferredChannelSchema,
  locale: supportedLocaleSchema,
  adultsPlanned: z.number().int().nonnegative().nullable(),
  childrenPlanned: z.number().int().nonnegative().nullable(),
  privateNotes: z.string().nullable(),
  invitation: invitationSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
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

export const publicInvitationSchema = z.object({
  event: publicEventSchema,
  guestDisplayName: z.string().min(1),
  status: invitationStatusSchema.exclude(['REVOKED']),
  locale: supportedLocaleSchema,
  openedPreviously: z.boolean(),
  capabilities: z.object({
    canRespond: z.literal(false),
    canAddToCalendar: z.literal(false),
  }),
});

export const invitationLookupRequestSchema = z.object({
  publicSlug: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(160),
  contact: z.string().trim().min(3).max(254),
});

export const invitationAccessGrantSchema = z.object({
  grant: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.iso.datetime(),
});

export type CreateGuestInput = z.infer<typeof createGuestInputSchema>;
export type HostGuest = z.infer<typeof hostGuestSchema>;
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export type CreateInvitationResult = z.infer<typeof createInvitationResultSchema>;
export type RegenerateInvitationResult = z.infer<typeof regenerateInvitationResultSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
export type InvitationLookupRequest = z.infer<typeof invitationLookupRequestSchema>;
export type InvitationAccessGrant = z.infer<typeof invitationAccessGrantSchema>;
