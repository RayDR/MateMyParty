import { describe, expect, it } from 'vitest';
import {
  createPublicRsvpRequestSchema,
  hostInvitationRsvpDetailSchema,
  publicRsvpResponseSchema,
} from './rsvp.js';

describe('RSVP contracts', () => {
  it('keeps public responses free from internal identifiers and contacts', () => {
    const result = publicRsvpResponseSchema.parse({
      status: 'ACCEPTED',
      totalAttending: 2,
      adultsAttending: null,
      childrenAttending: null,
      dietaryNotes: null,
      guestMessage: null,
      respondedAt: '2026-07-27T01:00:00.000Z',
      updatedAt: '2026-07-27T01:00:00.000Z',
      invitationId: '77777777-7777-4777-8777-777777777777',
      email: 'private@example.test',
    });
    expect(result).not.toHaveProperty('invitationId');
    expect(result).not.toHaveProperty('email');
  });

  it('rejects oversized notes, messages, and cancellation through create/update', () => {
    expect(
      createPublicRsvpRequestSchema.safeParse({
        status: 'ACCEPTED',
        dietaryNotes: 'x'.repeat(501),
      }).success,
    ).toBe(false);
    expect(
      createPublicRsvpRequestSchema.safeParse({
        status: 'DECLINED',
        guestMessage: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
    expect(createPublicRsvpRequestSchema.safeParse({ status: 'CANCELLED' }).success).toBe(false);
  });

  it('allows internal IDs only in the host detail contract', () => {
    const result = hostInvitationRsvpDetailSchema.safeParse({
      invitationId: '77777777-7777-4777-8777-777777777777',
      guestId: '55555555-5555-4555-8555-555555555555',
      guestDisplayName: 'Family Sample',
      invitationCountMode: 'TOTAL_ONLY',
      invited: { total: 4, adults: null, children: null },
      current: null,
      history: [],
    });
    expect(result.success).toBe(true);
  });
});
