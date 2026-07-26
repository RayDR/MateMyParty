import { z } from 'zod';

export const supportedEventLocaleSchema = z.enum(['en-US', 'es-MX']);
export const eventStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'ARCHIVED',
]);
export const eventTypeSchema = z.enum(['KIDS_BIRTHDAY']);
export const eventTemplateKeySchema = z.enum([
  'kids-night-dragon',
  'envelope-reveal',
  'winter-snow',
  'adventure-gates',
]);
export const eventAnimationModeSchema = z.enum(['NONE', 'SUBTLE', 'IMMERSIVE']);
export const publicEventCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{8,10}$/);

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable();
const nullableUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Only HTTP and HTTPS URLs are supported',
  })
  .nullable();

export const eventMediaReferenceSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      /^https:\/\/[^\s]+$/i.test(value) ||
      (/^\/private-media\/[a-z0-9-]+\/[A-Za-z0-9._/-]+$/.test(value) &&
        !value.split('/').includes('..')),
    { message: 'Use an HTTPS URL or a protected /private-media event path' },
  );

export const localizedEventContentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  celebrantName: z.string().trim().min(1).max(120),
  venueName: nullableText(200),
  hostMessage: nullableText(4000),
  arrivalInstructions: nullableText(2000),
  thumbnailAltText: z.string().trim().min(1).max(240),
});

export const eventContentByLocaleSchema = z.object({
  'en-US': localizedEventContentSchema,
  'es-MX': localizedEventContentSchema,
});

export const eventTemplateConfigurationSchema = z.object({
  key: eventTemplateKeySchema,
  version: z.number().int().positive().max(1000),
  animationMode: eventAnimationModeSchema,
  videoBackgroundRef: eventMediaReferenceSchema.nullable(),
  staticFallbackRef: eventMediaReferenceSchema.nullable(),
  audioRef: eventMediaReferenceSchema.nullable(),
  animationEnabled: z.boolean(),
  audioEnabled: z.boolean(),
  overlayIntensity: z.number().int().min(0).max(100),
});

export const publicEventSchema = z.object({
  title: z.string().min(1),
  celebrantName: z.string().min(1),
  celebrantAge: z.number().int().positive().nullable(),
  eventType: eventTypeSchema,
  status: eventStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string().min(1),
  locale: supportedEventLocaleSchema,
  venueName: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  publicSlug: z.string().min(1),
  templateKey: eventTemplateKeySchema,
  templateVersion: z.number().int().positive(),
  hostMessage: z.string().nullable(),
  rsvpDeadline: z.iso.datetime().nullable(),
});

export const hostEventStatisticsSchema = z.object({
  guestCount: z.number().int().nonnegative(),
  invitationCount: z.number().int().nonnegative(),
  openedCount: z.number().int().nonnegative(),
  rsvp: z.object({
    available: z.literal(false),
    attending: z.null(),
    declined: z.null(),
    pending: z.null(),
  }),
});

export const hostEventSummarySchema = z.object({
  identifier: z.string().min(1),
  publicSlug: z.string().min(1),
  publicCode: publicEventCodeSchema,
  title: z.string().min(1),
  celebrantName: z.string().min(1),
  celebrantAge: z.number().int().positive().nullable(),
  startsAt: z.iso.datetime(),
  venueName: z.string().nullable(),
  status: eventStatusSchema,
  templateKey: eventTemplateKeySchema,
  primaryHostname: z.string().nullable(),
  thumbnailImageRef: eventMediaReferenceSchema.nullable(),
  statistics: hostEventStatisticsSchema,
});

export const hostEventDetailSchema = hostEventSummarySchema.extend({
  eventType: eventTypeSchema,
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string().min(1),
  defaultLocale: supportedEventLocaleSchema,
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  mapsUrl: nullableUrl,
  thumbnailImageRef: eventMediaReferenceSchema.nullable(),
  staticBackgroundRef: eventMediaReferenceSchema.nullable(),
  localizedContent: eventContentByLocaleSchema,
  template: eventTemplateConfigurationSchema,
  revisionNumber: z.number().int().positive(),
});

export const updateHostEventInputSchema = z
  .object({
    celebrantAge: z.number().int().positive().max(150).nullable(),
    eventType: eventTypeSchema,
    status: eventStatusSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }, 'A valid IANA time zone is required'),
    defaultLocale: supportedEventLocaleSchema,
    addressLine1: nullableText(240),
    addressLine2: nullableText(240),
    city: nullableText(120),
    region: nullableText(120),
    postalCode: nullableText(32),
    countryCode: z.string().trim().toUpperCase().length(2).nullable(),
    mapsUrl: nullableUrl,
    thumbnailImageRef: eventMediaReferenceSchema.nullable(),
    staticBackgroundRef: eventMediaReferenceSchema.nullable(),
    localizedContent: eventContentByLocaleSchema,
    template: eventTemplateConfigurationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'End date and time must be after the start date and time',
      });
    }
    if (value.template.animationEnabled && value.template.animationMode === 'NONE') {
      context.addIssue({
        code: 'custom',
        path: ['template', 'animationMode'],
        message: 'Choose an animation mode when animation is enabled',
      });
    }
    if (!value.template.animationEnabled && value.template.animationMode !== 'NONE') {
      context.addIssue({
        code: 'custom',
        path: ['template', 'animationMode'],
        message: 'Animation mode must be NONE when animation is disabled',
      });
    }
    if (value.template.audioEnabled && !value.template.audioRef) {
      context.addIssue({
        code: 'custom',
        path: ['template', 'audioRef'],
        message: 'Audio reference is required when audio is enabled',
      });
    }
  });

export type PublicEvent = z.infer<typeof publicEventSchema>;
export type HostEventSummary = z.infer<typeof hostEventSummarySchema>;
export type HostEventDetail = z.infer<typeof hostEventDetailSchema>;
export type UpdateHostEventInput = z.infer<typeof updateHostEventInputSchema>;

export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}
