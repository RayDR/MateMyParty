import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { HostEventEditor } from '../../../../components/host-event-editor';
import { HOST_SESSION_COOKIE, parseSessionValue } from '../../../../lib/host-session';
import { platformPublicUrl } from '../../../../lib/public-origin';

export const dynamic = 'force-dynamic';

export default async function HostEventPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const scope = parseSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!scope) redirect(platformPublicUrl('/host/access').toString());
  if (scope.kind === 'event' && scope.eventIdentifier !== identifier) notFound();
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identifier)) notFound();
  return <HostEventEditor identifier={identifier} />;
}
