import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { EventInvitation } from '../../../components/event-invitation';
import { getEventByHostname } from '../../../lib/events';
import { LANGUAGE_COOKIE } from '../../../lib/invitation-access';
import { resolveLocalePreference } from '../../../lib/locale';
import { publicEventMetadata } from '../../../lib/public-event-metadata';

export const dynamic = 'force-dynamic';

async function eventAndLocale(hostname: string) {
  const event = await getEventByHostname(hostname);
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
  params: Promise<{ hostname: string }>;
}): Promise<Metadata> {
  const { event, locale } = await eventAndLocale((await params).hostname);
  return publicEventMetadata(event, locale);
}

export default async function HostnameEventPage({
  params,
}: {
  params: Promise<{ hostname: string }>;
}) {
  const { hostname } = await params;
  const { event, locale } = await eventAndLocale(hostname);
  return <EventInvitation event={event} initialLocale={locale} />;
}
