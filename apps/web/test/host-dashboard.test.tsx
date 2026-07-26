import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostDashboard } from '../components/host-dashboard';
import { hostEventSummary } from './host-event-fixture';

afterEach(() => vi.restoreAllMocks());

describe('host events dashboard', () => {
  it('renders Raymundo’s event using public host routes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [hostEventSummary] }),
    );
    const { container } = render(<HostDashboard />);
    expect(
      await screen.findByRole('heading', { name: 'Raymundo’s 6th Birthday' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage event' })).toHaveAttribute(
      'href',
      '/host/events/raymundo-6',
    );
    expect(screen.getByRole('link', { name: 'Manage guests and invitations' })).toHaveAttribute(
      'href',
      '/host/events/raymundo-6/guests',
    );
    expect(container.innerHTML).not.toContain('22222222-2222-4222-8222-222222222222');
  });
});
