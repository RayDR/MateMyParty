import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostEventEditor } from '../components/host-event-editor';
import { hostEventDetail } from './host-event-fixture';

afterEach(() => vi.restoreAllMocks());

describe('host event editor', () => {
  it('renders the mobile-first editor sections and tracks unsaved changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => hostEventDetail }),
    );
    const user = userEvent.setup();
    render(<HostEventEditor identifier="raymundo-6" />);
    const title = await screen.findByLabelText('Event title');
    expect(screen.getByRole('heading', { name: 'Basic information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Date and location' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Branding and thumbnail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Template configuration' })).toBeInTheDocument();
    await user.type(title, '!');
    expect(screen.getAllByText('You have unsaved changes.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
