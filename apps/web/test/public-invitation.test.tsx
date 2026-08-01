import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidInvitation, PublicInvitation } from '../components/public-invitation';
import { privateInvitation } from './public-experience-fixture';

function mockAudioPlay(result: 'success' | 'failure' = 'success') {
  return vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() =>
      result === 'success' ? Promise.resolve() : Promise.reject(new Error('Autoplay blocked')),
    );
}

function openSummary(label = 'Open invitation') {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

function openFullInvitation(openLabel = 'Open invitation', detailsLabel = 'Event details') {
  openSummary(openLabel);
  fireEvent.click(screen.getByRole('button', { name: detailsLabel }));
}

afterEach(() => vi.restoreAllMocks());

describe('/i/[token] content', () => {
  it('keeps the closed 4:3 cover limited to celebrant, age, and the open action', () => {
    mockAudioPlay();
    const { container } = render(
      <PublicInvitation invitation={privateInvitation} initialLocale="en-US" />,
    );
    const front = container.querySelector('.invitation-closed-card');
    expect(front).toBeInTheDocument();
    expect(within(front as HTMLElement).getByRole('img')).toHaveAttribute(
      'src',
      privateInvitation.event.presentation.thumbnailRef,
    );
    expect(within(front as HTMLElement).getByRole('heading', { name: 'Raymundo' })).toBeVisible();
    expect(within(front as HTMLElement).getByText('Turning 6')).toBeVisible();
    const envelope = within(front as HTMLElement).getByRole('button', {
      name: 'Open invitation',
    });
    expect(envelope).toBeVisible();
    expect(envelope).toHaveAttribute('type', 'button');
    expect(envelope).toHaveAttribute('title', 'Open invitation');
    expect(envelope).toHaveClass('invitation-envelope-button');
    expect(front?.querySelector('.invitation-envelope-closed')).toBeInTheDocument();
    expect(front?.querySelector('.invitation-envelope-open')).toBeInTheDocument();
    expect(front?.querySelector('.absolute.inset-0')).toHaveClass('justify-center');
    expect(front?.querySelector('.absolute.inset-0')).not.toHaveClass('justify-end');
    expect(within(front as HTMLElement).getByText('Open invitation')).toBeVisible();
    expect(screen.queryByText('Family Sample')).not.toBeInTheDocument();
    expect(screen.queryByText(/1:00 PM/)).not.toBeInTheDocument();
    expect(screen.queryByText(/123 Celebration Lane/)).not.toBeInTheDocument();
    expect(screen.queryByText('We cannot wait to celebrate with you.')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo', { name: 'RSVP' })).not.toBeInTheDocument();
  });

  it('records an opening only after the explicit open action', () => {
    mockAudioPlay();
    const token = 'A'.repeat(43);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ opened: true }));

    render(
      <PublicInvitation invitation={privateInvitation} initialLocale="en-US" accessToken={token} />,
    );

    expect(fetchMock).not.toHaveBeenCalled();

    openSummary();

    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/invitation/open',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: expect.objectContaining({
          'x-mmp-csrf': '1',
          'x-invitation-token': token,
        }),
      }),
    );
  });

  it('does not record an opening from the host preview', () => {
    mockAudioPlay();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ opened: true }));

    render(
      <PublicInvitation
        invitation={privateInvitation}
        initialLocale="en-US"
        preview
        accessToken={'A'.repeat(43)}
      />,
    );

    openSummary();

    expect(fetchMock).not.toHaveBeenCalledWith('/internal/invitation/open', expect.anything());
  });

  it('unlocks audio with the first gesture and reveals only the private summary', () => {
    const play = mockAudioPlay();
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    openSummary();
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByText("You're invited")).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Family Sample' })).toBeVisible();
    expect(screen.getByText('We cannot wait to celebrate with you.')).toBeInTheDocument();
    expect(screen.queryByText('Please arrive ten minutes early.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Raymundo’s 6th Birthday' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('When')).not.toBeInTheDocument();
    expect(screen.queryByText(/1:00 PM/)).not.toBeInTheDocument();
    expect(screen.queryByText(/123 Celebration Lane/)).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo', { name: 'RSVP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Event details' })).toBeVisible();
  });

  it('reveals compact essential details on the second action without restarting music', () => {
    const play = mockAudioPlay();
    const { container } = render(
      <PublicInvitation invitation={privateInvitation} initialLocale="en-US" />,
    );
    openFullInvitation();
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Raymundo’s 6th Birthday' })).toBeVisible();
    expect(screen.getByText('When')).toBeVisible();
    expect(screen.getByText('Where')).toBeVisible();
    expect(screen.getByText('Invited party')).toBeVisible();
    expect(screen.getByText('Family Sample')).toBeVisible();
    expect(screen.getByText('2 adults · 2 children')).toBeVisible();
    expect(screen.getByText(/1:00 PM/)).toBeVisible();
    expect(screen.getByTitle('Address')).toHaveAttribute(
      'src',
      expect.stringContaining('123%20Celebration%20Lane'),
    );
    expect(screen.getByRole('timer')).toHaveAttribute('data-countdown-presentation', 'watermark');
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://maps.example.test/celebration',
    );
    expect(screen.getByTitle('Address')).toHaveAttribute(
      'src',
      expect.stringContaining('google.com/maps'),
    );

    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://maps.example.test/celebration',
    );

    expect(screen.getByRole('link', { name: 'Apple Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('maps.apple.com'),
    );
    expect(screen.getByRole('link', { name: 'Apple Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('maps.apple.com'),
    );
    expect(screen.getByText('Arrival information').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Parking information').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Message from the host').closest('details')).toHaveAttribute('open');
    expect(container.querySelector('.invitation-essential')?.closest('details')).toBeNull();
    expect(screen.getByRole('contentinfo', { name: 'RSVP' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause video + Pause theme audio' })).toHaveAttribute(
      'title',
      'Pause video + Pause theme audio',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preparing the celebration…' }));

    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('title', 'Pause');
    expect(screen.getByRole('button', { name: 'Replay' })).toHaveAttribute('title', 'Replay');
    expect(screen.getByRole('button', { name: 'Unmute video' })).toHaveAttribute(
      'title',
      'Unmute video',
    );
    expect(screen.getByRole('button', { name: 'Play theme audio' })).toHaveAttribute(
      'title',
      'Play theme audio',
    );
    expect(screen.getByRole('button', { name: 'Mute theme audio' })).toHaveAttribute(
      'title',
      'Mute theme audio',
    );
    expect(document.body.textContent).not.toContain('@');
  });

  it('opens even when autoplay is rejected', () => {
    const play = mockAudioPlay('failure');
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    openSummary();
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Family Sample' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Raymundo’s 6th Birthday' }),
    ).not.toBeInTheDocument();
  });

  it('removes complex opening decoration when reduced motion is requested', () => {
    mockAudioPlay();
    const { container } = render(
      <PublicInvitation invitation={privateInvitation} initialLocale="en-US" reducedMotion />,
    );
    openSummary();
    expect(container.querySelector('[data-reduced-motion="true"]')).toBeInTheDocument();
    expect(container.querySelector('.celebration-flight')).not.toBeInTheDocument();
    expect(container.querySelector('.invitation-envelope-opened')).not.toBeInTheDocument();
    expect(container.querySelector('[data-invitation-phase="summary"]')).toBeInTheDocument();
  });

  it('uses one compact calendar control and keeps existing providers', () => {
    mockAudioPlay();
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    openFullInvitation();
    expect(screen.getByLabelText('Add to calendar')).toHaveAttribute('title', 'Add to calendar');
    expect(screen.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    );
    expect(screen.getByRole('link', { name: 'Outlook Calendar' })).toHaveAttribute(
      'href',
      expect.stringContaining('outlook.live.com'),
    );
    expect(screen.getByRole('button', { name: 'Apple Calendar (.ics)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download calendar file' })).toBeEnabled();
  });

  it('switches the complete private experience to es-MX without mixed localized content', () => {
    mockAudioPlay();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Calendar refresh unavailable'));
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es-MX' } });
    expect(screen.getByText('Cumple 6')).toBeVisible();
    openSummary('Abrir invitación');
    expect(screen.getByText('Estás invitado')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Family Sample' })).toBeVisible();
    expect(screen.getByText('Nos encantará celebrar contigo.')).toBeInTheDocument();
    expect(screen.queryByText('We cannot wait to celebrate with you.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalles del evento' }));
    expect(screen.getByRole('heading', { name: 'Sexto cumpleaños de Raymundo' })).toBeVisible();
    expect(screen.getByText('Cuándo')).toBeVisible();
    expect(screen.getByText('Dónde')).toBeVisible();
    expect(screen.getByText('Grupo invitado')).toBeVisible();
    expect(screen.getByText('Nos encantará celebrar contigo.')).toBeInTheDocument();
  });

  it('renders a neutral invalid invitation state', () => {
    render(<InvalidInvitation />);
    expect(
      screen.getByRole('heading', { name: 'This invitation is unavailable' }),
    ).toBeInTheDocument();
  });

  it('submits a bounded RSVP from the persistent footer through the same-origin route', async () => {
    mockAudioPlay();
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
    openFullInvitation();
    fireEvent.click(screen.getByRole('button', { name: "Yes, we'll be there" }));
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
  });

  it('keeps preview RSVP actions disabled and never performs a mutation', () => {
    mockAudioPlay();
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" preview />);
    openFullInvitation();
    expect(screen.getByRole('button', { name: "Yes, we'll be there" })).toBeDisabled();
    expect(screen.getByRole('button', { name: "No, we can't attend" })).toBeDisabled();
    expect(screen.getByRole('button', { name: "We're not sure yet" })).toBeDisabled();
    expect(screen.getByText(/RSVP controls are disabled/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates an existing response and retains cancellation', async () => {
    mockAudioPlay();
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
    openFullInvitation();
    fireEvent.click(screen.getByRole('button', { name: "No, we can't attend" }));
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));
    expect(await screen.findByText('Your RSVP has been saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/rsvp',
      expect.objectContaining({ method: 'PATCH' }),
    );

    unmount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <PublicInvitation
        invitation={{ ...privateInvitation, rsvp: current }}
        initialLocale="en-US"
        accessToken={'A'.repeat(43)}
      />,
    );
    openFullInvitation();
    fireEvent.click(screen.getByRole('button', { name: 'Update response' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel attendance' }));
    expect(await screen.findByText('Your RSVP has been saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/internal/rsvp',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
