import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostGuest } from '@matemyparty/contracts';
import { HostGuestPanel } from '../components/host-guest-panel';
import { hostEventDetail } from './host-event-fixture';
import { privateInvitation } from './public-experience-fixture';

const guest: HostGuest = {
  id: '55555555-5555-4555-8555-555555555555',
  displayName: 'Family Sample',
  contactName: null,
  email: null,
  phone: null,
  preferredChannel: 'MANUAL',
  locale: 'en-US',
  invitationCountMode: 'TOTAL_ONLY',
  totalInvited: 4,
  adultsInvited: null,
  childrenInvited: null,
  privateNotes: null,
  notificationEligibility: {
    canNotifyAutomatically: false,
    canEmail: false,
    canSms: false,
    reason: 'NO_CONTACT',
  },
  invitation: null,
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
  archivedAt: null,
};

function response(value: unknown) {
  return Promise.resolve({ ok: true, json: async () => value });
}

function mockRequests(currentGuest: HostGuest = guest) {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/presentation-preview'))
      return response({
        landing: {},
        invitation: privateInvitation,
      });
    if (url.includes('/share-preview'))
      return response({
        eventTitle: 'Raymundo’s 6th Birthday',
        invitationText: 'You are invited to Raymundo’s 6th Birthday.',
        smsText: "You're invited! /i/…",
        smsCharacterCount: 23,
        hostname: 'raymundo6th.domoforge.com',
        publicUrlTemplate: 'https://raymundo6th.domoforge.com/i/…',
        publicThumbnailRef: '/event-thumbnails/raymundo-6/share.webp',
        thumbnailAltText: 'Birthday thumbnail',
        whatsAppApproximation: true,
        maps: null,
        calendar: {
          title: 'Raymundo’s 6th Birthday',
          startsAt: '2026-08-06T18:00:00.000Z',
          endsAt: null,
          timezone: 'America/Chicago',
          location: 'Celebration Center, Dallas',
          description: null,
          arrivalInstructions: null,
          invitationUrl: 'https://raymundo6th.domoforge.com/',
          googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
          outlookCalendarUrl: 'https://outlook.live.com/calendar/0/deeplink/compose',
          icsDownloadUrl: '/internal/calendar/ics',
          filename: 'matemyparty-raymundo-6.ics',
          locale: 'en-US',
        },
        locale: 'en-US',
      });
    if (url.includes('/guest-statistics'))
      return response({
        totalGuests: 1,
        totalPeopleInvited: 4,
        generated: currentGuest.invitation ? 1 : 0,
        notGenerated: currentGuest.invitation ? 0 : 1,
        opened: 0,
        notOpened: currentGuest.invitation ? 1 : 0,
        revoked: 0,
        notContactable: 1,
      });
    if (url.includes('/rsvp-statistics'))
      return response({
        pending: currentGuest.invitation?.rsvp ? 0 : currentGuest.invitation ? 1 : 0,
        accepted: currentGuest.invitation?.rsvp?.status === 'ACCEPTED' ? 1 : 0,
        declined: 0,
        notSure: 0,
        cancelled: 0,
        confirmedTotal: currentGuest.invitation?.rsvp?.totalAttending ?? 0,
        confirmedAdults: currentGuest.invitation?.rsvp?.adultsAttending ?? 0,
        confirmedChildren: currentGuest.invitation?.rsvp?.childrenAttending ?? 0,
        invitationsWithoutResponse: currentGuest.invitation?.rsvp ? 0 : 1,
      });
    if (url.includes('/email/statistics'))
      return response({
        eligibleGuests: currentGuest.emailDelivery?.eligibility.eligible ? 1 : 0,
        ineligibleGuests: currentGuest.emailDelivery?.eligibility.eligible ? 0 : 1,
        queued: 0,
        sending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        cancelled: 0,
      });
    if (url.includes('/email/preview'))
      return response({
        subject: 'Invitation: Raymundo birthday',
        html: '<!doctype html><html><body>Responsive invitation preview</body></html>',
        text: 'Responsive invitation preview',
        locale: 'en-US',
        eventTitle: 'Raymundo birthday',
        publicThumbnailUrl: null,
        usesPlaceholderLink: true,
      });
    if (url.includes('/email/send'))
      return response({
        attempt: {
          id: '99999999-9999-4999-8999-999999999999',
          invitationId: '77777777-7777-4777-8777-777777777777',
          status: 'SENT',
          provider: 'stub',
          providerStatus: 'ACCEPTED',
          attemptNumber: 1,
          locale: 'en-US',
          subject: 'Invitation: Raymundo birthday',
          retryable: false,
          safeErrorCode: null,
          safeErrorMessage: null,
          queuedAt: '2026-07-27T00:00:00.000Z',
          sentAt: '2026-07-27T00:00:01.000Z',
          deliveredAt: null,
          failedAt: null,
          createdAt: '2026-07-27T00:00:00.000Z',
          updatedAt: '2026-07-27T00:00:01.000Z',
        },
        invitation: {
          id: '77777777-7777-4777-8777-777777777777',
          status: 'SENT',
          locale: 'en-US',
          tokenPrefix: 'abcdefgh',
          firstOpenedAt: null,
          lastOpenedAt: null,
          openCount: 0,
          createdAt: '2026-07-27T00:00:00.000Z',
          updatedAt: '2026-07-27T00:00:01.000Z',
          revokedAt: null,
        },
        publicUrl: 'https://raymundo6th.domoforge.com/i/private-once',
        duplicate: false,
      });
    if (url.includes('/invitations/') && url.endsWith('/rsvp'))
      return response({
        invitationId: currentGuest.invitation?.id,
        guestId: currentGuest.id,
        guestDisplayName: currentGuest.displayName,
        invitationCountMode: currentGuest.invitationCountMode,
        invited: { total: 4, adults: null, children: null },
        current: currentGuest.invitation?.rsvp
          ? {
              ...currentGuest.invitation.rsvp,
              dietaryNotes: 'No peanuts',
              guestMessage: 'See you there',
              respondedAt: '2026-07-27T01:00:00.000Z',
            }
          : null,
        history: [],
      });
    if (url.includes('/guests?')) return response([currentGuest]);
    if (url.endsWith('/internal/host/events/raymundo-6')) return response(hostEventDetail);
    return response({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('host guest management screen', () => {
  it('renders mobile cards, the desktop table, statistics, and a contact warning', async () => {
    mockRequests();
    const { container } = render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    expect(await screen.findByRole('heading', { name: 'Family Sample' })).toBeInTheDocument();
    expect(container.querySelector('article')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText('Cannot receive automatic notifications').length).toBeGreaterThan(0);
    expect(screen.getByText('People invited').previousSibling?.textContent).toBe('4');
  });

  it('uses a confirmation before a destructive revoke action', async () => {
    const invitedGuest: HostGuest = {
      ...guest,
      invitation: {
        id: '77777777-7777-4777-8777-777777777777',
        status: 'READY',
        locale: 'en-US',
        tokenPrefix: 'abcdefgh',
        firstOpenedAt: null,
        lastOpenedAt: null,
        openCount: 0,
        createdAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-26T00:00:00.000Z',
        revokedAt: null,
      },
    };
    const fetchMock = mockRequests(invitedGuest);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findAllByRole('heading', { name: 'Family Sample' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]!);
    expect(confirm).toHaveBeenCalledWith('Revoke this invitation? The link will stop working.');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/revoke'))).toBe(false);
  });

  it('submits total-only guest creation without exposing a UUID in the visible route', async () => {
    const fetchMock = mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findByRole('heading', { name: 'Family Sample' });
    await userEvent.click(screen.getByRole('button', { name: 'Add a guest or family' }));
    expect(screen.getByRole('dialog', { name: 'Add a guest or family' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Guest or family name'), 'New Family');
    const total = screen.getByLabelText('Total invited');
    await userEvent.clear(total);
    await userEvent.type(total, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Add guest' }));
    const request = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/events/raymundo-6/guests') && init?.method === 'POST',
    );
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      invitationCountMode: 'TOTAL_ONLY',
      totalInvited: 3,
      adultsInvited: null,
      childrenInvited: null,
    });
    expect(window.location.pathname).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
  });

  it('filters RSVP state and opens the host-only current response detail', async () => {
    const invitedGuest: HostGuest = {
      ...guest,
      invitation: {
        id: '77777777-7777-4777-8777-777777777777',
        status: 'OPENED',
        locale: 'en-US',
        tokenPrefix: 'abcdefgh',
        firstOpenedAt: '2026-07-27T00:00:00.000Z',
        lastOpenedAt: '2026-07-27T00:00:00.000Z',
        openCount: 1,
        createdAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-27T01:00:00.000Z',
        revokedAt: null,
        rsvp: {
          status: 'ACCEPTED',
          totalAttending: 3,
          adultsAttending: null,
          childrenAttending: null,
          hasDietaryNotes: true,
          hasGuestMessage: true,
          updatedAt: '2026-07-27T01:00:00.000Z',
        },
      },
    };
    mockRequests(invitedGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findAllByRole('heading', { name: 'Family Sample' });
    expect(screen.getAllByText('3 attending').length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'RSVP details' })[0]!);
    expect(await screen.findByRole('dialog', { name: 'RSVP details' })).toBeInTheDocument();
    expect(screen.getByText(/No peanuts/)).toBeInTheDocument();
    expect(screen.getByText(/See you there/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter guests'), 'dietaryNotes');
    expect(screen.getAllByRole('heading', { name: 'Family Sample' }).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Filter guests'), 'guestMessage');
    expect(screen.getAllByRole('heading', { name: 'Family Sample' }).length).toBeGreaterThan(0);
  });

  it('unifies invitation, message, and email previews in one mobile-safe dialog', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0]!);

    const dialog = await screen.findByRole('dialog', {
      name: 'Invitation sharing preview',
    });

    expect(dialog).toHaveClass('overflow-hidden');
    expect(screen.getByRole('tab', { name: 'Social / Open Graph preview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/Approximation only/)).toBeInTheDocument();
    expect(screen.getByText('SMS preview')).toBeInTheDocument();
    expect(screen.getByText(/characters/)).toBeInTheDocument();
    expect(screen.getByText('Calendar preview')).toBeInTheDocument();
    expect(screen.getByText(/SMS delivery is unavailable/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Preview invitation' }));

    expect(await screen.findByTestId('unified-invitation-viewport')).toHaveAttribute(
      'data-viewport',
      'mobile',
    );
    expect(screen.getByRole('button', { name: 'Open invitation' })).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: 'Email preview' }));

    expect(await screen.findByTitle('Email preview')).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('Responsive invitation preview'),
    );
  });

  it('previews real email HTML and sends through the CSRF-protected route', async () => {
    const emailGuest: HostGuest = {
      ...guest,
      email: 'guest@example.test',
      preferredChannel: 'EMAIL',
      notificationEligibility: {
        canNotifyAutomatically: true,
        canEmail: true,
        canSms: false,
        reason: 'ELIGIBLE',
      },
      emailDelivery: {
        eligibility: {
          eligible: true,
          action: 'GENERATE_AND_SEND',
          reason: 'ELIGIBLE',
          requiresRegeneration: false,
        },
        lastAttempt: null,
        retryAvailable: false,
      },
    };
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const fetchMock = mockRequests(emailGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview email' })[0]!);
    expect(
      await screen.findByRole('dialog', { name: 'Invitation sharing preview' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Email preview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByTitle('Email preview')).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('Responsive invitation preview'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    await userEvent.click(screen.getAllByRole('button', { name: 'Generate and send email' })[0]!);
    const sendRequest = fetchMock.mock.calls.find(([url]) => String(url).includes('/email/send'));
    expect(sendRequest?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mmp-csrf': '1' },
    });
    expect(JSON.parse(String(sendRequest?.[1]?.body))).toMatchObject({
      regenerate: false,
      overridePreferredChannel: false,
    });

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0]!);

    expect(writeText).toHaveBeenCalledWith('https://raymundo6th.domoforge.com/i/private-once');

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });
});
