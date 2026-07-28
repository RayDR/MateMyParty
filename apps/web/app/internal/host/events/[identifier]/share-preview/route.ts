import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../lib/host-api';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  const locale = request.nextUrl.searchParams.get('locale');
  return forwardHostRequest(
    request,
    `/api/host/events/${encodeURIComponent(identifier)}/share-preview${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`,
  );
}
