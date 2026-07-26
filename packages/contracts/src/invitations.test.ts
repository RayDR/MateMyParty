import { describe, expect, it } from 'vitest';
import {
  createGuestInputSchema,
  normalizeEmail,
  normalizePhone,
  publicInvitationSchema,
  invitationLookupRequestSchema,
} from './invitations.js';

const base = { displayName: ' Family Sample ', locale: 'en-US' as const };

describe('guest validation', () => {
  it('creates a trimmed MANUAL guest without contact data', () => {
    const guest = createGuestInputSchema.parse({ ...base, preferredChannel: 'MANUAL' });
    expect(guest.displayName).toBe('Family Sample');
  });

  it.each([
    ['EMAIL', {}],
    ['SMS', {}],
    ['BOTH', { email: 'guest@example.test' }],
  ])('rejects %s without its required contact data', (preferredChannel, contacts) => {
    expect(() =>
      createGuestInputSchema.parse({ ...base, preferredChannel, ...contacts }),
    ).toThrow();
  });

  it('normalizes contact data without inventing a country code', () => {
    expect(normalizeEmail(' Guest@Example.TEST ')).toBe('guest@example.test');
    expect(normalizePhone(' (214)  555-0100 ')).toBe('(214) 555-0100');
  });

  it('rejects negative party counts', () => {
    expect(() =>
      createGuestInputSchema.parse({ ...base, preferredChannel: 'MANUAL', adultsPlanned: -1 }),
    ).toThrow();
  });
});

describe('invitation lookup validation', () => {
  it('requires both an invited name and contact value', () => {
    expect(
      invitationLookupRequestSchema.safeParse({
        publicSlug: 'raymundo-6',
        displayName: 'Family Sample',
      }).success,
    ).toBe(false);
  });
});

describe('public invitation privacy', () => {
  it('strips all private guest and invitation fields', () => {
    const result = publicInvitationSchema.parse({
      event: {
        title: 'Birthday',
        celebrantName: 'Raymundo',
        celebrantAge: 6,
        eventType: 'KIDS_BIRTHDAY',
        status: 'DRAFT',
        startsAt: '2026-08-06T18:00:00.000Z',
        endsAt: null,
        timezone: 'America/Chicago',
        locale: 'en-US',
        venueName: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: null,
        publicSlug: 'raymundo-6',
        templateKey: 'kids-night-dragon',
        templateVersion: 1,
        hostMessage: null,
        rsvpDeadline: null,
      },
      guestDisplayName: 'Family Sample',
      status: 'OPENED',
      locale: 'en-US',
      openedPreviously: false,
      capabilities: { canRespond: false, canAddToCalendar: false },
      email: 'private@example.test',
      phone: 'private',
      privateNotes: 'private',
      guestId: '11111111-1111-4111-8111-111111111111',
      tokenPrefix: 'private',
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('guestId');
    expect(JSON.stringify(result)).not.toContain('private@example.test');
  });
});
