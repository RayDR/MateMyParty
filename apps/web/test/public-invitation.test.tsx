import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvalidInvitation, PublicInvitation } from '../components/public-invitation';
import { privateInvitation } from './public-experience-fixture';

describe('/i/[token] content', () => {
  it('renders a complete personalized invitation without private contacts', () => {
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    expect(screen.getByText('This invitation was prepared for Family Sample.')).toBeInTheDocument();
    expect(screen.getByText(/1:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/123 Celebration Lane/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('@');
  });

  it('switches the complete private experience to es-MX', () => {
    render(<PublicInvitation invitation={privateInvitation} initialLocale="en-US" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es-MX' } });
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
});
