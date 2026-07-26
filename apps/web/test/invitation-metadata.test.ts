import { describe, expect, it } from 'vitest';
import { publicInvitationSchema } from '@matemyparty/contracts';
import { invitationMetadata } from '../lib/invitation-metadata';

const invitation = publicInvitationSchema.parse({
  event: {
    title: 'Canonical title',
    celebrantName: 'Private public-page personalization',
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
  guestDisplayName: 'Family Private',
  status: 'READY',
  locale: 'es-MX',
  openedPreviously: false,
  shareMetadata: {
    title: 'Sexto cumpleaños de Raymundo',
    description: 'Estás invitado a una celebración privada.',
    thumbnailImageRef: '/private-media/raymundo-6/thumbnail.webp',
    thumbnailAltText: 'Ilustración del cumpleaños',
  },
  capabilities: { canRespond: false, canAddToCalendar: false },
});

describe('invitation metadata privacy', () => {
  it('uses only safe localized sharing fields and remains noindex', () => {
    const metadata = invitationMetadata(invitation);
    const serialized = JSON.stringify(metadata);
    expect(metadata.title).toBe('Sexto cumpleaños de Raymundo');
    expect(serialized).not.toContain('Family Private');
    expect(serialized).not.toContain('Private public-page personalization');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('does not expose event metadata for an invalid invitation', () => {
    expect(JSON.stringify(invitationMetadata(null))).not.toContain('Raymundo');
  });
});
