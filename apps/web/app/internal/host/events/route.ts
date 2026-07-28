import type { NextRequest } from 'next/server';
import { forwardHostRequest } from '../../../../lib/host-api';

export async function GET(request: NextRequest) {
  return forwardHostRequest(request, '/api/host/events');
}
