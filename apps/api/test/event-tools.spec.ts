import type { eventLocalizations, events } from '@matemyparty/database';
import {
  buildCalendarEvent,
  buildMapLinks,
  calendarFilename,
  calendarUid,
  createIcs,
} from '../src/events/event-tools';

type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;

const event: EventRow = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  title: 'Raymundo, Birthday; Party',
  celebrantName: 'Raymundo',
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY',
  status: 'PUBLISHED',
  startsAt: new Date('2026-08-06T18:00:00.000Z'),
  endsAt: null,
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: 'Play & Learn',
  addressLine1: '123 Fun & Games Lane',
  addressLine2: 'Suite #2',
  city: 'Dallas',
  region: 'Texas',
  postalCode: '75201',
  countryCode: 'US',
  latitude: null,
  longitude: null,
  publicSlug: 'raymundo-6',
  publicCode: 'SQ52LQE9',
  templateKey: 'kids-night-dragon',
  templateVersion: 1,
  animationMode: 'NONE',
  videoBackgroundRef: null,
  staticFallbackRef: null,
  audioRef: null,
  animationEnabled: false,
  audioEnabled: false,
  overlayIntensity: 50,
  thumbnailImageRef: null,
  publicThumbnailRef: '/event-thumbnails/raymundo-6/share.webp',
  staticBackgroundRef: null,
  mapsUrl: 'https://maps.example.test/place?id=123',
  hostMessage: 'Bring joy\nand smiles.',
  rsvpDeadline: null,
  createdAt: new Date('2026-07-26T00:00:00.000Z'),
  updatedAt: new Date('2026-07-26T00:00:00.000Z'),
};

const localization: LocalizationRow = {
  id: '33333333-3333-4333-8333-333333333333',
  eventId: event.id,
  locale: 'en-US',
  title: event.title,
  celebrantName: event.celebrantName,
  venueName: event.venueName,
  hostMessage: event.hostMessage,
  arrivalInstructions: 'Enter through door 2; ask for Raymundo.',
  parkingInstructions: 'Free parking.',
  thumbnailAltText: 'Birthday illustration',
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
};

describe('event maps and calendar tools', () => {
  it('URL-encodes address fallback for Google and Apple Maps', () => {
    const links = buildMapLinks(event)!;
    expect(links.formattedAddress).toContain('Fun & Games');
    const completeLocation = `Play & Learn, ${links.formattedAddress}`;
    expect(new URL(links.googleMapsUrl!).searchParams.get('query')).toBe(completeLocation);
    expect(new URL(links.appleMapsUrl!).searchParams.get('q')).toBe(completeLocation);
    expect(links.usesCoordinates).toBe(false);
  });

  it("uses Raymundo's complete venue and address for both providers", () => {
    const links = buildMapLinks({
      ...event,
      venueName: 'Kids Empire Dallas Hillcrest',
      addressLine1: '6859 Arapaho Rd',
      addressLine2: null,
      city: 'Dallas',
      region: 'TX',
      postalCode: '75248',
      countryCode: 'US',
      mapsUrl: null,
    })!;
    const location = 'Kids Empire Dallas Hillcrest, 6859 Arapaho Rd, Dallas, TX, 75248, US';
    expect(new URL(links.googleMapsUrl!).searchParams.get('query')).toBe(location);
    expect(new URL(links.appleMapsUrl!).searchParams.get('q')).toBe(location);
  });

  it('keeps a configured URL as the only action when provider data is incomplete', () => {
    const links = buildMapLinks({
      ...event,
      addressLine1: null,
      city: null,
      countryCode: null,
      mapsUrl: 'https://maps.example.test/configured-place',
    })!;
    expect(links.configuredMapsUrl).toBe('https://maps.example.test/configured-place');
    expect(links.googleMapsUrl).toBeNull();
    expect(links.appleMapsUrl).toBeNull();
  });

  it('prefers configured coordinates and hides actions for incomplete locations', () => {
    const coordinates = buildMapLinks({ ...event, latitude: 32.8, longitude: -96.8 })!;
    expect(new URL(coordinates.googleMapsUrl!).searchParams.get('query')).toBe('32.8,-96.8');
    expect(coordinates.usesCoordinates).toBe(true);
    expect(
      buildMapLinks({
        ...event,
        addressLine1: null,
        city: null,
        countryCode: null,
        mapsUrl: null,
      }),
    ).toBeNull();
  });

  it('builds localized provider links with a non-persisted two-hour fallback', () => {
    const calendar = buildCalendarEvent(
      event,
      localization,
      'en-US',
      'https://raymundo6th.domoforge.com/',
    );
    expect(calendar.endsAt).toBeNull();
    expect(new URL(calendar.googleCalendarUrl).searchParams.get('dates')).toBe(
      '20260806T180000Z/20260806T200000Z',
    );
    expect(calendar.timezone).toBe('America/Chicago');
  });

  it('creates CRLF ICS with escaping, a stable UID, and no guest data', () => {
    const invitationUrl = 'https://raymundo6th.domoforge.com/';
    const first = createIcs(event, localization, invitationUrl);
    const second = createIcs(event, localization, invitationUrl);
    expect(first).toBe(second);
    expect(first).toContain(`UID:${calendarUid(event.publicCode)}`);
    expect(first).toContain('SUMMARY:Raymundo\\, Birthday\\; Party');
    expect(first).toContain('Bring joy\\nand smiles.');
    expect(first).toMatch(/\r\n/);
    expect(first.replace(/\r\n/g, '')).not.toContain('\n');
    expect(first).not.toContain('guest@example');
    expect(first).not.toContain('RSVP');
    expect(first).not.toContain('DTEND:');
  });

  it('sanitizes the attachment filename independently from stored input', () => {
    expect(calendarFilename('Raymundo\r\nContent-Disposition: bad')).toBe(
      'matemyparty-raymundo-content-disposition-bad.ics',
    );
  });
});
