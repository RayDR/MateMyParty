import { describe, expect, it } from 'vitest';
import {
  invitationLookupRequestSchema,
  invitationPresentationModeSchema,
  normalizeLookupEmail,
  normalizeLookupName,
  normalizeLookupPhone,
  publicEventLandingSchema,
} from './public-experience.js';

const landing = {
  lookupIdentifier: 'raymundo-6',
  publicSlug: 'raymundo-6',
  defaultLocale: 'en-US',
  primaryHostname: 'raymundo6th.domoforge.com',
  localizedContent: {
    'en-US': {
      headline: 'Raymundo is turning 6!',
      description: 'A private celebration is taking shape.',
      thumbnailAltText: 'Night-sky illustration',
    },
    'es-MX': {
      headline: '¡Raymundo cumple 6!',
      description: 'Una celebración privada está tomando forma.',
      thumbnailAltText: 'Ilustración nocturna',
    },
  },
  presentation: {
    templateKey: 'kids-night-dragon',
    mode: 'NIGHT_DRAGON_FLIGHT',
    animationEnabled: true,
    videoRef: '/private-media/raymundo-6/intro.mp4',
    audioRef: '/private-media/raymundo-6/theme.mp3',
    staticFallbackRef: '/private-media/raymundo-6/fallback.webp',
    thumbnailRef: '/private-media/raymundo-6/thumbnail.webp',
    overlayIntensity: 55,
  },
  lookupEnabled: true,
};

describe('public invitation experience contracts', () => {
  it('strips private event and guest details from the public landing contract', () => {
    const parsed = publicEventLandingSchema.parse({
      ...landing,
      startsAt: '2026-08-06T18:00:00.000Z',
      venueName: 'Private venue',
      addressLine1: 'Private address',
      guestDisplayName: 'Private guest',
      invitedCount: 4,
    });
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('2026-08-06');
    expect(serialized).not.toContain('Private venue');
    expect(serialized).not.toContain('Private address');
    expect(serialized).not.toContain('Private guest');
  });

  it('requires a name plus a full email or phone', () => {
    expect(
      invitationLookupRequestSchema.safeParse({ ...landing, displayName: 'Family' }).success,
    ).toBe(false);
    expect(
      invitationLookupRequestSchema.safeParse({
        eventIdentifier: 'raymundo-6',
        displayName: 'Family',
        method: 'EMAIL',
        contact: 'guest@example.test',
      }).success,
    ).toBe(true);
    expect(
      invitationLookupRequestSchema.safeParse({
        eventIdentifier: 'raymundo-6',
        displayName: 'Family',
        method: 'PHONE',
        contact: '555-01',
      }).success,
    ).toBe(false);
  });

  it('normalizes exact matching without inventing a country code', () => {
    expect(normalizeLookupName('  Family   SAMPLE ')).toBe('family sample');
    expect(normalizeLookupEmail(' Guest@Example.TEST ')).toBe('guest@example.test');
    expect(normalizeLookupPhone('(214) 555-0100')).toBe('2145550100');
    expect(normalizeLookupPhone('+1 (214) 555-0100')).toBe('+12145550100');
  });

  it('supports exactly the four reusable presentation modes', () => {
    expect(invitationPresentationModeSchema.options).toEqual([
      'NIGHT_DRAGON_FLIGHT',
      'ADVENTURE_GATES',
      'ENVELOPE_REVEAL',
      'WINTER_SNOW',
    ]);
  });
});
