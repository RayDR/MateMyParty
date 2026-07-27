import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { EventInvitation } from '../../../components/event-invitation';
import { getEventBySlug } from '../../../lib/events';
import { LANGUAGE_COOKIE } from '../../../lib/invitation-access';
import { resolveLocalePreference } from '../../../lib/locale';
import { publicEventMetadata } from '../../../lib/public-event-metadata';

export const dynamic = 'force-dynamic';

async function eventAndLocale(slug: string) {
  const event = await getEventBySlug(slug);
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocalePreference({
    manualCookie: cookieStore.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language') ?? undefined,
    eventDefaultLocale: event.defaultLocale,
  });
  return { event, locale };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { event, locale } = await eventAndLocale((await params).slug);
  return publicEventMetadata(event, locale);
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event, locale } = await eventAndLocale(slug);
  return <EventInvitation event={event} initialLocale={locale} />;
}
