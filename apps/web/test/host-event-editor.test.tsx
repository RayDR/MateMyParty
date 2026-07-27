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

  it('retains independent English and Spanish invitation content', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Response.json(hostEventDetail);
      return Response.json(hostEventDetail);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<HostEventEditor identifier="raymundo-6" />);
    await screen.findByLabelText('Event title');
    await user.click(screen.getByRole('button', { name: /^ES/ }));
    const spanishTitle = screen.getByLabelText('Event title');
    await user.clear(spanishTitle);
    await user.type(spanishTitle, 'Fiesta de Raymundo');
    await user.click(screen.getByRole('button', { name: /^EN/ }));
    expect(screen.getByLabelText('Event title')).toHaveValue('Raymundo’s 6th Birthday');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const request = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(request?.[1]?.body)).localizedContent).toMatchObject({
      'en-US': { title: 'Raymundo’s 6th Birthday' },
      'es-MX': { title: 'Fiesta de Raymundo' },
    });
  });
});
