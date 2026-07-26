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
});
