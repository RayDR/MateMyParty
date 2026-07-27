import { NextResponse, type NextRequest } from 'next/server';
import { isLocale } from '@matemyparty/i18n';
import { LANGUAGE_COOKIE, languageCookieOptions } from '../../../lib/invitation-access';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { locale?: string } | null;
  if (!body?.locale || !isLocale(body.locale)) {
    return NextResponse.json({ updated: false }, { status: 400 });
  }
  const response = NextResponse.json({ updated: true });
  response.cookies.set(LANGUAGE_COOKIE, body.locale, languageCookieOptions);
  return response;
}
