import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvalidInvitation, PublicInvitation } from '../components/public-invitation';
import { privateInvitation } from './public-experience-fixture';

describe('/i/[token] content', () => {
  it('starts as a personal invitation and reveals private details only after opening', () => {
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    expect(screen.getByText('This invitation was prepared for Family Sample.')).toBeInTheDocument();
    expect(screen.queryByText(/1:00 PM/)).not.toBeInTheDocument();
    expect(screen.queryByText(/123 Celebration Lane/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play theme audio' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    expect(screen.getByRole('button', { name: 'Play theme audio' })).toBeInTheDocument();
    expect(screen.getByText(/1:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/123 Celebration Lane/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps'),
    );
    expect(screen.getByRole('link', { name: 'Apple Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('maps.apple.com'),
    );
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://maps.example.test/celebration',
    );
    expect(screen.getByText('Use the east parking lot.')).toBeInTheDocument();
    expect(screen.getByText('Location and directions').closest('details')).not.toHaveAttribute(
      'open',
    );
    expect(screen.getByText('Event details').closest('details')).toHaveAttribute('open');
    expect(document.body.textContent).not.toContain('@');
  });

  it('switches the complete private experience to es-MX', () => {
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es-MX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir invitación' }));
    expect(
      screen.getByRole('heading', { name: 'Sexto cumpleaños de Raymundo' }),
    ).toBeInTheDocument();
  });

  it('renders a neutral invalid invitation state', () => {
    render(<InvalidInvitation />);
    expect(
      screen.getByRole('heading', { name: 'This invitation is unavailable' }),
    ).toBeInTheDocument();
  });

  it('submits a bounded RSVP through the internal same-origin route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        status: 'ACCEPTED',
        totalAttending: 3,
        adultsAttending: 2,
        childrenAttending: 1,
        dietaryNotes: null,
        guestMessage: 'See you there',
        respondedAt: '2026-07-27T01:00:00.000Z',
        updatedAt: '2026-07-27T01:00:00.000Z',
      }),
    );
    render(
      <PublicInvitation
        invitation={privateInvitation}
        initialLocale="en-US"
        accessToken={'A'.repeat(43)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    fireEvent.change(screen.getByLabelText('Children attending'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Message for the host (optional)'), {
      target: { value: 'See you there' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));
    expect(await screen.findByText('Your RSVP has been saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/rsvp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-mmp-csrf': '1',
          'x-invitation-token': 'A'.repeat(43),
        }),
      }),
    );
    expect(await screen.findByText('3 people confirmed')).toBeInTheDocument();
    expect(screen.getByText(/See you there/)).toBeInTheDocument();
    expect(screen.getByText('Add to calendar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    );
    fetchMock.mockRestore();
  });

  it('disables RSVP mutations in host preview', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" preview />);
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    expect(screen.getByText(/RSVP controls are disabled/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save RSVP' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('updates an existing response and cancels confirmed attendance', async () => {
    const current = {
      status: 'ACCEPTED' as const,
      totalAttending: 4,
      adultsAttending: 2,
      childrenAttending: 2,
      dietaryNotes: 'Vegetarian meal',
      guestMessage: null,
      respondedAt: '2026-07-27T01:00:00.000Z',
      updatedAt: '2026-07-27T01:00:00.000Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      Response.json(
        init?.method === 'DELETE'
          ? {
              ...current,
              status: 'CANCELLED',
              totalAttending: null,
              adultsAttending: null,
              childrenAttending: null,
            }
          : {
              ...current,
              status: 'DECLINED',
              totalAttending: null,
              adultsAttending: null,
              childrenAttending: null,
            },
      ),
    );
    const { unmount } = render(
      <PublicInvitation
        invitation={{ ...privateInvitation, rsvp: current }}
        initialLocale="en-US"
        accessToken={'A'.repeat(43)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update response' }));
    fireEvent.click(screen.getByLabelText("No, we can't attend"));
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));
    expect(await screen.findByText('Your RSVP has been saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/rsvp',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(
      JSON.parse(
        String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body),
      ),
    ).toMatchObject({ status: 'DECLINED' });

    unmount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <PublicInvitation
        invitation={{ ...privateInvitation, rsvp: current }}
        initialLocale="en-US"
        accessToken={'A'.repeat(43)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel attendance' }));
    expect(await screen.findByText('Your RSVP has been saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/rsvp',
      expect.objectContaining({ method: 'DELETE' }),
    );
    fetchMock.mockRestore();
  });
});
