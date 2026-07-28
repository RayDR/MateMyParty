import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const HOST_SESSION_COOKIE = 'matemyparty_host_session';

export type HostAccessScope = { kind: 'admin' } | { kind: 'event'; eventIdentifier: string };

function secureEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminToken(): string {
  return process.env.HOST_ADMIN_TOKEN ?? '';
}

function legacyAdminSessionValue(): string {
  const token = adminToken();
  return token
    ? createHmac('sha256', token).update('matemyparty-host-session-v1').digest('base64url')
    : '';
}

function sessionSignature(payload: string): string {
  const token = adminToken();
  return token ? createHmac('sha256', token).update(payload).digest('base64url') : '';
}

function encodeSession(scope: HostAccessScope): string {
  const payload = Buffer.from(JSON.stringify(scope)).toString('base64url');
  const signature = sessionSignature(payload);
  return signature ? `${payload}.${signature}` : '';
}

function configuredEventTokens(): Array<{ eventIdentifier: string; token: string }> {
  return (process.env.HOST_EVENT_ACCESS_TOKENS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separator = entry.indexOf('=');
      if (separator <= 0) return [];
      const eventIdentifier = entry.slice(0, separator).trim();
      const token = entry.slice(separator + 1).trim();
      return eventIdentifier && token ? [{ eventIdentifier, token }] : [];
    });
}

export function resolveHostAccessToken(candidate: string): HostAccessScope | null {
  if (validAdminToken(candidate)) return { kind: 'admin' };

  for (const configured of configuredEventTokens()) {
    if (secureEqual(candidate, configured.token)) {
      return { kind: 'event', eventIdentifier: configured.eventIdentifier };
    }
  }
  return null;
}

export function validAdminToken(candidate: string): boolean {
  const expected = adminToken();
  return Boolean(expected && candidate && secureEqual(candidate, expected));
}

export function parseSessionValue(candidate: string): HostAccessScope | null {
  if (!candidate) return null;

  const legacy = legacyAdminSessionValue();
  if (legacy && secureEqual(candidate, legacy)) return { kind: 'admin' };

  const separator = candidate.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = candidate.slice(0, separator);
  const signature = candidate.slice(separator + 1);
  const expected = sessionSignature(payload);
  if (!expected || !secureEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      kind?: unknown;
      eventIdentifier?: unknown;
    };
    if (parsed.kind === 'admin') return { kind: 'admin' };
    if (
      parsed.kind === 'event' &&
      typeof parsed.eventIdentifier === 'string' &&
      parsed.eventIdentifier.trim()
    ) {
      return { kind: 'event', eventIdentifier: parsed.eventIdentifier };
    }
  } catch {
    return null;
  }
  return null;
}

export function hostSessionScope(request: NextRequest): HostAccessScope | null {
  return parseSessionValue(request.cookies.get(HOST_SESSION_COOKIE)?.value ?? '');
}

export function validHostSession(request: NextRequest): boolean {
  return Boolean(hostSessionScope(request));
}

export function validSessionValue(candidate: string): boolean {
  return Boolean(parseSessionValue(candidate));
}

export function attachHostSession(
  response: NextResponse,
  scope: HostAccessScope = { kind: 'admin' },
): void {
  response.cookies.set(HOST_SESSION_COOKIE, encodeSession(scope), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}
