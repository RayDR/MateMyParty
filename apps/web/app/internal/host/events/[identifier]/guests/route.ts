import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../lib/host-api';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  return forwardHostRequest(
    request,
    `/api/host/events/${encodeURIComponent(identifier)}/guests?includeArchived=${includeArchived}`,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  return forwardHostRequest(request, `/api/host/events/${encodeURIComponent(identifier)}/guests`);
}
