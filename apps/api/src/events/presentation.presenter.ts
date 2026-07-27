import {
  hostPresentationPreviewSchema,
  privateInvitationSchema,
  publicEventLandingSchema,
  type HostPresentationPreview,
  type InvitationPresentation,
  type PrivateInvitation,
  type PublicEventLanding,
  type PublicRsvpResponse,
} from '@matemyparty/contracts';
import type { eventLocalizations, events } from '@matemyparty/database';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { buildCalendarEvent, buildMapLinks } from './event-tools';

type EventRow = typeof events.$inferSelect;
type LocalizationRow = typeof eventLocalizations.$inferSelect;

export type PresentationRecord = {
  event: EventRow;
  localizations: LocalizationRow[];
  primaryHostname: string | null;
};

const presentationModes: Record<EventRow['templateKey'], InvitationPresentation['mode']> = {
  'kids-night-dragon': 'NIGHT_DRAGON_FLIGHT',
  'adventure-gates': 'ADVENTURE_GATES',
  'envelope-reveal': 'ENVELOPE_REVEAL',
  'winter-snow': 'WINTER_SNOW',
};

export function presentInvitationPresentation(event: EventRow): InvitationPresentation {
  return {
    templateKey: event.templateKey as InvitationPresentation['templateKey'],
    mode: presentationModes[event.templateKey] ?? 'ENVELOPE_REVEAL',
    animationEnabled: event.animationEnabled && event.animationMode !== 'NONE',
    videoRef: event.videoBackgroundRef,
    audioRef: event.audioEnabled ? event.audioRef : null,
    staticFallbackRef: event.staticFallbackRef ?? event.staticBackgroundRef,
    thumbnailRef: event.thumbnailImageRef,
    overlayIntensity: event.overlayIntensity,
  };
}

export function presentPublicLanding(record: PresentationRecord): PublicEventLanding {
  const content = (locale: Locale) => {
    const dictionary = getDictionary(locale).invitation;
    const localized = localization(record, locale);
    const headline = record.event.celebrantAge
      ? dictionary.publicLandingHeadline
          .replace('{celebrantName}', localized.celebrantName)
          .replace('{age}', String(record.event.celebrantAge))
      : dictionary.publicLandingHeadlineGeneric.replace('{celebrantName}', localized.celebrantName);
    return {
      headline,
      description: dictionary.publicLandingDescription,
      thumbnailAltText: localized.thumbnailAltText,
    };
  };
  return publicEventLandingSchema.parse({
    lookupIdentifier: record.event.publicSlug,
    publicSlug: record.event.publicSlug,
    defaultLocale: normalizeLocale(record.event.locale),
    primaryHostname: record.primaryHostname,
    localizedContent: { 'en-US': content('en-US'), 'es-MX': content('es-MX') },
    presentation: presentInvitationPresentation(record.event),
    lookupEnabled: true,
  });
}

export function presentPrivateInvitation(
  record: PresentationRecord,
  guest: {
    displayName: string;
    invitationCountMode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN';
    totalInvited: number;
    adultsInvited: number | null;
    childrenInvited: number | null;
  },
  invitationLocale: Locale,
  openedPreviously: boolean,
  rsvp: PublicRsvpResponse | null = null,
  canRespond = true,
): PrivateInvitation {
  const localizedContent = {
    'en-US': localization(record, 'en-US'),
    'es-MX': localization(record, 'es-MX'),
  };
  const selected = localizedContent[invitationLocale];
  return privateInvitationSchema.parse({
    event: {
      publicSlug: record.event.publicSlug,
      defaultLocale: normalizeLocale(record.event.locale),
      celebrantAge: record.event.celebrantAge,
      startsAt: record.event.startsAt.toISOString(),
      endsAt: record.event.endsAt?.toISOString() ?? null,
      timezone: record.event.timezone,
      addressLine1: record.event.addressLine1,
      addressLine2: record.event.addressLine2,
      city: record.event.city,
      region: record.event.region,
      postalCode: record.event.postalCode,
      countryCode: record.event.countryCode,
      latitude: record.event.latitude,
      longitude: record.event.longitude,
      mapsUrl: record.event.mapsUrl,
      rsvpDeadline: record.event.rsvpDeadline?.toISOString() ?? null,
      localizedContent,
      presentation: presentInvitationPresentation(record.event),
    },
    guestDisplayName: guest.displayName,
    party: {
      mode: guest.invitationCountMode,
      totalInvited: guest.totalInvited,
      adultsInvited: guest.adultsInvited,
      childrenInvited: guest.childrenInvited,
    },
    invitationLocale,
    openedPreviously,
    rsvp,
    tools: {
      maps: buildMapLinks(record.event),
      calendar: buildCalendarEvent(
        record.event,
        record.localizations.find((candidate) => candidate.locale === invitationLocale),
        invitationLocale,
        buildInvitationUrl(record.primaryHostname, '/'),
      ),
    },
    shareMetadata: {
      title: selected.title,
      description: getDictionary(invitationLocale).invitation.shareGeneric.replace(
        '{eventTitle}',
        selected.title,
      ),
      hostname: record.primaryHostname,
      thumbnailImageRef: record.event.publicThumbnailRef,
      thumbnailAltText: selected.thumbnailAltText,
    },
    capabilities: { canRespond, canAddToCalendar: true },
  });
}

export function presentHostPresentationPreview(
  record: PresentationRecord,
  locale: Locale,
): HostPresentationPreview {
  const dictionary = getDictionary(locale).invitation;
  return hostPresentationPreviewSchema.parse({
    landing: presentPublicLanding(record),
    invitation: presentPrivateInvitation(
      record,
      {
        displayName: dictionary.previewGuestName,
        invitationCountMode: 'ADULTS_AND_CHILDREN',
        totalInvited: 4,
        adultsInvited: 2,
        childrenInvited: 2,
      },
      locale,
      false,
      null,
      false,
    ),
  });
}

function localization(record: PresentationRecord, locale: Locale) {
  const row = record.localizations.find((candidate) => candidate.locale === locale);
  return {
    title: row?.title ?? record.event.title,
    celebrantName: row?.celebrantName ?? record.event.celebrantName,
    venueName: row?.venueName ?? record.event.venueName,
    hostMessage: row?.hostMessage ?? record.event.hostMessage,
    arrivalInstructions: row?.arrivalInstructions ?? null,
    parkingInstructions: row?.parkingInstructions ?? null,
    thumbnailAltText: row?.thumbnailAltText ?? record.event.title,
  };
}

function buildInvitationUrl(hostname: string | null, path: string): string {
  return hostname ? `https://${hostname}${path}` : `https://matemyparty.domoforge.com${path}`;
}

function normalizeLocale(locale: string): Locale {
  return locale === 'es-MX' ? 'es-MX' : 'en-US';
}
