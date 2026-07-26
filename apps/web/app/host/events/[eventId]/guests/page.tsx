import { cookies } from 'next/headers';
import { HostAccess } from '../../../../../components/host-access';
import { HostGuestPanel } from '../../../../../components/host-guest-panel';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../../../lib/host-session';
import { resolveRequestLocale } from '../../../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function HostGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ accessError?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const locale = await resolveRequestLocale();
  const hasCookie = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  const returnTo = `/host/events/${eventId}/guests`;
  return hasCookie ? (
    <HostGuestPanel eventId={eventId} initialLocale={locale} />
  ) : (
    <HostAccess locale={locale} returnTo={returnTo} invalid={query.accessError === '1'} />
  );
}
