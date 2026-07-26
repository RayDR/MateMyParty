import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../lib/host-api';

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  return forwardHostRequest(
    request,
    `/api/host/events/${encodeURIComponent(eventId)}/guests?includeArchived=${includeArchived}`,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  return forwardHostRequest(request, `/api/host/events/${encodeURIComponent(eventId)}/guests`);
}
