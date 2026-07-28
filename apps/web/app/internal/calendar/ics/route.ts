import { NextResponse, type NextRequest } from 'next/server';
import { INVITATION_ACCESS_COOKIE } from '../../../../lib/invitation-access';
import { internalApiBaseUrl } from '../../../../lib/server-api';

export async function GET(request: NextRequest) {
  const permanentToken = request.headers.get('x-invitation-token');
  const grantToken = request.cookies.get(INVITATION_ACCESS_COOKIE)?.value;
  if (!permanentToken && !grantToken) return neutral();
  const locale = request.nextUrl.searchParams.get('locale');
  const query = locale === 'en-US' || locale === 'es-MX' ? `?locale=${locale}` : '';
  const upstream = await fetch(`${internalApiBaseUrl}/api/calendar/ics${query}`, {
    cache: 'no-store',
    headers: {
      ...(permanentToken ? { 'x-invitation-token': permanentToken } : {}),
      ...(grantToken ? { 'x-invitation-grant': grantToken } : {}),
    },
  });
  if (!upstream.ok) return neutral();
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'text/calendar; charset=utf-8',
      'content-disposition':
        upstream.headers.get('content-disposition') ??
        'attachment; filename="matemyparty-event.ics"',
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}

function neutral() {
  return NextResponse.json(
    { code: 'INVITATION_NOT_FOUND', message: 'Calendar unavailable', status: 404 },
    { status: 404, headers: { 'cache-control': 'no-store, private' } },
  );
}
