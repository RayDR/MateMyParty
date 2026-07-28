import { NextResponse, type NextRequest } from 'next/server';
import { attachHostSession, resolveHostAccessToken } from '../../../../lib/host-session';
import { platformPublicUrl } from '../../../../lib/public-origin';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  const scope = typeof token === 'string' ? resolveHostAccessToken(token) : null;
  if (!scope) {
    return NextResponse.redirect(platformPublicUrl('/host/access?accessError=1'), 303);
  }
  const destination =
    scope.kind === 'event'
      ? `/host/events/${encodeURIComponent(scope.eventIdentifier)}`
      : '/host/events';
  const response = NextResponse.redirect(platformPublicUrl(destination), 303);
  attachHostSession(response, scope);
  return response;
}
