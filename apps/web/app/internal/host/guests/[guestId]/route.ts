import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../lib/host-api';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ guestId: string }> },
) {
  return forwardHostRequest(
    request,
    `/api/host/guests/${encodeURIComponent((await context.params).guestId)}`,
  );
}
