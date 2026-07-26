import { NextResponse, type NextRequest } from 'next/server';
import { normalizeHostname } from '@matemyparty/contracts';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/i/')) return NextResponse.next();
  const hostname = normalizeHostname(request.headers.get('host') ?? '');
  const primary = normalizeHostname(
    process.env.PRIMARY_APP_HOSTNAME ?? 'matemyparty.domoforge.com',
  );
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!hostname || local || hostname === primary) return NextResponse.next();
  const url = request.nextUrl.clone();
  // The public request may be HTTPS, but this rewrite is handled by the local HTTP Next server.
  url.protocol = 'http:';
  url.pathname = `/site-hosts/${encodeURIComponent(hostname)}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
