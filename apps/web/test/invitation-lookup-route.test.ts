import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/internal/invitations/lookup/route';

afterEach(() => vi.unstubAllGlobals());

describe('invitation lookup web boundary', () => {
  it('forwards the trusted proxy address instead of a spoofed first X-Forwarded-For value', async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        verified: true,
        grantToken: 'A'.repeat(43),
        expiresAt: '2026-07-26T00:12:00.000Z',
      }),
    );
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest(
      'https://raymundo6th.domoforge.com/internal/invitations/lookup',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.77, 192.0.2.44',
          'x-real-ip': '192.0.2.44',
        },
        body: JSON.stringify({
          eventIdentifier: 'raymundo-6',
          displayName: 'Family Sample',
          method: 'EMAIL',
          contact: 'guest@example.test',
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(upstream.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-forwarded-for': '192.0.2.44',
    });
    expect(await response.json()).toEqual({ verified: true, redirectTo: '/invitation' });
    expect(response.headers.get('set-cookie')).toContain('mmp_invitation_access=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
});
