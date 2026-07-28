import type { NextRequest } from 'next/server';
import { forwardHostRequest, rejectInvalidHostMutation } from '../../../../../../../lib/host-api';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guestId: string }> },
) {
  const rejected = rejectInvalidHostMutation(request);
  if (rejected) return rejected;
  const { guestId } = await context.params;
  return forwardHostRequest(request, `/api/host/guests/${encodeURIComponent(guestId)}/email/send`);
}
