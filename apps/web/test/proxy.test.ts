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

  it('keeps the generic hostname isolated without an external redirect', () => {
    const request = new NextRequest('https://matemyparty.domoforge.com/host/access', {
      headers: { host: 'matemyparty.domoforge.com' },
    });

    const response = proxy(request);

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/lookup', '/a/opaque-grant', '/i/permanent-token'])(
    'does not rewrite private flow path %s',
    (path) => {
      const request = new NextRequest(`https://raymundo6th.domoforge.com${path}`, {
        headers: { host: 'raymundo6th.domoforge.com' },
      });
      expect(proxy(request).headers.get('x-middleware-rewrite')).toBeNull();
    },
  );
});
