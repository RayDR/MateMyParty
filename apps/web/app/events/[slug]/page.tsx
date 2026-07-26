import { EventInvitation } from '../../../components/event-invitation';
import { getEventBySlug } from '../../../lib/events';
import { resolveLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const locale = resolveLocale((await searchParams).locale, event.locale);
  return <EventInvitation event={event} locale={locale} />;
}
