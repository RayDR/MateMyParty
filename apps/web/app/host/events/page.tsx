import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HostDashboard } from '../../../components/host-dashboard';
import { HOST_SESSION_COOKIE, parseSessionValue } from '../../../lib/host-session';
import { platformPublicUrl } from '../../../lib/public-origin';

export const dynamic = 'force-dynamic';

export default async function HostEventsPage() {
  const scope = parseSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!scope) redirect(platformPublicUrl('/host/access').toString());
  if (scope.kind === 'event') {
    redirect(
      platformPublicUrl(`/host/events/${encodeURIComponent(scope.eventIdentifier)}`).toString(),
    );
  }
  return <HostDashboard />;
}
