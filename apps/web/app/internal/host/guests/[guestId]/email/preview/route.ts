import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../../lib/host-api';

export async function GET(request: NextRequest, context: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await context.params;
  const locale = request.nextUrl.searchParams.get('locale');
  return forwardHostRequest(
    request,
    `/api/host/guests/${encodeURIComponent(guestId)}/email/preview${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`,
  );
}
