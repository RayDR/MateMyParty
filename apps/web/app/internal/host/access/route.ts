import { NextResponse, type NextRequest } from 'next/server';
import { attachHostSession, validAdminToken } from '../../../../lib/host-session';
import { platformPublicUrl } from '../../../../lib/public-origin';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  if (typeof token !== 'string' || !validAdminToken(token)) {
    return NextResponse.redirect(platformPublicUrl('/host/access?accessError=1'), 303);
  }
  const response = NextResponse.redirect(platformPublicUrl('/host/events'), 303);
  attachHostSession(response);
  return response;
}
