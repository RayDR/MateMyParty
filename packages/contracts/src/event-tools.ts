import { z } from 'zod';
import { supportedEventLocaleSchema } from './events.js';

export const mapLinksSchema = z.object({
  formattedAddress: z.string().min(1).max(1000).nullable(),
  googleMapsUrl: z.url().startsWith('https://').nullable(),
  appleMapsUrl: z.url().startsWith('https://').nullable(),
  configuredMapsUrl: z
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return (
        (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      );
    })
    .nullable(),
  usesCoordinates: z.boolean(),
});

export const calendarEventSchema = z.object({
  title: z.string().min(1).max(180),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string().min(1).max(100),
  location: z.string().max(1000).nullable(),
  description: z.string().max(4000).nullable(),
  arrivalInstructions: z.string().max(2000).nullable(),
  invitationUrl: z.url().max(2048),
  googleCalendarUrl: z.url().startsWith('https://'),
  outlookCalendarUrl: z.url().startsWith('https://'),
  icsDownloadUrl: z.string().startsWith('/internal/calendar'),
  filename: z.string().regex(/^matemyparty-[a-z0-9-]+\.ics$/),
  locale: supportedEventLocaleSchema,
});

export const privateEventToolsSchema = z.object({
  maps: mapLinksSchema.nullable(),
  calendar: calendarEventSchema,
});

export const hostCalendarPreviewSchema = z.object({
  event: calendarEventSchema,
  maps: mapLinksSchema.nullable(),
  stableUid: z.string().min(1).max(255),
  providerFallbackMinutes: z.number().int().positive().max(1440),
});

export type MapLinks = z.infer<typeof mapLinksSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type PrivateEventTools = z.infer<typeof privateEventToolsSchema>;
export type HostCalendarPreview = z.infer<typeof hostCalendarPreviewSchema>;
