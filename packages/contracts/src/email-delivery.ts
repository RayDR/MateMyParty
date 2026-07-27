import { z } from 'zod';
import { supportedEventLocaleSchema } from './events.js';
import { emailDeliveryAttemptSchema, invitationSummarySchema } from './invitations.js';

export const emailPreviewSchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(100_000),
  text: z.string().min(1).max(20_000),
  locale: supportedEventLocaleSchema,
  eventTitle: z.string().min(1).max(180),
  publicThumbnailUrl: z.url().startsWith('https://').nullable(),
  usesPlaceholderLink: z.literal(true),
});

export const sendInvitationEmailInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
    regenerate: z.boolean().default(false),
    overridePreferredChannel: z.boolean().default(false),
  })
  .strict();

export const sendInvitationEmailResultSchema = z.object({
  attempt: emailDeliveryAttemptSchema,
  invitation: z.lazy(() => invitationSummarySchema),
  publicUrl: z.url().nullable(),
  duplicate: z.boolean(),
});

export const sendTestEmailInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    locale: supportedEventLocaleSchema,
  })
  .strict();

export const sendTestEmailResultSchema = z.object({
  accepted: z.boolean(),
  providerStatus: z.string().max(80),
  safeErrorCode: z.string().max(80).nullable(),
  safeErrorMessage: z.string().max(300).nullable(),
});

export const eventEmailStatisticsSchema = z.object({
  eligibleGuests: z.number().int().nonnegative(),
  ineligibleGuests: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  sending: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

export const emailDeliveryHistorySchema = z.array(emailDeliveryAttemptSchema).max(100);

export type EmailPreview = z.infer<typeof emailPreviewSchema>;
export type SendInvitationEmailInput = z.infer<typeof sendInvitationEmailInputSchema>;
export type SendInvitationEmailResult = z.infer<typeof sendInvitationEmailResultSchema>;
export type SendTestEmailInput = z.infer<typeof sendTestEmailInputSchema>;
export type SendTestEmailResult = z.infer<typeof sendTestEmailResultSchema>;
export type EventEmailStatistics = z.infer<typeof eventEmailStatisticsSchema>;
