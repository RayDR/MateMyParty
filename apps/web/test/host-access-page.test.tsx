import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HostAccessPage from '../app/host/access/page';

vi.mock('../lib/locale', () => ({ resolveRequestLocale: async () => 'en-US' }));

describe('GET /host/access regression', () => {
  it('renders the temporary host access form as a page', async () => {
    render(await HostAccessPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { name: 'Temporary host access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Temporary host access' })).toHaveAttribute(
      'action',
      '/host/access/submit',
    );
  });
});
