import {
  calendarEventSchema,
  hostCalendarPreviewSchema,
  mapLinksSchema,
  type CalendarEvent,
  type HostCalendarPreview,
  type MapLinks,
} from '@matemyparty/contracts';
import type { eventLocalizations, events } from '@matemyparty/database';
import type { Locale } from '@matemyparty/i18n';

type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;

export const CALENDAR_PROVIDER_FALLBACK_MINUTES = 120;

export function buildMapLinks(event: EventRow): MapLinks | null {
  const hasCoordinates = event.latitude !== null && event.longitude !== null;
  const hasCompleteAddress = Boolean(event.addressLine1 && event.city && event.countryCode);
  if (!hasCoordinates && !hasCompleteAddress) return null;

  const address = formatAddress(event);
  const query = hasCoordinates ? `${event.latitude},${event.longitude}` : address;
  const google = new URL('https://www.google.com/maps/search/');
  google.searchParams.set('api', '1');
  google.searchParams.set('query', query);
  const apple = new URL('https://maps.apple.com/');
  apple.searchParams.set('q', address || query);
  if (hasCoordinates) apple.searchParams.set('ll', query);

  return mapLinksSchema.parse({
    formattedAddress: address || query,
    googleMapsUrl: google.toString(),
    appleMapsUrl: apple.toString(),
    configuredMapsUrl: event.mapsUrl,
    usesCoordinates: hasCoordinates,
  });
}

export function buildCalendarEvent(
  event: EventRow,
  localization: LocalizationRow | undefined,
  locale: Locale,
  invitationUrl: string,
): CalendarEvent {
  const title = localization?.title ?? event.title;
  const hostMessage = localization?.hostMessage ?? event.hostMessage;
  const arrivalInstructions = localization?.arrivalInstructions ?? null;
  const providerEnd =
    event.endsAt ?? addMinutes(event.startsAt, CALENDAR_PROVIDER_FALLBACK_MINUTES);
  const location = [localization?.venueName ?? event.venueName, formatAddress(event)]
    .filter(Boolean)
    .join(', ');
  const description = [hostMessage, arrivalInstructions, invitationUrl]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  const google = new URL('https://calendar.google.com/calendar/render');
  google.searchParams.set('action', 'TEMPLATE');
  google.searchParams.set('text', title);
  google.searchParams.set(
    'dates',
    `${calendarTimestamp(event.startsAt)}/${calendarTimestamp(providerEnd)}`,
  );
  google.searchParams.set('ctz', event.timezone);
  if (location) google.searchParams.set('location', location);
  if (description) google.searchParams.set('details', description);

  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.searchParams.set('path', '/calendar/action/compose');
  outlook.searchParams.set('rru', 'addevent');
  outlook.searchParams.set('subject', title);
  outlook.searchParams.set('startdt', event.startsAt.toISOString());
  outlook.searchParams.set('enddt', providerEnd.toISOString());
  if (location) outlook.searchParams.set('location', location);
  if (description) outlook.searchParams.set('body', description);

  return calendarEventSchema.parse({
    title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    location: location || null,
    description: hostMessage?.slice(0, 4000) ?? null,
    arrivalInstructions,
    invitationUrl,
    googleCalendarUrl: google.toString(),
    outlookCalendarUrl: outlook.toString(),
    icsDownloadUrl: '/internal/calendar/ics',
    filename: calendarFilename(event.publicSlug),
    locale,
  });
}

export function buildHostCalendarPreview(
  event: EventRow,
  localization: LocalizationRow | undefined,
  locale: Locale,
  invitationUrl: string,
): HostCalendarPreview {
  return hostCalendarPreviewSchema.parse({
    event: buildCalendarEvent(event, localization, locale, invitationUrl),
    maps: buildMapLinks(event),
    stableUid: calendarUid(event.publicCode),
    providerFallbackMinutes: CALENDAR_PROVIDER_FALLBACK_MINUTES,
  });
}

export function createIcs(
  event: EventRow,
  localization: LocalizationRow | undefined,
  invitationUrl: string,
): string {
  const title = localization?.title ?? event.title;
  const location = [localization?.venueName ?? event.venueName, formatAddress(event)]
    .filter(Boolean)
    .join(', ');
  const description = [
    localization?.hostMessage ?? event.hostMessage,
    localization?.arrivalInstructions,
    invitationUrl,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MateMyParty//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${escapeIcs(event.timezone)}`,
    'BEGIN:VEVENT',
    `UID:${calendarUid(event.publicCode)}`,
    `DTSTAMP:${calendarTimestamp(event.updatedAt)}`,
    `DTSTART:${calendarTimestamp(event.startsAt)}`,
    ...(event.endsAt ? [`DTEND:${calendarTimestamp(event.endsAt)}`] : []),
    `SUMMARY:${escapeIcs(title)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    `URL:${escapeIcs(invitationUrl)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.flatMap(foldIcsLine).join('\r\n')}\r\n`;
}

export function calendarUid(publicCode: string): string {
  return `${publicCode}@calendar.matemyparty.domoforge.com`;
}

export function calendarFilename(publicSlug: string): string {
  const safeSlug = publicSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return `matemyparty-${safeSlug || 'event'}.ics`;
}

export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function formatAddress(event: EventRow): string {
  return [
    event.addressLine1,
    event.addressLine2,
    event.city,
    event.region,
    event.postalCode,
    event.countryCode,
  ]
    .filter(Boolean)
    .join(', ')
    .slice(0, 1000);
}

function calendarTimestamp(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

function foldIcsLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    const limit = result.length === 0 ? 75 : 74;
    if (bytes + characterBytes > limit) {
      result.push(result.length === 0 ? current : ` ${current}`);
      current = character;
      bytes = characterBytes;
    } else {
      current += character;
      bytes += characterBytes;
    }
  }
  result.push(result.length === 0 ? current : ` ${current}`);
  return result;
}
