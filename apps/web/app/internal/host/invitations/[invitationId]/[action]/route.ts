import { NextResponse, type NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../../../lib/host-api';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string; action: string }> },
) {
  const { invitationId, action } = await context.params;
  if (action !== 'revoke' && action !== 'regenerate') {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Not found', status: 404 },
      { status: 404 },
    );
  }
  return forwardHostRequest(
    request,
    `/api/host/invitations/${encodeURIComponent(invitationId)}/${action}`,
  );
}
