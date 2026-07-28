import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../lib/host-api';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  return forwardHostRequest(
    request,
    `/api/host/invitations/${encodeURIComponent(invitationId)}/rsvp`,
  );
}
