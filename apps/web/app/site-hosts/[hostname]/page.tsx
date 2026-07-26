import { EventInvitation } from '../../../components/event-invitation';
import { getEventByHostname } from '../../../lib/events';
import { resolveLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function HostnameEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostname: string }>;
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const { hostname } = await params;
  const event = await getEventByHostname(hostname);
  const locale = resolveLocale((await searchParams).locale, event.locale);
  return <EventInvitation event={event} locale={locale} />;
}
