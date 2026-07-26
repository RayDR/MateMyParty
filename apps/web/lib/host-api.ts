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
    },
  });
  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
