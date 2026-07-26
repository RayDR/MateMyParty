import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../lib/host-api';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  return forwardHostRequest(request, `/api/host/events/${encodeURIComponent(identifier)}`);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  return forwardHostRequest(request, `/api/host/events/${encodeURIComponent(identifier)}`);
}
