import { z } from 'zod';

export const eventStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'ARCHIVED',
]);
export const eventTypeSchema = z.enum(['KIDS_BIRTHDAY']);

export const publicEventSchema = z.object({
  title: z.string().min(1),
  celebrantName: z.string().min(1),
  celebrantAge: z.number().int().positive().nullable(),
  eventType: eventTypeSchema,
  status: eventStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string().min(1),
  locale: z.enum(['en-US', 'es-MX']),
  venueName: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  publicSlug: z.string().min(1),
  templateKey: z.string().min(1),
  templateVersion: z.number().int().positive(),
  hostMessage: z.string().nullable(),
  rsvpDeadline: z.iso.datetime().nullable(),
});

export type PublicEvent = z.infer<typeof publicEventSchema>;

export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}
