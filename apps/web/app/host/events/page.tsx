import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HostDashboard } from '../../../components/host-dashboard';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../lib/host-session';

export const dynamic = 'force-dynamic';

export default async function HostEventsPage() {
  const hasSession = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!hasSession) redirect('/host/access');
  return <HostDashboard />;
}
