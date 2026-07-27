import { NextResponse, type NextRequest } from 'next/server';
import { invitationLookupResultSchema } from '@matemyparty/contracts';
import {
  INVITATION_ACCESS_COOKIE,
  invitationCookieOptions,
} from '../../../../lib/invitation-access';
import { internalApiBaseUrl } from '../../../../lib/server-api';

export async function POST(request: NextRequest) {
  const forwardedAddresses = request.headers.get('x-forwarded-for')?.split(',') ?? [];
  const requestAddress =
    request.headers.get('x-real-ip')?.trim() || forwardedAddresses.at(-1)?.trim() || 'unknown';
  const upstream = await fetch(`${internalApiBaseUrl}/api/invitations/lookup`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': requestAddress,
    },
    body: await request.text(),
  });
  if (upstream.status === 429) {
    return NextResponse.json({ verified: false }, { status: 429 });
  }
  if (!upstream.ok) return NextResponse.json({ verified: false });
  const result = invitationLookupResultSchema.safeParse(await upstream.json());
  if (!result.success || !result.data.verified) return NextResponse.json({ verified: false });
  const response = NextResponse.json({ verified: true, redirectTo: '/invitation' });
  response.cookies.set(INVITATION_ACCESS_COOKIE, result.data.grantToken, invitationCookieOptions);
  response.headers.set('cache-control', 'no-store');
  return response;
}
