import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../app/host/access/submit/route';

const originalToken = process.env.HOST_ADMIN_TOKEN;
const testToken = 'host-test-token-that-is-long-enough-2026';

afterEach(() => {
  process.env.HOST_ADMIN_TOKEN = originalToken;
});

describe('POST /host/access/submit', () => {
  it('creates an HttpOnly session and redirects to the server-side event selector', async () => {
    process.env.HOST_ADMIN_TOKEN = testToken;
    const request = new NextRequest('https://matemyparty.domoforge.com/host/access/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(testToken)}&returnTo=%2Fhost%2Fevents`,
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://matemyparty.domoforge.com/host/events');
    expect(response.headers.get('set-cookie')).toMatch(
      /matemyparty_host_session=.*HttpOnly.*SameSite=Strict/i,
    );
    expect(response.headers.get('location')).not.toContain(process.env.HOST_ADMIN_TOKEN);
  });

  it('returns the same access page for an invalid host token', async () => {
    process.env.HOST_ADMIN_TOKEN = testToken;
    const request = new NextRequest('https://matemyparty.domoforge.com/host/access/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'token=invalid&returnTo=%2Fhost%2Fevents',
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://matemyparty.domoforge.com/host/access?accessError=1',
    );
  });
});
