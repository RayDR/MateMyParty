import { NextResponse, type NextRequest } from 'next/server';
import { INVITATION_ACCESS_COOKIE } from '../../../../lib/invitation-access';
import { publicRequestOrigin } from '../../../../lib/public-origin';
import { internalApiBaseUrl } from '../../../../lib/server-api';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || request.headers.get('x-mmp-csrf') !== '1') {
    return neutral(403, 'REQUEST_REJECTED');
  }

  const permanentToken = request.headers.get('x-invitation-token');
  const grantToken = request.cookies.get(INVITATION_ACCESS_COOKIE)?.value;

  if (!permanentToken && !grantToken) {
    return neutral(404, 'INVITATION_NOT_FOUND');
  }

  const upstream = await fetch(`${internalApiBaseUrl}/api/invitations/open`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      ...(permanentToken ? { 'x-invitation-token': permanentToken } : {}),
      ...(grantToken ? { 'x-invitation-grant': grantToken } : {}),
      ...(request.headers.get('user-agent')
        ? { 'user-agent': request.headers.get('user-agent')! }
        : {}),
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
    return new URL(origin).origin === publicRequestOrigin(request);
  } catch {
    return false;
  }
}

function neutral(status: number, code: string) {
  return NextResponse.json(
    {
      code,
      message: 'The invitation opening could not be recorded',
      status,
    },
    {
      status,
      headers: { 'cache-control': 'no-store, private' },
    },
  );
}
