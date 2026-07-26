import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvalidInvitation, PublicInvitation } from '../components/public-invitation';

const invitation = {
  event: {
    title: 'Raymundo’s 6th Birthday',
    celebrantName: 'Raymundo',
    celebrantAge: 6,
    eventType: 'KIDS_BIRTHDAY' as const,
    status: 'DRAFT' as const,
    startsAt: '2026-08-06T18:00:00.000Z',
    endsAt: null,
    timezone: 'America/Chicago',
    locale: 'en-US' as const,
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
  },
  guestDisplayName: 'Family Sample',
  status: 'OPENED' as const,
  locale: 'en-US' as const,
  openedPreviously: false,
  capabilities: { canRespond: false as const, canAddToCalendar: false as const },
};

describe('/i/[token] content', () => {
  it('renders a personalized public invitation without private contacts', () => {
    render(<PublicInvitation invitation={invitation} />);
    expect(screen.getByText('This invitation was prepared for Family Sample.')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('@');
  });

  it('renders a neutral invalid invitation state', () => {
    render(<InvalidInvitation />);
    expect(
      screen.getByRole('heading', { name: 'This invitation is unavailable' }),
    ).toBeInTheDocument();
  });
});
