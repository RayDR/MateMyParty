import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventInvitation } from '../components/event-invitation';
import { publicLanding } from './public-experience-fixture';

describe('public event landing', () => {
  it('renders only safe promotional content before verification', () => {
    render(<EventInvitation initialLocale="en-US" event={publicLanding} />);
    expect(screen.getByRole('heading', { name: 'Raymundo is turning 6!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find your invitation' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Celebration Center');
    expect(document.body.textContent).not.toContain('August 6');
    expect(document.body.textContent).not.toContain('123 Celebration Lane');
  });
});
