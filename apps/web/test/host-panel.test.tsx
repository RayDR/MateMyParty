import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostGuest } from '@matemyparty/contracts';
import { HostGuestPanel } from '../components/host-guest-panel';
import { hostEventDetail } from './host-event-fixture';

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
    if (url.includes('/share-preview'))
      return response({
        eventTitle: 'Raymundo’s 6th Birthday',
        invitationText: 'You are invited to Raymundo’s 6th Birthday.',
        smsText: "You're invited! /i/…",
        hostname: 'raymundo6th.domoforge.com',
        thumbnailImageRef: null,
        thumbnailAltText: 'Birthday thumbnail',
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
  });
});
