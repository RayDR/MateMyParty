import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const HOST_SESSION_COOKIE = 'matemyparty_host_session';

function secureEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminToken(): string {
  return process.env.HOST_ADMIN_TOKEN ?? '';
}

function sessionValue(): string {
  const token = adminToken();
  return token
    ? createHmac('sha256', token).update('matemyparty-host-session-v1').digest('base64url')
    : '';
}

export function validAdminToken(candidate: string): boolean {
  const expected = adminToken();
  return Boolean(expected && candidate && secureEqual(candidate, expected));
}

export function validHostSession(request: NextRequest): boolean {
  const candidate = request.cookies.get(HOST_SESSION_COOKIE)?.value ?? '';
  return validSessionValue(candidate);
}

export function validSessionValue(candidate: string): boolean {
  const expected = sessionValue();
  return Boolean(expected && candidate && secureEqual(candidate, expected));
}

export function attachHostSession(response: NextResponse): void {
  response.cookies.set(HOST_SESSION_COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}
