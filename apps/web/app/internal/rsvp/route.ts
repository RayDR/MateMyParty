import { NextResponse, type NextRequest } from 'next/server';
import { INVITATION_ACCESS_COOKIE } from '../../../lib/invitation-access';
import { internalApiBaseUrl } from '../../../lib/server-api';

const maximumBodyBytes = 8 * 1024;

export async function POST(request: NextRequest) {
  return mutate(request, 'POST');
}

export async function PATCH(request: NextRequest) {
  return mutate(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return mutate(request, 'DELETE');
}

async function mutate(request: NextRequest, method: 'POST' | 'PATCH' | 'DELETE') {
  if (!sameOrigin(request) || request.headers.get('x-mmp-csrf') !== '1') {
    return neutral(403, 'REQUEST_REJECTED');
  }
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maximumBodyBytes) {
    return neutral(413, 'REQUEST_TOO_LARGE');
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBodyBytes) {
    return neutral(413, 'REQUEST_TOO_LARGE');
  }
  const permanentToken = request.headers.get('x-invitation-token');
  const grantToken = request.cookies.get(INVITATION_ACCESS_COOKIE)?.value;
  if (!permanentToken && !grantToken) return neutral(404, 'INVITATION_NOT_FOUND');

  const upstream = await fetch(`${internalApiBaseUrl}/api/rsvp`, {
    method,
    body: body || '{}',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(permanentToken ? { 'x-invitation-token': permanentToken } : {}),
      ...(grantToken ? { 'x-invitation-grant': grantToken } : {}),
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

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function neutral(status: number, code: string) {
  return NextResponse.json(
    { code, message: 'The RSVP request could not be completed', status },
    { status, headers: { 'cache-control': 'no-store, private' } },
  );
}
