import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HostGuestPanel } from '../../../../../components/host-guest-panel';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../../../lib/host-session';

export const dynamic = 'force-dynamic';

export default async function HostGuestsPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const hasSession = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!hasSession) redirect('/host/access');
  return <HostGuestPanel eventIdentifier={identifier} />;
}
