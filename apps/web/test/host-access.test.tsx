import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HostAccessPage from '../app/host/access/page';
import { POST } from '../app/internal/host/access/route';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('temporary host access', () => {
  it('renders the access form for GET /host/access', async () => {
    render(await HostAccessPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { name: 'Temporary host access' })).toBeInTheDocument();
    expect(screen.getByLabelText('Host access token')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('creates a secure session and redirects to the public HTTPS dashboard', async () => {
    const token = 'host-test-token-that-is-long-enough-for-production';
    vi.stubEnv('HOST_ADMIN_TOKEN', token);
    vi.stubEnv('NODE_ENV', 'production');
    const request = new NextRequest('http://localhost:3200/host/access', {
      method: 'POST',
      headers: {
        host: 'localhost:3200',
        'x-forwarded-host': 'matemyparty.domoforge.com',
        'x-forwarded-proto': 'https',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
    });
    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://matemyparty.domoforge.com/host/events');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=strict');
    expect(cookie).not.toContain(token);
    expect(response.headers.get('location')).not.toContain('localhost');
  });
});
