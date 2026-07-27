import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { platformPublicUrl, publicRequestOrigin, publicRequestUrl } from '../lib/public-origin';

afterEach(() => vi.unstubAllEnvs());

describe('public origin policy', () => {
  it('uses trusted forwarded event headers without leaking the internal listener', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new NextRequest('http://127.0.0.1:3200/internal/rsvp', {
      headers: {
        host: '127.0.0.1:3200',
        'x-forwarded-host': 'raymundo6th.domoforge.com',
        'x-forwarded-proto': 'https',
      },
    });
    expect(publicRequestOrigin(request)).toBe('https://raymundo6th.domoforge.com');
    expect(publicRequestUrl(request, '/invitation').toString()).toBe(
      'https://raymundo6th.domoforge.com/invitation',
    );
  });

  it('falls back to the platform for localhost and arbitrary production hosts', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const host of ['localhost:3200', '127.0.0.1:3200', 'attacker.example']) {
      const request = new NextRequest('http://127.0.0.1:3200/host/access', {
        headers: { host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https' },
      });
      expect(publicRequestOrigin(request)).toBe('https://matemyparty.domoforge.com');
    }
    expect(platformPublicUrl('/host/events').toString()).toBe(
      'https://matemyparty.domoforge.com/host/events',
    );
  });

  it('rejects protocol-relative redirect targets', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => platformPublicUrl('//attacker.example/path')).toThrow();
  });
});
