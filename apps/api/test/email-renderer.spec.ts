import type { events, guests, invitations } from '@matemyparty/database';
import { emailEligibility } from '../src/email/email-delivery.service';
import { renderInvitationEmail, safeHeader } from '../src/email/email-renderer';

type EventRow = typeof events.$inferSelect;
type GuestRow = typeof guests.$inferSelect;
type InvitationRow = typeof invitations.$inferSelect;

const event = {
  id: '22222222-2222-4222-8222-222222222222',
  title: '<Birthday & celebration>',
  status: 'PUBLISHED',
  startsAt: new Date('2026-08-06T18:00:00.000Z'),
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: 'Dragon Hall',
  addressLine1: '100 Main Street',
  city: 'Dallas',
  region: 'TX',
  hostMessage: '<script>unsafe()</script>',
  publicThumbnailRef: '/event-thumbnails/raymundo-6/share.webp',
  videoBackgroundRef: '/private-media/raymundo-6/dragons-intro.mp4',
  audioRef: '/private-media/raymundo-6/dragons-theme.mp3',
} as EventRow;

const guest = {
  id: '55555555-5555-4555-8555-555555555555',
  eventId: event.id,
  email: 'guest@example.test',
  preferredChannel: 'EMAIL',
  locale: 'en-US',
  archivedAt: null,
} as GuestRow;

describe('invitation email rendering', () => {
  it('produces localized responsive HTML and plain text without executable host content', () => {
    const result = renderInvitationEmail({
      event,
      locale: 'es-MX',
      hostname: 'raymundo6th.domoforge.com',
      invitationUrl: 'https://raymundo6th.domoforge.com/i/private-token',
    });
    expect(result.subject).toContain('Invitación');
    expect(result.html).toContain('@media only screen and (max-width:600px)');
    expect(result.html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
    expect(result.html).not.toContain('<script>unsafe()</script>');
    expect(result.html).not.toContain('/private-media/');
    expect(result.text).toContain('Abre tu invitación');
    expect(result.publicThumbnailUrl).toBe(
      'https://raymundo6th.domoforge.com/event-thumbnails/raymundo-6/share.webp',
    );
  });

  it('rejects header injection and non-HTTPS private links', () => {
    expect(() => safeHeader('Invitation\r\nBcc: attacker@example.test', 200)).toThrow();
    expect(() =>
      renderInvitationEmail({
        event,
        locale: 'en-US',
        hostname: null,
        invitationUrl: 'http://example.test/i/token',
      }),
    ).toThrow();
  });

  it('renders an English plain-text alternative with the secure link and RSVP request', () => {
    const result = renderInvitationEmail({
      event,
      locale: 'en-US',
      hostname: null,
      invitationUrl: 'https://matemyparty.domoforge.com/i/private-token',
    });
    expect(result.text).toContain('Open your invitation to RSVP.');
    expect(result.text).toContain('https://matemyparty.domoforge.com/i/private-token');
    expect(result.text).not.toContain('/private-media/');
  });
});

describe('email eligibility', () => {
  it('generates for a new eligible guest and requires explicit rotation for an existing link', () => {
    expect(emailEligibility(guest, null, event, true, false)).toMatchObject({
      eligible: true,
      action: 'GENERATE_AND_SEND',
      requiresRegeneration: false,
    });
    expect(
      emailEligibility(guest, { revokedAt: null } as InvitationRow, event, true, false),
    ).toMatchObject({
      eligible: true,
      action: 'REGENERATE_AND_SEND',
      requiresRegeneration: true,
    });
  });

  it('fails closed for missing contact, disallowed channel, archived guest, draft event, or provider', () => {
    expect(emailEligibility({ ...guest, email: null }, null, event, true, false).reason).toBe(
      'EMAIL_MISSING',
    );
    expect(
      emailEligibility({ ...guest, preferredChannel: 'SMS' }, null, event, true, false).reason,
    ).toBe('CHANNEL_NOT_ALLOWED');
    expect(
      emailEligibility({ ...guest, archivedAt: new Date() }, null, event, true, false).reason,
    ).toBe('GUEST_ARCHIVED');
    expect(emailEligibility(guest, null, { ...event, status: 'DRAFT' }, true, false).reason).toBe(
      'EVENT_NOT_SENDABLE',
    );
    expect(emailEligibility(guest, null, event, false, false).reason).toBe('EMAIL_NOT_CONFIGURED');
  });
});
