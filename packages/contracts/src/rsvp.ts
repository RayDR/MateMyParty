import { z } from 'zod';
const rsvpInvitationCountModeSchema = z.enum(['TOTAL_ONLY', 'ADULTS_AND_CHILDREN']);

export const rsvpStatusSchema = z.enum(['ACCEPTED', 'DECLINED', 'NOT_SURE', 'CANCELLED']);

const attendanceSchema = z.object({
  totalAttending: z.number().int().nonnegative().max(200).nullable(),
  adultsAttending: z.number().int().nonnegative().max(100).nullable(),
  childrenAttending: z.number().int().nonnegative().max(100).nullable(),
});

export const publicRsvpResponseSchema = attendanceSchema.extend({
  status: rsvpStatusSchema,
  dietaryNotes: z.string().max(500).nullable(),
  guestMessage: z.string().max(1000).nullable(),
  respondedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const publicRsvpMutationObjectSchema = z
  .object({
    status: rsvpStatusSchema.exclude(['CANCELLED']),
    totalAttending: z.number().int().nonnegative().max(200).optional().nullable(),
    adultsAttending: z.number().int().nonnegative().max(100).optional().nullable(),
    childrenAttending: z.number().int().nonnegative().max(100).optional().nullable(),
    dietaryNotes: z.string().trim().max(500).optional().nullable(),
    guestMessage: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export const createPublicRsvpRequestSchema = publicRsvpMutationObjectSchema;
export const updatePublicRsvpRequestSchema = publicRsvpMutationObjectSchema;
export const cancelPublicRsvpRequestSchema = z.object({}).strict();

export const hostRsvpSummarySchema = attendanceSchema.extend({
  status: rsvpStatusSchema,
  updatedAt: z.iso.datetime(),
});

export const hostRsvpHistoryEntrySchema = publicRsvpResponseSchema.extend({
  id: z.uuid(),
  source: z.enum(['INVITEE', 'HOST']),
});

export const hostInvitationRsvpDetailSchema = z.object({
  invitationId: z.uuid(),
  guestId: z.uuid(),
  guestDisplayName: z.string().min(1),
  invitationCountMode: rsvpInvitationCountModeSchema,
  invited: z.object({
    total: z.number().int().nonnegative(),
    adults: z.number().int().nonnegative().nullable(),
    children: z.number().int().nonnegative().nullable(),
  }),
  current: publicRsvpResponseSchema.nullable(),
  history: z.array(hostRsvpHistoryEntrySchema),
});

export const hostRsvpStatisticsSchema = z.object({
  pending: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  declined: z.number().int().nonnegative(),
  notSure: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  confirmedTotal: z.number().int().nonnegative(),
  confirmedAdults: z.number().int().nonnegative(),
  confirmedChildren: z.number().int().nonnegative(),
  invitationsWithoutResponse: z.number().int().nonnegative(),
});

export type RsvpStatus = z.infer<typeof rsvpStatusSchema>;
export type PublicRsvpResponse = z.infer<typeof publicRsvpResponseSchema>;
export type CreatePublicRsvpRequest = z.infer<typeof createPublicRsvpRequestSchema>;
export type UpdatePublicRsvpRequest = z.infer<typeof updatePublicRsvpRequestSchema>;
export type HostRsvpSummary = z.infer<typeof hostRsvpSummarySchema>;
export type HostInvitationRsvpDetail = z.infer<typeof hostInvitationRsvpDetailSchema>;
export type HostRsvpStatistics = z.infer<typeof hostRsvpStatisticsSchema>;
