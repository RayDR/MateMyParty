import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '../app/internal/rsvp/route';

afterEach(() => vi.unstubAllGlobals());

const response = {
  status: 'ACCEPTED',
  totalAttending: 3,
  adultsAttending: 2,
  childrenAttending: 1,
  dietaryNotes: null,
  guestMessage: null,
  respondedAt: '2026-07-27T01:00:00.000Z',
  updatedAt: '2026-07-27T01:00:00.000Z',
};

describe('RSVP web boundary', () => {
  it('accepts the public event origin forwarded to the loopback listener', async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('http://127.0.0.1:3200/internal/rsvp', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3200',
        'x-forwarded-host': 'raymundo6th.domoforge.com',
        'x-forwarded-proto': 'https',
        origin: 'https://raymundo6th.domoforge.com',
        'x-mmp-csrf': '1',
        'x-invitation-token': 'A'.repeat(43),
      },
      body: '{}',
    });
    expect((await POST(request)).status).toBe(200);
  });

  it('forwards a permanent credential in a header and never in the URL', async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('https://raymundo6th.domoforge.com/internal/rsvp', {
      method: 'POST',
      headers: {
        origin: 'https://raymundo6th.domoforge.com',
        'content-type': 'application/json',
        'x-mmp-csrf': '1',
        'x-invitation-token': 'A'.repeat(43),
      },
      body: JSON.stringify({ status: 'ACCEPTED', adultsAttending: 2, childrenAttending: 1 }),
    });
    const result = await POST(request);
    expect(result.status).toBe(200);
    expect(upstream.mock.calls[0]?.[0]).toBe('http://localhost:3001/api/rsvp');
    expect(upstream.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-invitation-token': 'A'.repeat(43),
    });
    expect(String(upstream.mock.calls[0]?.[0])).not.toContain('A'.repeat(43));
  });

  it('uses the HttpOnly grant cookie for cancellation', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(Response.json({ ...response, status: 'CANCELLED', totalAttending: null }));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('https://raymundo6th.domoforge.com/internal/rsvp', {
      method: 'DELETE',
      headers: {
        origin: 'https://raymundo6th.domoforge.com',
        'x-mmp-csrf': '1',
        cookie: `mmp_invitation_access=${'B'.repeat(43)}`,
      },
      body: '{}',
    });
    expect((await DELETE(request)).status).toBe(200);
    expect(upstream.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-invitation-grant': 'B'.repeat(43),
    });
  });

  it('rejects cross-site, missing-CSRF, and oversized mutations before upstream access', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const baseHeaders = { 'x-invitation-token': 'A'.repeat(43), 'x-mmp-csrf': '1' };
    const crossSite = new NextRequest('https://raymundo6th.domoforge.com/internal/rsvp', {
      method: 'POST',
      headers: { ...baseHeaders, origin: 'https://attacker.example' },
      body: '{}',
    });
    expect((await POST(crossSite)).status).toBe(403);
    const missingCsrf = new NextRequest('https://raymundo6th.domoforge.com/internal/rsvp', {
      method: 'POST',
      headers: {
        'x-invitation-token': 'A'.repeat(43),
        origin: 'https://raymundo6th.domoforge.com',
      },
      body: '{}',
    });
    expect((await POST(missingCsrf)).status).toBe(403);
    const oversized = new NextRequest('https://raymundo6th.domoforge.com/internal/rsvp', {
      method: 'POST',
      headers: {
        ...baseHeaders,
        origin: 'https://raymundo6th.domoforge.com',
        'content-length': '9000',
      },
      body: '{}',
    });
    expect((await POST(oversized)).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
