import { NextResponse, type NextRequest } from 'next/server';
import { hostSessionScope, type HostAccessScope } from './host-session';
import { publicRequestOrigin } from './public-origin';
import { internalApiBaseUrl } from './server-api';

function eventIdentifierFromPath(path: string): string | null {
  const prefix = '/api/host/events/';
  if (!path.startsWith(prefix)) return null;
  const segment = path.slice(prefix.length).split('/')[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function scopeAllowsPath(scope: HostAccessScope, path: string): boolean {
  if (scope.kind === 'admin') return true;
  if (path === '/api/host/events') return true;
  return eventIdentifierFromPath(path) === scope.eventIdentifier;
}

function filterScopedEvents(responseBody: string, eventIdentifier: string): string {
  try {
    const events = JSON.parse(responseBody) as Array<{
      identifier?: unknown;
      publicSlug?: unknown;
    }>;
    if (!Array.isArray(events)) return '[]';
    return JSON.stringify(
      events.filter(
        (event) => event.identifier === eventIdentifier || event.publicSlug === eventIdentifier,
      ),
    );
  } catch {
    return '[]';
  }
}

export async function forwardHostRequest(
  request: NextRequest,
  path: string,
  method = request.method,
) {
  const scope = hostSessionScope(request);
  if (!scope) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Host access denied', status: 401 },
      { status: 401 },
    );
  }
  if (!scopeAllowsPath(scope, path)) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Event access denied', status: 403 },
      { status: 403 },
    );
  }
  const token = process.env.HOST_ADMIN_TOKEN;
  if (!token)
    return NextResponse.json(
      { code: 'HOST_ACCESS_UNAVAILABLE', message: 'Host access unavailable', status: 503 },
      { status: 503 },
    );
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const upstream = await fetch(`${internalApiBaseUrl}${path}`, {
    method,
    body,
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(request.headers.get('x-mmp-csrf') === '1' ? { 'x-mmp-csrf': '1' } : {}),
    },
  });
  let responseBody = await upstream.text();
  if (upstream.ok && scope.kind === 'event' && path === '/api/host/events' && method === 'GET') {
    responseBody = filterScopedEvents(responseBody, scope.eventIdentifier);
  }
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store, private',
    },
  });
}

export function rejectInvalidHostMutation(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    if (
      origin &&
      new URL(origin).origin === publicRequestOrigin(request) &&
      request.headers.get('x-mmp-csrf') === '1'
    ) {
      return null;
    }
  } catch {
    // Return the same neutral rejection for malformed and cross-origin values.
  }
  return NextResponse.json(
    { code: 'CSRF_REJECTED', message: 'Request validation failed', status: 403 },
    { status: 403 },
  );
}
