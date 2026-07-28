import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { HostGuestPanel } from '../../../../../components/host-guest-panel';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../../../lib/host-session';
import { platformPublicUrl } from '../../../../../lib/public-origin';

export const dynamic = 'force-dynamic';

export default async function HostGuestsPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const hasSession = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!hasSession) redirect(platformPublicUrl('/host/access').toString());
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identifier)) notFound();
  return <HostGuestPanel eventIdentifier={identifier} />;
}
