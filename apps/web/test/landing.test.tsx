import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlatformLanding } from '../components/platform-landing';

describe('platform landing', () => {
  it('renders and switches its language', async () => {
    render(<PlatformLanding />);
    expect(screen.getByRole('heading', { name: 'MateMyParty' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'es-MX');
    expect(screen.getByText(/Estamos construyendo/)).toBeInTheDocument();
  });
});
