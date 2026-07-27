import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostDashboard } from '../components/host-dashboard';
import { hostEventDetail, hostEventSummary } from './host-event-fixture';

afterEach(() => vi.restoreAllMocks());

describe('host events dashboard', () => {
  it('renders Raymundo’s event using public host routes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [hostEventSummary] }),
    );
    const { container } = render(<HostDashboard />);
    expect(
      await screen.findByRole('heading', { name: 'Raymundo’s 6th Birthday' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 guests/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage event' })).toHaveAttribute(
      'href',
      '/host/events/raymundo-6',
    );
    expect(screen.getByRole('link', { name: 'Manage guests and invitations' })).toHaveAttribute(
      'href',
      '/host/events/raymundo-6/guests',
    );
    expect(container.innerHTML).not.toContain('22222222-2222-4222-8222-222222222222');
  });

  it('opens a focused 4:3 thumbnail editor and saves both localized alt texts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        return Response.json({ ...hostEventDetail, ...body });
      }
      if (url.endsWith('/events/raymundo-6')) return Response.json(hostEventDetail);
      return Response.json([hostEventSummary]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<HostDashboard />);
    await screen.findByRole('heading', { name: 'Raymundo’s 6th Birthday' });
    await user.click(screen.getByRole('button', { name: 'Branding and thumbnail' }));
    expect(
      await screen.findByRole('dialog', { name: 'Branding and thumbnail' }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Thumbnail image reference'),
      '/private-media/raymundo-6/card.webp',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      thumbnailImageRef: '/private-media/raymundo-6/card.webp',
      localizedContent: {
        'en-US': { thumbnailAltText: 'Raymundo’s 6th birthday' },
        'es-MX': { thumbnailAltText: 'Sexto cumpleaños de Raymundo' },
      },
    });
  });
});
