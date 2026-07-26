import { describe, expect, it } from 'vitest';
import { normalizeHostname, publicEventPreviewSchema, publicEventSchema } from './events.js';

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

  it('redacts schedule, venue, address, and status from a public event preview', () => {
    const preview = publicEventPreviewSchema.parse({
      celebrantName: 'Raymundo',
      celebrantAge: 6,
      locale: 'en-US',
      publicSlug: 'raymundo-6',
      templateKey: 'kids-night-dragon',
      templateVersion: 1,
      startsAt: '2026-08-06T18:00:00.000Z',
      timezone: 'America/Chicago',
      venueName: 'Private venue',
      addressLine1: 'Private address',
      status: 'DRAFT',
    });

    expect(preview).not.toHaveProperty('startsAt');
    expect(preview).not.toHaveProperty('timezone');
    expect(preview).not.toHaveProperty('venueName');
    expect(preview).not.toHaveProperty('addressLine1');
    expect(preview).not.toHaveProperty('status');
  });
});
