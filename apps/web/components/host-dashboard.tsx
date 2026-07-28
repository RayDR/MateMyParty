'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  HostEventDetail,
  HostEventSummary,
  UpdateHostEventInput,
} from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';
import { Eye, ImageIcon, Pencil, Share2, Users, X } from 'lucide-react';
import { usePersistentLocale } from '../lib/use-persistent-locale';

export function HostDashboard() {
  const [locale, setLocale] = usePersistentLocale('en-US');
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
  const [thumbnailOpen, setThumbnailOpen] = useState(false);
  const [thumbnailRef, setThumbnailRef] = useState(event.thumbnailImageRef);
  const publicUrl = event.primaryHostname
    ? `https://${event.primaryHostname}/`
    : `/events/${encodeURIComponent(event.publicSlug)}`;
  return (
    <>
      <Card>
        <article className="grid gap-5 sm:grid-cols-[11rem_1fr]">
          <button
            type="button"
            onClick={() => setThumbnailOpen(true)}
            aria-label={dictionary.host.branding}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left"
          >
            {thumbnailRef ? (
              // Managed media and HTTPS references are validated by the shared contract.
              <img src={thumbnailRef} alt={event.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full items-center justify-center text-slate-500"
                aria-hidden="true"
              >
                <ImageIcon size={40} />
              </div>
            )}
            <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-full bg-slate-950/85 px-3 py-2 text-xs font-bold opacity-100 backdrop-blur sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
              <Pencil size={14} aria-hidden /> {dictionary.host.branding}
            </span>
          </button>
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
            <p className="mt-4 text-sm text-slate-300">
              {event.statistics.guestCount} {dictionary.host.guestCount.toLocaleLowerCase()} ·{' '}
              {event.statistics.rsvp.accepted}{' '}
              {dictionary.host.rsvpAcceptedStat.toLocaleLowerCase()}
            </p>
            <details className="mt-4 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <summary className="cursor-pointer font-bold text-slate-300">
                {dictionary.host.showDetailedStatistics}
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric
                  label={dictionary.host.invitationCount}
                  value={event.statistics.invitationCount}
                />
                <Metric label={dictionary.host.openedCount} value={event.statistics.openedCount} />
                <Metric
                  label={dictionary.host.rsvpPendingStat}
                  value={event.statistics.rsvp.pending}
                />
                <Metric
                  label={dictionary.host.rsvpConfirmedTotalStat}
                  value={event.statistics.rsvp.confirmedTotal}
                />
              </dl>
            </details>
            <dl className="mt-4 space-y-1 text-sm text-slate-400">
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
                  label={
                    copied === 'address' ? dictionary.host.copied : dictionary.host.copyAddress
                  }
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
          className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-4"
          aria-label={event.title}
        >
          <Action
            href={`/host/events/${encodeURIComponent(event.identifier)}`}
            primary
            icon={<Pencil size={17} />}
          >
            {dictionary.host.manageEvent}
          </Action>
          <Action
            href={`/host/events/${encodeURIComponent(event.identifier)}/guests`}
            icon={<Users size={17} />}
          >
            {dictionary.host.manageGuests}
          </Action>
          <Action
            href={`/host/events/${encodeURIComponent(event.identifier)}/preview`}
            icon={<Eye size={17} />}
          >
            {dictionary.host.previewInvitation}
          </Action>
          <Action href={publicUrl} external icon={<Share2 size={17} />}>
            {dictionary.host.openPublicPage}
          </Action>
        </nav>
      </Card>
      {thumbnailOpen ? (
        <ThumbnailModal
          event={event}
          dictionary={dictionary}
          onClose={() => setThumbnailOpen(false)}
          onSaved={(reference) => {
            setThumbnailRef(reference);
            setThumbnailOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ThumbnailModal({
  event,
  dictionary,
  onClose,
  onSaved,
}: {
  event: HostEventSummary;
  dictionary: Dictionary;
  onClose: () => void;
  onSaved: (reference: string | null) => void;
}) {
  const [detail, setDetail] = useState<HostEventDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/internal/host/events/${encodeURIComponent(event.identifier)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setDetail((await response.json()) as HostEventDetail);
      })
      .catch(() => setError(true));
    return () => controller.abort();
  }, [event.identifier]);

  async function save(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (!detail) return;
    setSaving(true);
    setError(false);
    const response = await fetch(`/internal/host/events/${encodeURIComponent(event.identifier)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toUpdateInput(detail)),
    });
    setSaving(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    const updated = (await response.json()) as HostEventDetail;
    onSaved(updated.thumbnailImageRef);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="thumbnail-modal-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="thumbnail-modal-title" className="text-2xl font-black">
              {dictionary.host.branding}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{dictionary.host.publicThumbnailHelp}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dictionary.host.closeDialog}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10"
          >
            <X aria-hidden size={20} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-200">
            {dictionary.host.saveError}
          </p>
        ) : null}
        {!detail ? (
          <p className="mt-6 text-slate-300">{dictionary.host.loadingEvents}</p>
        ) : (
          <form onSubmit={save} className="mt-6 grid gap-5 md:grid-cols-[1fr_16rem]">
            <div className="grid gap-4">
              <ThumbnailField
                label={dictionary.host.thumbnailImageRef}
                value={detail.thumbnailImageRef ?? ''}
                listId="managed-thumbnail-references"
                options={[
                  detail.thumbnailImageRef,
                  detail.staticBackgroundRef,
                  detail.template.staticFallbackRef,
                ].filter((value): value is string =>
                  Boolean(value && /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i.test(value)),
                )}
                onChange={(value) =>
                  setDetail({ ...detail, thumbnailImageRef: value.trim() || null })
                }
              />
              <ThumbnailField
                label={dictionary.host.publicThumbnailRef}
                value={detail.publicThumbnailRef ?? ''}
                listId="public-thumbnail-references"
                options={[detail.publicThumbnailRef].filter((value): value is string =>
                  Boolean(value),
                )}
                onChange={(value) =>
                  setDetail({ ...detail, publicThumbnailRef: value.trim() || null })
                }
              />
              <ThumbnailField
                label={`${dictionary.host.thumbnailAltText} · EN`}
                value={detail.localizedContent['en-US'].thumbnailAltText}
                onChange={(value) =>
                  setDetail({
                    ...detail,
                    localizedContent: {
                      ...detail.localizedContent,
                      'en-US': { ...detail.localizedContent['en-US'], thumbnailAltText: value },
                    },
                  })
                }
              />
              <ThumbnailField
                label={`${dictionary.host.thumbnailAltText} · ES`}
                value={detail.localizedContent['es-MX'].thumbnailAltText}
                onChange={(value) =>
                  setDetail({
                    ...detail,
                    localizedContent: {
                      ...detail.localizedContent,
                      'es-MX': { ...detail.localizedContent['es-MX'], thumbnailAltText: value },
                    },
                  })
                }
              />
              <p className="text-xs leading-5 text-slate-400">
                {dictionary.host.mediaReferenceHelp}
              </p>
              <div className="space-y-2 rounded-xl bg-cyan-500/10 p-3 text-xs text-cyan-50">
                <p>
                  <strong>Dashboard:</strong>{' '}
                  {detail.thumbnailImageRef ?? dictionary.host.noThumbnail}
                </p>
                <p className="break-all">
                  <strong>Open Graph · WhatsApp · Email:</strong>{' '}
                  {detail.publicThumbnailRef ?? dictionary.host.noThumbnail}
                </p>
              </div>
            </div>
            <figure className="self-start overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
              {detail.thumbnailImageRef ? (
                <img
                  src={detail.thumbnailImageRef}
                  alt={detail.localizedContent['en-US'].thumbnailAltText}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-slate-500">
                  <ImageIcon size={38} />
                </div>
              )}
              <figcaption className="p-3 text-xs text-slate-400">
                4:3 · {dictionary.host.currentThumbnail}
              </figcaption>
            </figure>
            <div className="flex justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl bg-white/10 px-4 py-2 font-bold"
              >
                {dictionary.host.cancel}
              </button>
              <button
                disabled={saving}
                className="min-h-11 rounded-xl bg-cyan-600 px-5 py-2 font-black disabled:opacity-50"
              >
                {saving ? dictionary.host.saving : dictionary.host.save}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function ThumbnailField({
  label,
  value,
  onChange,
  listId,
  options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  listId?: string;
  options?: string[];
}) {
  return (
    <label className="text-sm text-slate-200">
      {label}
      <input
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3"
      />
      {listId ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function toUpdateInput(detail: HostEventDetail): UpdateHostEventInput {
  return {
    celebrantAge: detail.celebrantAge,
    eventType: detail.eventType,
    status: detail.status,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    timezone: detail.timezone,
    defaultLocale: detail.defaultLocale,
    addressLine1: detail.addressLine1,
    addressLine2: detail.addressLine2,
    city: detail.city,
    region: detail.region,
    postalCode: detail.postalCode,
    countryCode: detail.countryCode,
    latitude: detail.latitude,
    longitude: detail.longitude,
    mapsUrl: detail.mapsUrl,
    thumbnailImageRef: detail.thumbnailImageRef,
    publicThumbnailRef: detail.publicThumbnailRef,
    staticBackgroundRef: detail.staticBackgroundRef,
    rsvpDeadline: detail.rsvpDeadline,
    localizedContent: detail.localizedContent,
    template: detail.template,
  };
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
  icon,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  external?: boolean;
  icon?: ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
        primary ? 'bg-violet-500 hover:bg-violet-400' : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      {icon}
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
