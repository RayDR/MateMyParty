import { NextResponse, type NextRequest } from 'next/server';
import { attachHostSession, validAdminToken } from '../../../../lib/host-session';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  const returnTo = form.get('returnTo');
  const safeReturnTo =
    typeof returnTo === 'string' &&
    (/^\/host\/events\/[0-9a-f-]{36}\/guests$/.test(returnTo) || returnTo === '/host/events')
      ? returnTo
      : '/host/events';
  if (typeof token !== 'string' || !validAdminToken(token)) {
    const failure = new URL('/host/access', request.url);
    failure.searchParams.set('accessError', '1');
    if (safeReturnTo !== '/host/events') failure.searchParams.set('returnTo', safeReturnTo);
    return NextResponse.redirect(failure, 303);
  }
  const response = NextResponse.redirect(new URL(safeReturnTo, request.url), 303);
  attachHostSession(response);
  return response;
}
