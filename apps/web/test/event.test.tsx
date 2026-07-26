import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BirthdayHomepage } from '../components/birthday-homepage';

afterEach(cleanup);

describe('public birthday homepage', () => {
  it.each([
    ['en-US' as const, 'Raymundo is turning 6'],
    ['es-MX' as const, 'Raymundo cumple 6 años'],
  ])('renders the redacted lookup experience in %s', (locale, heading) => {
    render(
      <BirthdayHomepage
        locale={locale}
        lookupFailed={false}
        event={{
          celebrantName: 'Raymundo',
          celebrantAge: 6,
          locale: 'en-US',
          publicSlug: 'raymundo-6',
          templateKey: 'kids-night-dragon',
          templateVersion: 1,
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(
      /August|agosto|1:00|America\/Chicago|Kids Empire|Hillcrest|DRAFT|RSVP/i,
    );
  });

  it('shows the same generic lookup failure without disclosing a guest result', () => {
    render(
      <BirthdayHomepage
        locale="en-US"
        lookupFailed
        event={{
          celebrantName: 'Raymundo',
          celebrantAge: 6,
          locale: 'en-US',
          publicSlug: 'raymundo-6',
          templateKey: 'kids-night-dragon',
          templateVersion: 1,
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We could not verify the invitation');
  });
});
