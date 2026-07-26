import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';
import { LanguageSelector } from '../../../components/language-selector';
import { getHostEvents } from '../../../lib/host-api';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../lib/host-session';
import { resolveRequestLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function HostEventsPage() {
  const hasSession = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (!hasSession) redirect('/host/access');
  const locale = await resolveRequestLocale();
  const dictionary = getDictionary(locale);
  const events = await getHostEvents();
  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-end">
          <LanguageSelector locale={locale} dictionary={dictionary} />
        </div>
        <Card>
          <h1 className="text-3xl font-black">{dictionary.host.eventsTitle}</h1>
          <p className="mt-3 text-slate-300">{dictionary.host.eventsDescription}</p>
          {events.length ? (
            <div className="mt-6 grid gap-4">
              {events.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/15 p-4">
                  <h2 className="text-xl font-bold">{event.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {event.primaryHostname ?? event.publicSlug}
                  </p>
                  <Link
                    href={`/host/events/${event.id}/guests`}
                    className="mt-4 inline-block rounded-xl bg-violet-500 px-4 py-2 font-bold"
                  >
                    {dictionary.host.openGuestManagement}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-slate-300">{dictionary.host.noEvents}</p>
          )}
        </Card>
      </div>
    </main>
  );
}
