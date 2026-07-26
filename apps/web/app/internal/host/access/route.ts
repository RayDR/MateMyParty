import { NextResponse, type NextRequest } from 'next/server';
import { attachHostSession, validAdminToken } from '../../../../lib/host-session';

export function publicRequestUrl(request: NextRequest, pathname: string): URL {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = request.headers.get('host')?.trim();
  const configuredHost = process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
  const candidate = forwardedHost || requestHost || configuredHost;
  const host = /^[A-Za-z0-9.-]+(?::\d+)?$/.test(candidate) ? candidate : configuredHost;
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol =
    process.env.NODE_ENV === 'production'
      ? 'https'
      : forwardedProtocol === 'https'
        ? 'https'
        : 'http';
  return new URL(pathname, `${protocol}://${host}`);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  if (typeof token !== 'string' || !validAdminToken(token)) {
    return NextResponse.redirect(publicRequestUrl(request, '/host/access?accessError=1'), 303);
  }
  const response = NextResponse.redirect(publicRequestUrl(request, '/host/events'), 303);
  attachHostSession(response);
  return response;
}
