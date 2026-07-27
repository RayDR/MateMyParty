import { privateInvitationSchema, publicEventLandingSchema } from '@matemyparty/contracts';

export const presentation = {
  templateKey: 'kids-night-dragon' as const,
  mode: 'NIGHT_DRAGON_FLIGHT' as const,
  animationEnabled: true,
  videoRef: '/private-media/raymundo-6/intro.mp4',
  audioRef: '/private-media/raymundo-6/theme.mp3',
  staticFallbackRef: '/private-media/raymundo-6/fallback.webp',
  thumbnailRef: '/private-media/raymundo-6/thumbnail.webp',
  overlayIntensity: 50,
};

export const publicLanding = publicEventLandingSchema.parse({
  lookupIdentifier: 'raymundo-6',
  publicSlug: 'raymundo-6',
  defaultLocale: 'en-US',
  primaryHostname: 'raymundo6th.domoforge.com',
  localizedContent: {
    'en-US': {
      headline: 'Raymundo is turning 6!',
      description: 'A private celebration is taking shape.',
      thumbnailAltText: 'Night-sky birthday illustration',
    },
    'es-MX': {
      headline: '¡Raymundo cumple 6!',
      description: 'Una celebración privada está tomando forma.',
      thumbnailAltText: 'Ilustración nocturna de cumpleaños',
    },
  },
  presentation,
  lookupEnabled: true,
});

export const privateInvitation = privateInvitationSchema.parse({
  event: {
    publicSlug: 'raymundo-6',
    defaultLocale: 'en-US',
    celebrantAge: 6,
    startsAt: '2026-08-06T18:00:00.000Z',
    endsAt: null,
    timezone: 'America/Chicago',
    addressLine1: '123 Celebration Lane',
    addressLine2: null,
    city: 'Dallas',
    region: 'Texas',
    postalCode: '75201',
    countryCode: 'US',
    mapsUrl: 'https://maps.example.test/celebration',
    rsvpDeadline: null,
    localizedContent: {
      'en-US': {
        title: 'Raymundo’s 6th Birthday',
        celebrantName: 'Raymundo',
        venueName: 'Celebration Center',
        hostMessage: 'We cannot wait to celebrate with you.',
        arrivalInstructions: 'Please arrive ten minutes early.',
        thumbnailAltText: 'Night-sky birthday illustration',
      },
      'es-MX': {
        title: 'Sexto cumpleaños de Raymundo',
        celebrantName: 'Raymundo',
        venueName: 'Centro de celebraciones',
        hostMessage: 'Nos encantará celebrar contigo.',
        arrivalInstructions: 'Llega diez minutos antes.',
        thumbnailAltText: 'Ilustración nocturna de cumpleaños',
      },
    },
    presentation,
  },
  guestDisplayName: 'Family Sample',
  party: {
    mode: 'ADULTS_AND_CHILDREN',
    totalInvited: 4,
    adultsInvited: 2,
    childrenInvited: 2,
  },
  invitationLocale: 'en-US',
  openedPreviously: false,
  rsvp: null,
  shareMetadata: {
    title: 'Raymundo’s 6th Birthday',
    description: 'You are invited to Raymundo’s 6th Birthday.',
    hostname: 'raymundo6th.domoforge.com',
    thumbnailImageRef: '/private-media/raymundo-6/thumbnail.webp',
    thumbnailAltText: 'Night-sky birthday illustration',
  },
  capabilities: { canRespond: true, canAddToCalendar: false },
});
