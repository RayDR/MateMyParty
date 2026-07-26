import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventInvitation } from '../components/event-invitation';

describe('event page content', () => {
  it('renders localized seeded event details', () => {
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
    expect(screen.getByRole('heading', { name: 'Raymundo’s 6th Birthday' })).toBeInTheDocument();
    expect(screen.getByText('Kids Empire Dallas Hillcrest')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
  });
});
