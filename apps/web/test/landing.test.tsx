import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PlatformLanding } from '../components/platform-landing';

describe('platform landing', () => {
  afterEach(() => {
    document.cookie = 'mmp_locale=; Max-Age=0; Path=/';
  });
  it('renders and switches its language', async () => {
    render(<PlatformLanding />);
    expect(screen.getByRole('heading', { name: 'MateMyParty' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'es-MX');
    expect(screen.getByText(/Estamos construyendo/)).toBeInTheDocument();
  });

  it('restores a manually selected language after a reload', async () => {
    document.cookie = 'mmp_locale=es-MX; Path=/';
    render(<PlatformLanding />);
    expect(await screen.findByText(/Estamos construyendo/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('es-MX');
  });
});
