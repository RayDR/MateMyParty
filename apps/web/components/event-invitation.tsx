import type { PublicEvent } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';

export function EventInvitation({ event, locale }: { event: PublicEvent; locale: Locale }) {
  const dictionary = getDictionary(locale);
  const startsAt = new Date(event.startsAt);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: event.timezone,
  }).format(startsAt);
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(startsAt);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#312e81,#0f172a_48%,#020617)] p-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl items-center">
        <Card>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
              {dictionary.event.birthday}
            </p>
            <h1 className="mt-4 text-4xl font-black sm:text-6xl">{event.title}</h1>
            <p className="mt-3 text-2xl text-violet-200">{event.celebrantName}</p>
            {event.celebrantAge ? (
              <p className="mt-1 text-slate-300">
                {dictionary.event.age.replace('{age}', String(event.celebrantAge))}
              </p>
            ) : null}
          </div>
          <dl className="mt-10 grid gap-4 sm:grid-cols-2">
            <Detail label={dictionary.event.date} value={date} />
            <Detail label={dictionary.event.time} value={time} />
            <Detail label={dictionary.event.timezone} value={event.timezone} />
            <Detail
              label={dictionary.event.venue}
              value={event.venueName ?? dictionary.event.datePending}
            />
          </dl>
          {event.hostMessage ? (
            <p className="mt-8 text-center text-lg text-slate-200">{event.hostMessage}</p>
          ) : null}
          <p className="mt-8 rounded-2xl bg-violet-500/15 p-4 text-center text-violet-100">
            {dictionary.event.invitationSoon}
          </p>
        </Card>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-cyan-300">{label}</dt>
      <dd className="mt-2 text-lg text-slate-100">{value}</dd>
    </div>
  );
}
