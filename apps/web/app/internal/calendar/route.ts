import { NextResponse, type NextRequest } from 'next/server';
import { calendarEventSchema } from '@matemyparty/contracts';
import { INVITATION_ACCESS_COOKIE } from '../../../lib/invitation-access';
import { internalApiBaseUrl } from '../../../lib/server-api';

export async function GET(request: NextRequest) {
  const credentials = credentialHeaders(request);
  if (!credentials) return neutral();
  const locale = request.nextUrl.searchParams.get('locale');
  const query = locale === 'en-US' || locale === 'es-MX' ? `?locale=${locale}` : '';
  const upstream = await fetch(`${internalApiBaseUrl}/api/calendar${query}`, {
    cache: 'no-store',
    headers: credentials,
  });
  if (!upstream.ok) return neutral();
  const result = calendarEventSchema.safeParse(await upstream.json());
  if (!result.success) return neutral();
  return NextResponse.json(result.data, {
    headers: { 'cache-control': 'no-store, private' },
  });
}

function credentialHeaders(request: NextRequest): Record<string, string> | null {
  const permanentToken = request.headers.get('x-invitation-token');
  const grantToken = request.cookies.get(INVITATION_ACCESS_COOKIE)?.value;
  if (!permanentToken && !grantToken) return null;
  return {
    ...(permanentToken ? { 'x-invitation-token': permanentToken } : {}),
    ...(grantToken ? { 'x-invitation-grant': grantToken } : {}),
  };
}

function neutral() {
  return NextResponse.json(
    { code: 'INVITATION_NOT_FOUND', message: 'Calendar unavailable', status: 404 },
    { status: 404, headers: { 'cache-control': 'no-store, private' } },
  );
}
