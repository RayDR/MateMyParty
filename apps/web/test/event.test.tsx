import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EventInvitation } from '../components/event-invitation';

describe('event page content', () => {
  it('renders localized seeded event details after visitor interaction', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const user = userEvent.setup();
    render(
      <EventInvitation
        locale="en-US"
        event={{
          title: 'Raymundo’s 6th Birthday',
          celebrantName: 'Raymundo',
          celebrantAge: 6,
          eventType: 'KIDS_BIRTHDAY',
          status: 'DRAFT',
          startsAt: '2026-08-06T18:00:00.000Z',
          endsAt: null,
          timezone: 'America/Chicago',
          locale: 'en-US',
          venueName: 'Kids Empire Dallas Hillcrest',
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
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Enter the Dragon World' }));
    expect(screen.getByRole('heading', { name: 'Raymundo’s 6th Birthday' })).toBeInTheDocument();
    expect(screen.getByText('Kids Empire Dallas Hillcrest')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
  });
});
