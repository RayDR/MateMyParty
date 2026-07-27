import { NextResponse, type NextRequest } from 'next/server';
import { validHostSession } from './host-session';
import { internalApiBaseUrl } from './server-api';

export async function forwardHostRequest(
  request: NextRequest,
  path: string,
  method = request.method,
) {
  if (!validHostSession(request)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Host access denied', status: 401 },
      { status: 401 },
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
  const responseBody = await upstream.text();
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
      new URL(origin).origin === request.nextUrl.origin &&
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
