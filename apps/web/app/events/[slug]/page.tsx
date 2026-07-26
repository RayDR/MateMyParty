import { BirthdayHomepage } from '../../../components/birthday-homepage';
import { getEventBySlug } from '../../../lib/events';
import { resolveRequestLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lookupError?: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const locale = await resolveRequestLocale({ eventLocale: event.locale });
  return (
    <BirthdayHomepage
      event={event}
      locale={locale}
      lookupFailed={(await searchParams).lookupError === '1'}
    />
  );
}
