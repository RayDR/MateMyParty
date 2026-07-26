import { describe, expect, it } from 'vitest';
import { normalizeHostname, publicEventSchema } from './events.js';

describe('event contracts', () => {
  it('normalizes a hostname before lookup', () => {
    expect(normalizeHostname('  Raymundo6TH.Domoforge.COM.:443 ')).toBe(
      'raymundo6th.domoforge.com',
    );
  });

  it('accepts public event data without internal identifiers', () => {
    const event = publicEventSchema.parse({
      title: 'Raymundo’s 6th Birthday',
      celebrantName: 'Raymundo',
      celebrantAge: 6,
      eventType: 'KIDS_BIRTHDAY',
      status: 'DRAFT',
      startsAt: '2026-08-06T18:00:00.000Z',
      endsAt: null,
      timezone: 'America/Chicago',
      locale: 'en-US',
      venueName: 'Kids Empire Dallas Hillcrest',
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
    });
    expect(event).not.toHaveProperty('id');
    expect(event.publicSlug).toBe('raymundo-6');
  });
});
