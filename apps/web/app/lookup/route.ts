import { NextResponse, type NextRequest } from 'next/server';
import { invitationAccessGrantSchema } from '@matemyparty/contracts';
import { internalApiBaseUrl } from '../../lib/server-api';

function failureRedirect(request: NextRequest) {
  const target = new URL('/', request.url);
  target.searchParams.set('lookupError', '1');
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  const adminToken = process.env.HOST_ADMIN_TOKEN;
  if (!adminToken) return failureRedirect(request);
  const form = await request.formData();
  const displayName = form.get('displayName');
  const contact = form.get('contact');
  const publicSlug = form.get('publicSlug');
  if (
    typeof displayName !== 'string' ||
    typeof contact !== 'string' ||
    typeof publicSlug !== 'string'
  )
    return failureRedirect(request);

  const response = await fetch(`${internalApiBaseUrl}/api/internal/invitation-lookup`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
      'x-client-address': request.headers.get('x-real-ip')?.slice(0, 128) || 'unknown',
    },
    body: JSON.stringify({
      publicSlug,
      displayName,
      contact,
    }),
  });
  if (!response.ok) return failureRedirect(request);
  const parsed = invitationAccessGrantSchema.safeParse(await response.json());
  if (!parsed.success) return failureRedirect(request);
  return NextResponse.redirect(new URL(`/a/${parsed.data.grant}`, request.url), 303);
}
