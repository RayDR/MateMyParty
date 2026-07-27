import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../proxy';

describe('hostname proxy', () => {
  it('rewrites a public HTTPS hostname through the local HTTP server', () => {
    const request = new NextRequest('https://localhost:3200/', {
      headers: { host: 'raymundo6th.domoforge.com' },
    });

    const response = proxy(request);

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3200/site-hosts/raymundo6th.domoforge.com',
    );
  });

  it('keeps host dashboard routes out of custom event hostname rewrites', () => {
    const request = new NextRequest('https://localhost:3200/host/events', {
      headers: { host: 'raymundo6th.domoforge.com' },
    });
    expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps verified invitation sessions out of custom event hostname rewrites', () => {
    const request = new NextRequest('https://localhost:3200/invitation', {
      headers: { host: 'raymundo6th.domoforge.com' },
    });
    expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
  });

  it('rewrites POST /host/access to the server-only handler', () => {
    const request = new NextRequest('https://localhost:3200/host/access', {
      method: 'POST',
      headers: { host: 'matemyparty.domoforge.com' },
    });
    expect(proxy(request).headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3200/internal/host/access',
    );
  });
});
