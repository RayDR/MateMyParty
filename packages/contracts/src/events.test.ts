import { describe, expect, it } from 'vitest';
import {
  normalizeHostname,
  publicEventCodeSchema,
  publicEventSchema,
  updateHostEventInputSchema,
} from './events.js';

const validUpdate = {
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY',
  status: 'DRAFT',
  startsAt: '2026-08-06T18:00:00.000Z',
  endsAt: null,
  timezone: 'America/Chicago',
  defaultLocale: 'en-US',
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  latitude: null,
  longitude: null,
  mapsUrl: null,
  thumbnailImageRef: null,
  publicThumbnailRef: null,
  staticBackgroundRef: null,
  rsvpDeadline: null,
  localizedContent: {
    'en-US': {
      title: 'Raymundo’s 6th Birthday',
      celebrantName: 'Raymundo',
      venueName: 'Kids Empire Dallas Hillcrest',
      hostMessage: null,
      arrivalInstructions: null,
      parkingInstructions: null,
      thumbnailAltText: 'Raymundo’s 6th birthday',
    },
    'es-MX': {
      title: 'Sexto cumpleaños de Raymundo',
      celebrantName: 'Raymundo',
      venueName: 'Kids Empire Dallas Hillcrest',
      hostMessage: null,
      arrivalInstructions: null,
      parkingInstructions: null,
      thumbnailAltText: 'Sexto cumpleaños de Raymundo',
    },
  },
  template: {
    key: 'kids-night-dragon',
    version: 1,
    animationMode: 'IMMERSIVE',
    videoBackgroundRef: '/private-media/raymundo-6/dragons-intro.mp4',
    staticFallbackRef: null,
    audioRef: '/private-media/raymundo-6/dragons-theme.mp3',
    animationEnabled: true,
    audioEnabled: true,
    overlayIntensity: 50,
  },
} as const;

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
      ownerUserId: '11111111-1111-4111-8111-111111111111',
    });
    expect(event).not.toHaveProperty('id');
    expect(event).not.toHaveProperty('ownerUserId');
    expect(event.publicSlug).toBe('raymundo-6');
  });

  it('accepts random URL-safe public event codes and rejects ambiguous formats', () => {
    expect(publicEventCodeSchema.parse('SQ52LQE9')).toBe('SQ52LQE9');
    expect(publicEventCodeSchema.safeParse('22222222-2222-4222-8222-222222222222').success).toBe(
      false,
    );
    expect(publicEventCodeSchema.safeParse('CODE0001').success).toBe(false);
  });

  it('validates complete bilingual event updates', () => {
    expect(updateHostEventInputSchema.parse(validUpdate).localizedContent['es-MX'].title).toContain(
      'Raymundo',
    );
  });

  it('rejects an end time before the start time', () => {
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        endsAt: '2026-08-06T17:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('requires valid coordinate pairs and validates the public thumbnail path', () => {
    expect(updateHostEventInputSchema.safeParse({ ...validUpdate, latitude: 32.8 }).success).toBe(
      false,
    );
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        latitude: 32.8,
        longitude: -96.8,
        publicThumbnailRef: '/event-thumbnails/raymundo-6/share.webp',
      }).success,
    ).toBe(true);
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        publicThumbnailRef: '/private-media/raymundo-6/share.webp',
      }).success,
    ).toBe(false);
  });

  it('requires both supported locales', () => {
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        localizedContent: { 'en-US': validUpdate.localizedContent['en-US'] },
      }).success,
    ).toBe(false);
    expect(
      updateHostEventInputSchema.safeParse({ ...validUpdate, defaultLocale: 'fr-FR' }).success,
    ).toBe(false);
  });

  it('rejects unsupported templates and unsafe media paths', () => {
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        template: { ...validUpdate.template, key: 'licensed-franchise-name' },
      }).success,
    ).toBe(false);
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        thumbnailImageRef: '/private-media/raymundo-6/../secret',
      }).success,
    ).toBe(false);
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        mapsUrl: 'https://user:password@maps.example.test/place',
      }).success,
    ).toBe(false);
    expect(
      updateHostEventInputSchema.safeParse({
        ...validUpdate,
        publicThumbnailRef: 'https://user:password@images.example.test/share.webp',
      }).success,
    ).toBe(false);
  });
});
