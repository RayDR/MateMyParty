import { BirthdayHomepage } from '../../../components/birthday-homepage';
import { getEventByHostname } from '../../../lib/events';
import { resolveRequestLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function HostnameEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostname: string }>;
  searchParams: Promise<{ lookupError?: string }>;
}) {
  const { hostname } = await params;
  const event = await getEventByHostname(hostname);
  const locale = await resolveRequestLocale({ eventLocale: event.locale });
  return (
    <BirthdayHomepage
      event={event}
      locale={locale}
      lookupFailed={(await searchParams).lookupError === '1'}
    />
  );
}
