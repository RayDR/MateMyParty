'use client';

import { useEffect, useState } from 'react';
import type { HostEventSummary } from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';

export function HostDashboard() {
  const [locale, setLocale] = useState<Locale>('en-US');
  const [events, setEvents] = useState<HostEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const dictionary = getDictionary(locale);

  useEffect(() => {
    let active = true;
    void fetch('/internal/host/events', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Host events request failed');
        return (await response.json()) as HostEventSummary[];
      })
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81,#0f172a_42%,#020617)] text-white">
      <header className="border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
              MateMyParty
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{dictionary.host.dashboard}</h1>
          </div>
          <label className="text-sm text-slate-200">
            <span className="sr-only">{dictionary.host.language}</span>
            <select
              aria-label={dictionary.host.language}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2"
            >
              <option value="en-US">EN</option>
              <option value="es-MX">ES</option>
            </select>
          </label>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <p className="max-w-2xl text-lg text-slate-300">{dictionary.host.dashboardDescription}</p>
        {loading ? (
          <DashboardState text={dictionary.host.loadingEvents} />
        ) : error ? (
          <DashboardState text={dictionary.host.eventLoadError} error />
        ) : events.length === 0 ? (
          <DashboardState text={dictionary.host.noEvents} />
        ) : (
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {events.map((event) => (
              <EventCard
                key={event.identifier}
                event={event}
                locale={locale}
                dictionary={dictionary}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function EventCard({
  event,
  locale,
  dictionary,
}: {
  event: HostEventSummary;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [copied, setCopied] = useState<'address' | 'hostname' | null>(null);
  const publicUrl = event.primaryHostname
    ? `https://${event.primaryHostname}/`
    : `/events/${encodeURIComponent(event.publicSlug)}`;
  return (
    <Card>
      <article className="grid gap-5 sm:grid-cols-[11rem_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-700 to-slate-950">
          {event.thumbnailImageRef ? (
            // Managed media and HTTPS references are validated by the shared contract.
            <img
              src={event.thumbnailImageRef}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">
              ✦
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                {statusLabel(event.status, dictionary)}
              </p>
              <h2 className="mt-1 text-2xl font-black">{event.title}</h2>
              <p className="mt-1 text-slate-300">
                {event.celebrantName}
                {event.celebrantAge ? ` · ${event.celebrantAge}` : ''}
              </p>
            </div>
            <time className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                new Date(event.startsAt),
              )}
            </time>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            {event.venueName ?? dictionary.host.incomplete}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-2">
            <Metric label={dictionary.host.guestCount} value={event.statistics.guestCount} />
            <Metric
              label={dictionary.host.invitationCount}
              value={event.statistics.invitationCount}
            />
            <Metric label={dictionary.host.openedCount} value={event.statistics.openedCount} />
          </dl>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label={dictionary.host.rsvpAcceptedStat}
              value={event.statistics.rsvp.accepted}
            />
            <Metric label={dictionary.host.rsvpPendingStat} value={event.statistics.rsvp.pending} />
            <Metric
              label={dictionary.host.rsvpDeclinedStat}
              value={event.statistics.rsvp.declined}
            />
            <Metric
              label={dictionary.host.rsvpConfirmedTotalStat}
              value={event.statistics.rsvp.confirmedTotal}
            />
          </dl>
          <dl className="mt-4 space-y-1 text-sm text-slate-300">
            <div className="flex gap-2">
              <dt>{dictionary.host.template}:</dt>
              <dd className="text-white">{templateLabel(event.templateKey, dictionary)}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt>{dictionary.host.hostname}:</dt>
              <dd className="truncate text-white">
                {event.primaryHostname ?? dictionary.host.incomplete}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <Readiness
              complete={event.readiness.locationComplete}
              completeLabel={dictionary.host.locationComplete}
              incompleteLabel={dictionary.host.locationIncomplete}
            />
            <Readiness
              complete={event.readiness.scheduleComplete}
              completeLabel={dictionary.host.scheduleComplete}
              incompleteLabel={dictionary.host.scheduleIncomplete}
            />
            <Readiness
              complete={event.readiness.thumbnailConfigured}
              completeLabel={dictionary.host.thumbnailConfigured}
              incompleteLabel={dictionary.host.thumbnailMissing}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.formattedAddress ? (
              <CopyButton
                label={copied === 'address' ? dictionary.host.copied : dictionary.host.copyAddress}
                value={event.formattedAddress}
                onCopied={() => setCopiedTemporarily('address', setCopied)}
              />
            ) : null}
            {event.primaryHostname ? (
              <CopyButton
                label={
                  copied === 'hostname' ? dictionary.host.copied : dictionary.host.copyHostname
                }
                value={event.primaryHostname}
                onCopied={() => setCopiedTemporarily('hostname', setCopied)}
              />
            ) : null}
          </div>
        </div>
      </article>
      <nav
        className="mt-6 grid gap-2 border-t border-white/10 pt-5 sm:grid-cols-2"
        aria-label={event.title}
      >
        <Action href={`/host/events/${encodeURIComponent(event.identifier)}`} primary>
          {dictionary.host.manageEvent}
        </Action>
        <Action href={`/host/events/${encodeURIComponent(event.identifier)}/guests`}>
          {dictionary.host.manageGuests}
        </Action>
        <Action href={`/host/events/${encodeURIComponent(event.identifier)}/preview`}>
          {dictionary.host.previewInvitation}
        </Action>
        <Action href={`/host/events/${encodeURIComponent(event.identifier)}#calendar-preview`}>
          {dictionary.host.calendarPreview}
        </Action>
        <Action href={`/host/events/${encodeURIComponent(event.identifier)}/guests`}>
          {dictionary.host.invitationPreview}
        </Action>
        <Action href={publicUrl} external>
          {dictionary.host.openPublicPage}
        </Action>
      </nav>
    </Card>
  );
}

function Readiness({
  complete,
  completeLabel,
  incompleteLabel,
}: {
  complete: boolean;
  completeLabel: string;
  incompleteLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        complete ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-100'
      }`}
    >
      {complete ? '✓ ' : '○ '}
      {complete ? completeLabel : incompleteLabel}
    </span>
  );
}

function CopyButton({
  label,
  value,
  onCopied,
}: {
  label: string;
  value: string;
  onCopied: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(value).then(onCopied)}
      className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"
    >
      {label}
    </button>
  );
}

function setCopiedTemporarily(
  value: 'address' | 'hostname',
  setCopied: (value: 'address' | 'hostname' | null) => void,
) {
  setCopied(value);
  window.setTimeout(() => setCopied(null), 1800);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <dd className="text-xl font-black">{value}</dd>
      <dt className="mt-1 text-xs text-slate-400">{label}</dt>
    </div>
  );
}

function Action({
  href,
  children,
  primary = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`rounded-xl px-4 py-3 text-center text-sm font-bold transition ${
        primary ? 'bg-violet-500 hover:bg-violet-400' : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      {children}
    </a>
  );
}

function DashboardState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <p className={`mt-8 rounded-2xl p-6 ${error ? 'bg-red-500/15 text-red-200' : 'bg-white/5'}`}>
      {text}
    </p>
  );
}

export function statusLabel(status: HostEventSummary['status'], dictionary: Dictionary): string {
  return {
    DRAFT: dictionary.host.statusDraft,
    PUBLISHED: dictionary.host.statusPublished,
    CANCELLED: dictionary.host.statusCancelled,
    COMPLETED: dictionary.host.statusCompleted,
    ARCHIVED: dictionary.host.statusArchived,
  }[status];
}

export function templateLabel(
  template: HostEventSummary['templateKey'],
  dictionary: Dictionary,
): string {
  return {
    'kids-night-dragon': dictionary.host.templateKidsNightDragon,
    'envelope-reveal': dictionary.host.templateEnvelopeReveal,
    'winter-snow': dictionary.host.templateWinterSnow,
    'adventure-gates': dictionary.host.templateAdventureGates,
  }[template];
}
