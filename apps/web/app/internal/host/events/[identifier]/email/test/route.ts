import type { NextRequest } from 'next/server';
import { forwardHostRequest, rejectInvalidHostMutation } from '../../../../../../../lib/host-api';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> },
) {
  const rejected = rejectInvalidHostMutation(request);
  if (rejected) return rejected;
  const { identifier } = await context.params;
  return forwardHostRequest(
    request,
    `/api/host/events/${encodeURIComponent(identifier)}/email/test`,
  );
}
