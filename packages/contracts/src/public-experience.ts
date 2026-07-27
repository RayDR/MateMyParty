import { z } from 'zod';
import {
  eventMediaReferenceSchema,
  eventTemplateKeySchema,
  supportedEventLocaleSchema,
} from './events.js';
import { invitationCountModeSchema } from './invitations.js';

export const invitationPresentationModeSchema = z.enum([
  'NIGHT_DRAGON_FLIGHT',
  'ADVENTURE_GATES',
  'ENVELOPE_REVEAL',
  'WINTER_SNOW',
]);

export const invitationPresentationSchema = z.object({
  templateKey: eventTemplateKeySchema,
  mode: invitationPresentationModeSchema,
  animationEnabled: z.boolean(),
  videoRef: eventMediaReferenceSchema.nullable(),
  audioRef: eventMediaReferenceSchema.nullable(),
  staticFallbackRef: eventMediaReferenceSchema.nullable(),
  thumbnailRef: eventMediaReferenceSchema.nullable(),
  overlayIntensity: z.number().int().min(0).max(100),
});

const publicLandingLocaleSchema = z.object({
  headline: z.string().min(1).max(240),
  description: z.string().min(1).max(600),
  thumbnailAltText: z.string().min(1).max(240),
});

export const publicEventLandingSchema = z.object({
  lookupIdentifier: z.string().min(1).max(160),
  publicSlug: z.string().min(1).max(160),
  defaultLocale: supportedEventLocaleSchema,
  primaryHostname: z.string().nullable(),
  localizedContent: z.object({
    'en-US': publicLandingLocaleSchema,
    'es-MX': publicLandingLocaleSchema,
  }),
  presentation: invitationPresentationSchema,
  lookupEnabled: z.literal(true),
});

const privateInvitationLocaleSchema = z.object({
  title: z.string().min(1).max(180),
  celebrantName: z.string().min(1).max(120),
  venueName: z.string().nullable(),
  hostMessage: z.string().nullable(),
  arrivalInstructions: z.string().nullable(),
  thumbnailAltText: z.string().min(1).max(240),
});

export const privateInvitationEventSchema = z.object({
  publicSlug: z.string().min(1),
  defaultLocale: supportedEventLocaleSchema,
  celebrantAge: z.number().int().positive().nullable(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string().min(1),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  mapsUrl: z
    .url()
    .refine((value) => value.startsWith('https://') || value.startsWith('http://'))
    .nullable(),
  localizedContent: z.object({
    'en-US': privateInvitationLocaleSchema,
    'es-MX': privateInvitationLocaleSchema,
  }),
  presentation: invitationPresentationSchema,
});

export const privateInvitationSchema = z.object({
  event: privateInvitationEventSchema,
  guestDisplayName: z.string().min(1),
  party: z.object({
    mode: invitationCountModeSchema,
    totalInvited: z.number().int().nonnegative(),
    adultsInvited: z.number().int().nonnegative().nullable(),
    childrenInvited: z.number().int().nonnegative().nullable(),
  }),
  invitationLocale: supportedEventLocaleSchema,
  openedPreviously: z.boolean(),
  shareMetadata: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    hostname: z.string().nullable(),
    thumbnailImageRef: eventMediaReferenceSchema.nullable(),
    thumbnailAltText: z.string().min(1),
  }),
  capabilities: z.object({
    canRespond: z.literal(false),
    canAddToCalendar: z.literal(false),
  }),
});

export const invitationLookupMethodSchema = z.enum(['EMAIL', 'PHONE']);
export const invitationLookupRequestSchema = z
  .object({
    eventIdentifier: z.string().trim().min(1).max(160),
    displayName: z.string().trim().min(1).max(160),
    method: invitationLookupMethodSchema,
    contact: z.string().trim().min(1).max(254),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.method === 'EMAIL' && !z.string().email().safeParse(value.contact).success) {
      context.addIssue({ code: 'custom', path: ['contact'], message: 'Invalid lookup input' });
    }
    if (value.method === 'PHONE' && !/^\+?[0-9]{7,20}$/.test(normalizeLookupPhone(value.contact))) {
      context.addIssue({ code: 'custom', path: ['contact'], message: 'Invalid lookup input' });
    }
    if (value.method === 'PHONE' && !/^[+0-9().\-\s]+$/.test(value.contact)) {
      context.addIssue({ code: 'custom', path: ['contact'], message: 'Invalid lookup input' });
    }
  });

export const invitationLookupResultSchema = z.discriminatedUnion('verified', [
  z.object({ verified: z.literal(false) }),
  z.object({
    verified: z.literal(true),
    grantToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.iso.datetime(),
  }),
]);

export const publicLookupResponseSchema = z.object({
  verified: z.boolean(),
  redirectTo: z.literal('/invitation').optional(),
});

export const hostPresentationPreviewSchema = z.object({
  landing: publicEventLandingSchema,
  invitation: privateInvitationSchema,
});

export type InvitationPresentation = z.infer<typeof invitationPresentationSchema>;
export type PublicEventLanding = z.infer<typeof publicEventLandingSchema>;
export type PrivateInvitation = z.infer<typeof privateInvitationSchema>;
export type InvitationLookupRequest = z.infer<typeof invitationLookupRequestSchema>;
export type InvitationLookupResult = z.infer<typeof invitationLookupResultSchema>;
export type HostPresentationPreview = z.infer<typeof hostPresentationPreviewSchema>;

export function normalizeLookupName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function normalizeLookupEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function normalizeLookupPhone(value: string): string {
  const trimmed = value.trim();
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}
