import { cookies } from 'next/headers';
import { getDictionary, isLocale } from '@matemyparty/i18n';
import { HostAccess } from '../../../../../components/host-access';
import { HostGuestPanel } from '../../../../../components/host-guest-panel';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../../../lib/host-session';

export const dynamic = 'force-dynamic';

export default async function HostGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ accessError?: string; locale?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const locale = query.locale && isLocale(query.locale) ? query.locale : 'en-US';
  const dictionary = getDictionary(locale);
  const hasCookie = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  const returnTo = `/host/events/${eventId}/guests`;
  return hasCookie ? (
    <HostGuestPanel eventId={eventId} />
  ) : (
    <HostAccess dictionary={dictionary} returnTo={returnTo} invalid={query.accessError === '1'} />
  );
}
