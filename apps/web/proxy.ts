import { NextResponse, type NextRequest } from 'next/server';
import { normalizeHostname } from '@matemyparty/contracts';
import { isAllowedProductionHostname, platformPublicUrl } from './lib/public-origin';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/host/access' && request.method === 'POST') {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = '/internal/host/access';
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname.startsWith('/i/')) return NextResponse.next();
  if (request.nextUrl.pathname === '/invitation') return NextResponse.next();
  if (
    request.nextUrl.pathname.startsWith('/host/') ||
    request.nextUrl.pathname.startsWith('/internal/')
  )
    return NextResponse.next();
  const hostname = normalizeHostname(request.headers.get('host') ?? '');
  const primary = normalizeHostname(
    process.env.PRIMARY_APP_HOSTNAME ?? 'matemyparty.domoforge.com',
  );
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!hostname || local || hostname === primary) return NextResponse.next();
  if (process.env.NODE_ENV === 'production' && !isAllowedProductionHostname(hostname)) {
    return NextResponse.redirect(platformPublicUrl(request.nextUrl.pathname));
  }
  const url = request.nextUrl.clone();
  // The public request may be HTTPS, but this rewrite is handled by the local HTTP Next server.
  url.protocol = 'http:';
  url.pathname = `/site-hosts/${encodeURIComponent(hostname)}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
