import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

function mockRequests(initialGuest: HostGuest = guest) {
  let currentGuest = initialGuest;

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
    if (url.includes('/email/send')) {
      const sentAttempt = {
        id: '99999999-9999-4999-8999-999999999999',
        invitationId: '77777777-7777-4777-8777-777777777777',
        status: 'SENT' as const,
        provider: 'stub',
        providerStatus: 'ACCEPTED',
        attemptNumber: 1,
        locale: 'en-US' as const,
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
      };

      const sentInvitation = {
        id: '77777777-7777-4777-8777-777777777777',
        status: 'SENT' as const,
        locale: 'en-US' as const,
        tokenPrefix: 'abcdefgh',
        firstOpenedAt: null,
        lastOpenedAt: null,
        openCount: 0,
        createdAt: '2026-07-27T00:00:00.000Z',
        updatedAt: '2026-07-27T00:00:01.000Z',
        revokedAt: null,
      };

      currentGuest = {
        ...currentGuest,
        invitation: sentInvitation,
        emailDelivery: {
          eligibility: {
            eligible: true,
            action: 'REGENERATE_AND_SEND',
            reason: 'TOKEN_REGENERATION_REQUIRED',
            requiresRegeneration: true,
          },
          lastAttempt: sentAttempt,
          retryAvailable: false,
        },
      };

      return response({
        attempt: sentAttempt,
        invitation: sentInvitation,
        publicUrl: 'https://raymundo6th.domoforge.com/i/private-once',
        duplicate: false,
      });
    }
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
    expect(
      screen.getAllByRole('button', {
        name: 'No contact · Manual delivery available · Automatic notifications unavailable',
      }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('People invited').previousSibling?.textContent).toBe('4');
  });

  it('keeps private contact values out of the DOM until the host reveals them', async () => {
    const contactGuest: HostGuest = {
      ...guest,
      email: 'private@example.test',
      phone: '+1 214 555 0100',
      preferredChannel: 'BOTH',
      notificationEligibility: {
        canNotifyAutomatically: true,
        canEmail: true,
        canSms: true,
        reason: 'ELIGIBLE',
      },
    };

    mockRequests(contactGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+1 214 555 0100')).not.toBeInTheDocument();

    const globalToggle = screen.getByRole('checkbox', {
      name: 'Show private contact details',
    });

    await userEvent.click(globalToggle);

    expect(screen.getAllByText('private@example.test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+1 214 555 0100').length).toBeGreaterThan(0);

    await userEvent.click(globalToggle);

    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+1 214 555 0100')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Contact and delivery details',
      })[0]!,
    );

    expect(screen.getAllByText('private@example.test')).toHaveLength(1);
    expect(screen.getAllByText('+1 214 555 0100')).toHaveLength(1);
  });

  it('shows bulk actions after selecting a guest', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(
      screen.getAllByRole('checkbox', {
        name: 'Select Family Sample',
      })[0]!,
    );

    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('uses a themed confirmation before revoking an invitation', async () => {
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
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findAllByRole('heading', { name: 'Family Sample' });
    await userEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Revoke' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Revoke invitation',
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/revoke'))).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Revoke invitation' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/revoke'))).toBe(false);
  });

  it('regenerates without resending email from the regeneration action', async () => {
    const invitedGuest: HostGuest = {
      ...guest,
      email: 'guest@example.test',
      preferredChannel: 'EMAIL',
      notificationEligibility: {
        canNotifyAutomatically: true,
        canEmail: true,
        canSms: false,
        reason: 'ELIGIBLE',
      },
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
      emailDelivery: {
        eligibility: {
          eligible: true,
          action: 'REGENERATE_AND_SEND',
          reason: 'TOKEN_REGENERATION_REQUIRED',
          requiresRegeneration: true,
        },
        lastAttempt: null,
        retryAvailable: false,
      },
    };

    const fetchMock = mockRequests(invitedGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findAllByRole('heading', { name: 'Family Sample' });
    await userEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Regenerate' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Regenerate invitation',
    });
    expect(
      within(dialog).queryByRole('checkbox', {
        name: 'Resend invitation email',
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }));

    const regenerateRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/regenerate'),
    );

    expect(regenerateRequest).toBeDefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/email/send'))).toBe(false);
  });

  it('opens the guest editor from the explicit edit action', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);

    expect(screen.getByRole('dialog', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('opens the editor and focuses invitation counts from the compact count', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(
      screen.getAllByRole('button', {
        name: /Edit invitation count: 4 invited/i,
      })[0]!,
    );

    expect(await screen.findByRole('spinbutton', { name: 'Total invited' })).toHaveFocus();
  });

  it('updates invitation language inline after clicking its current value', async () => {
    const fetchMock = mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(
      screen.getAllByRole('button', {
        name: /Change invitation language: English/i,
      })[0]!,
    );

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Change invitation language' }),
      'es-MX',
    );

    const localeRequest = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith(`/internal/host/guests/${guest.id}`) && init?.method === 'PATCH',
    );

    expect(localeRequest).toBeDefined();
    expect(JSON.parse(String(localeRequest?.[1]?.body))).toEqual({
      locale: 'es-MX',
    });
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
    expect(screen.getAllByText('Accepted').length).toBeGreaterThan(0);
    const unreadMessage = screen.getAllByRole('button', {
      name: 'Unread guest message or request',
    })[0]!;
    await userEvent.click(unreadMessage);
    expect(
      screen.getAllByRole('button', {
        name: 'Guest message and request details',
      }).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByRole('dialog', { name: 'RSVP details' })).toBeInTheDocument();
    expect(screen.getByText(/No peanuts/)).toBeInTheDocument();
    expect(screen.getByText(/See you there/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter guests'), 'dietaryNotes');
    expect(screen.getAllByRole('heading', { name: 'Family Sample' }).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Filter guests'), 'guestMessage');
    expect(screen.getAllByRole('heading', { name: 'Family Sample' }).length).toBeGreaterThan(0);
  });

  it('opens invitation by default and switches previews from the compact menu', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0]!);

    const invitationDialog = await screen.findByRole('dialog', {
      name: 'Invitation sharing preview',
    });

    expect(invitationDialog).toHaveClass('overflow-hidden');
    expect(screen.getByRole('tab', { name: 'Preview invitation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByTestId('unified-invitation-viewport')).toHaveAttribute(
      'data-viewport',
      'mobile',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview options' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Social / Open Graph preview' }));

    expect(
      await screen.findByRole('dialog', { name: 'Invitation sharing preview' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Social / Open Graph preview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('SMS preview')).toBeInTheDocument();
    expect(screen.getByText('Calendar preview')).toBeInTheDocument();
  });

  it('shows opening details only when opening timestamps exist', async () => {
    const openedGuest: HostGuest = {
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
        updatedAt: '2026-07-27T00:00:00.000Z',
        revokedAt: null,
      },
    };

    mockRequests(openedGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    expect(screen.getAllByLabelText('Total openings: 1').length).toBeGreaterThan(0);
  });

  it('previews real email HTML, sends, and shares the generated invitation', async () => {
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
    const originalShare = navigator.share;
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nativeShare = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare,
    });

    const fetchMock = mockRequests(emailGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview options' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Email preview' }));
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

    const guestTable = screen.getByRole('table');
    await userEvent.click(
      within(guestTable).getByRole('button', {
        name: /Email notification:/i,
      }),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Send email',
      }),
    );
    const sendRequest = fetchMock.mock.calls.find(([url]) => String(url).includes('/email/send'));
    expect(sendRequest?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mmp-csrf': '1' },
    });
    expect(JSON.parse(String(sendRequest?.[1]?.body))).toMatchObject({
      regenerate: false,
      overridePreferredChannel: false,
    });

    const shareButton = await within(screen.getByRole('table')).findByRole('button', {
      name: 'Share invitation',
    });

    await userEvent.click(shareButton);

    expect(nativeShare).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://raymundo6th.domoforge.com/i/private-once',
      }),
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview options' })[0]!);
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: 'Social / Open Graph preview',
      }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://raymundo6th.domoforge.com/i/private-once');
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: originalShare,
    });
  });
});
