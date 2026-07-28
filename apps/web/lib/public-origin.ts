import { normalizeHostname } from '@matemyparty/contracts';
import type { NextRequest } from 'next/server';

const DEFAULT_PLATFORM_HOSTNAME = 'matemyparty.domoforge.com';
const DEFAULT_EVENT_HOSTNAME = 'raymundo6th.domoforge.com';

function configuredAllowedHostnames(): Set<string> {
  const configured = process.env.PUBLIC_APP_HOSTNAMES?.split(',') ?? [];
  return new Set(
    [DEFAULT_PLATFORM_HOSTNAME, DEFAULT_EVENT_HOSTNAME, ...configured]
      .map(normalizeHostname)
      .filter(Boolean),
  );
}

function configuredPlatformHostname(): string {
  const candidate = normalizeHostname(process.env.PRIMARY_APP_HOSTNAME ?? '');
  if (configuredAllowedHostnames().has(candidate)) return candidate;
  return DEFAULT_PLATFORM_HOSTNAME;
}

function firstHeaderValue(value: string | null): string {
  return value?.split(',')[0]?.trim() ?? '';
}

function validHostAndPort(value: string): boolean {
  return /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(value);
}

function safePath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Public URLs require a root-relative path');
  }
  return path;
}

export function platformPublicOrigin(): string {
  if (process.env.NODE_ENV === 'production') {
    return `https://${configuredPlatformHostname()}`;
  }
  const host = process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
  const protocol = process.env.PUBLIC_APP_PROTOCOL === 'https' ? 'https' : 'http';
  return `${protocol}://${validHostAndPort(host) ? host : 'localhost:3000'}`;
}

export function platformPublicUrl(path: string): URL {
  return new URL(safePath(path), platformPublicOrigin());
}

export function publicRequestOrigin(request: NextRequest): string {
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const requestHost = firstHeaderValue(request.headers.get('host'));
  const candidate = forwardedHost || requestHost || request.nextUrl.host;

  if (process.env.NODE_ENV === 'production') {
    const hostname = normalizeHostname(candidate);
    if (!configuredAllowedHostnames().has(hostname)) return platformPublicOrigin();
    return `https://${hostname}`;
  }

  const fallback = process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
  const host = validHostAndPort(candidate) ? candidate : fallback;
  const forwardedProtocol = firstHeaderValue(request.headers.get('x-forwarded-proto'));
  const protocol =
    forwardedProtocol === 'https' || (!forwardedProtocol && request.nextUrl.protocol === 'https:')
      ? 'https'
      : 'http';
  return `${protocol}://${validHostAndPort(host) ? host : 'localhost:3000'}`;
}

export function publicRequestUrl(request: NextRequest, path: string): URL {
  return new URL(safePath(path), publicRequestOrigin(request));
}

export function isAllowedProductionHostname(value: string): boolean {
  return configuredAllowedHostnames().has(normalizeHostname(value));
}
