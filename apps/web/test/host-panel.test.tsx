import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostGuestPanel } from '../components/host-guest-panel';

afterEach(() => vi.restoreAllMocks());

describe('temporary host panel', () => {
  it('loads and renders the guest list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: '55555555-5555-4555-8555-555555555555',
            displayName: 'Family Sample',
            contactName: null,
            email: null,
            phone: null,
            preferredChannel: 'MANUAL',
            locale: 'en-US',
            adultsPlanned: null,
            childrenPlanned: null,
            privateNotes: null,
            invitation: null,
            createdAt: '2026-07-26T00:00:00.000Z',
            updatedAt: '2026-07-26T00:00:00.000Z',
            archivedAt: null,
          },
        ],
      }),
    );
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);
    expect(await screen.findByRole('heading', { name: 'Family Sample' })).toBeInTheDocument();
  });
});
