'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  HostCalendarPreview,
  HostEventDetail,
  UpdateHostEventInput,
} from '@matemyparty/contracts';
import { hostCalendarPreviewSchema } from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';
import { statusLabel, templateLabel } from './host-dashboard';

type LocalizedContent = HostEventDetail['localizedContent']['en-US'];

export function HostEventEditor({ identifier }: { identifier: string }) {
  const [locale, setLocale] = useState<Locale>('en-US');
  const [contentLocale, setContentLocale] = useState<Locale>('en-US');
  const [draft, setDraft] = useState<HostEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<'saved' | 'error' | null>(null);
  const [calendarPreview, setCalendarPreview] = useState<HostCalendarPreview | null>(null);
  const dictionary = getDictionary(locale);

  useEffect(() => {
    let active = true;
    void fetch(`/internal/host/events/${encodeURIComponent(identifier)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Host event request failed');
        return (await response.json()) as HostEventDetail;
      })
      .then((event) => {
        if (!active) return;
        setDraft(event);
        setLocale(event.defaultLocale);
        setContentLocale(event.defaultLocale);
      })
      .catch(() => {
        if (active) setMessage('error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identifier]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/internal/host/events/${encodeURIComponent(identifier)}/calendar-preview?locale=${locale}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) return;
        const result = hostCalendarPreviewSchema.safeParse(await response.json());
        if (result.success) setCalendarPreview(result.data);
      })
      .catch(() => {
        /* The editor remains available if the read-only preview cannot load. */
      });
    return () => controller.abort();
  }, [draft?.revisionNumber, identifier, locale]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(transform: (current: HostEventDetail) => HostEventDetail) {
    setDraft((current) => (current ? transform(current) : current));
    setDirty(true);
    setMessage(null);
  }

  function changeLocalized<K extends keyof LocalizedContent>(key: K, value: LocalizedContent[K]) {
    change((current) => ({
      ...current,
      localizedContent: {
        ...current.localizedContent,
        [contentLocale]: { ...current.localizedContent[contentLocale], [key]: value },
      },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    const payload: UpdateHostEventInput = {
      celebrantAge: draft.celebrantAge,
      eventType: draft.eventType,
      status: draft.status,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
      defaultLocale: draft.defaultLocale,
      addressLine1: draft.addressLine1,
      addressLine2: draft.addressLine2,
      city: draft.city,
      region: draft.region,
      postalCode: draft.postalCode,
      countryCode: draft.countryCode,
      latitude: draft.latitude,
      longitude: draft.longitude,
      mapsUrl: draft.mapsUrl,
      thumbnailImageRef: draft.thumbnailImageRef,
      publicThumbnailRef: draft.publicThumbnailRef,
      staticBackgroundRef: draft.staticBackgroundRef,
      rsvpDeadline: draft.rsvpDeadline,
      localizedContent: draft.localizedContent,
      template: draft.template,
    };
    try {
      const response = await fetch(`/internal/host/events/${encodeURIComponent(identifier)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Host event update failed');
      setDraft((await response.json()) as HostEventDetail);
      setDirty(false);
      setMessage('saved');
    } catch {
      setMessage('error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <EditorState text={dictionary.host.loadingEvents} />;
  if (!draft) return <EditorState text={dictionary.host.eventLoadError} error />;
  const content = draft.localizedContent[contentLocale];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81,#0f172a_38%,#020617)] pb-28 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <a href="/host/events" className="text-sm text-cyan-300 hover:text-cyan-200">
              ← {dictionary.host.backToEvents}
            </a>
            <h1 className="truncate text-xl font-black sm:text-2xl">{draft.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/host/events/${encodeURIComponent(identifier)}/preview`}
              className="rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold"
            >
              {dictionary.host.previewInvitation}
            </a>
            <a
              href={`/host/events/${encodeURIComponent(identifier)}/guests`}
              className="hidden rounded-xl bg-white/10 px-3 py-2 text-sm font-bold sm:block"
            >
              {dictionary.host.manageGuests}
            </a>
            <select
              aria-label={dictionary.host.language}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="en-US">EN</option>
              <option value="es-MX">ES</option>
            </select>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-cyan-300">
              {dictionary.host.eventEditor}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {dictionary.host.revision} {draft.revisionNumber}
            </p>
          </div>
          {dirty ? (
            <p
              role="status"
              className="rounded-xl bg-amber-400/15 px-4 py-2 text-sm text-amber-200"
            >
              {dictionary.host.unsavedChanges}
            </p>
          ) : null}
        </div>

        {message ? (
          <p
            role="status"
            className={`rounded-xl p-4 ${
              message === 'saved'
                ? 'bg-emerald-500/15 text-emerald-200'
                : 'bg-red-500/15 text-red-200'
            }`}
          >
            {message === 'saved' ? dictionary.host.saved : dictionary.host.saveError}
          </p>
        ) : null}

        <Card>
          <SectionHeading title={dictionary.host.basicInformation} />
          <LanguageTabs
            locale={contentLocale}
            setLocale={setContentLocale}
            dictionary={dictionary}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField
              label={dictionary.host.titleLabel}
              value={content.title}
              required
              onChange={(value) => changeLocalized('title', value)}
            />
            <TextField
              label={dictionary.host.celebrantNameLabel}
              value={content.celebrantName}
              required
              onChange={(value) => changeLocalized('celebrantName', value)}
            />
            <TextField
              label={dictionary.host.celebrantAgeLabel}
              value={draft.celebrantAge ?? ''}
              type="number"
              min={1}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  celebrantAge: value === '' ? null : Number(value),
                }))
              }
            />
            <SelectField
              label={dictionary.host.eventTypeLabel}
              value={draft.eventType}
              options={[['KIDS_BIRTHDAY', dictionary.host.typeKidsBirthday]]}
              onChange={(value) =>
                change((current) => ({ ...current, eventType: value as 'KIDS_BIRTHDAY' }))
              }
            />
            <SelectField
              label={dictionary.host.eventStatusLabel}
              value={draft.status}
              options={statusOptions(dictionary)}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  status: value as HostEventDetail['status'],
                }))
              }
            />
            <SelectField
              label={dictionary.host.defaultLocaleLabel}
              value={draft.defaultLocale}
              options={[
                ['en-US', dictionary.common.english],
                ['es-MX', dictionary.common.spanish],
              ]}
              onChange={(value) =>
                change((current) => ({ ...current, defaultLocale: value as Locale }))
              }
            />
            <TextAreaField
              label={dictionary.host.hostMessageLabel}
              value={content.hostMessage ?? ''}
              onChange={(value) => changeLocalized('hostMessage', emptyToNull(value))}
              className="md:col-span-2"
            />
          </div>
        </Card>

        <Card>
          <SectionHeading title={dictionary.host.dateLocation} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField
              label={dictionary.host.startDateTime}
              value={isoToLocalInput(draft.startsAt, draft.timezone)}
              type="datetime-local"
              required
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  startsAt: localInputToIso(value, current.timezone),
                }))
              }
            />
            <TextField
              label={dictionary.host.endDateTime}
              value={draft.endsAt ? isoToLocalInput(draft.endsAt, draft.timezone) : ''}
              type="datetime-local"
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  endsAt: value ? localInputToIso(value, current.timezone) : null,
                }))
              }
            />
            <TextField
              label={dictionary.host.timezoneLabel}
              value={draft.timezone}
              required
              onChange={(value) => change((current) => ({ ...current, timezone: value }))}
            />
            <TextField
              label={dictionary.host.rsvpDeadlineLabel}
              value={draft.rsvpDeadline ? isoToLocalInput(draft.rsvpDeadline, draft.timezone) : ''}
              type="datetime-local"
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  rsvpDeadline: value ? localInputToIso(value, current.timezone) : null,
                }))
              }
            />
            <TextField
              label={dictionary.host.venueName}
              value={content.venueName ?? ''}
              onChange={(value) => changeLocalized('venueName', emptyToNull(value))}
            />
            <TextField
              label={dictionary.host.addressLine1}
              value={draft.addressLine1 ?? ''}
              onChange={(value) =>
                change((current) => ({ ...current, addressLine1: emptyToNull(value) }))
              }
            />
            <TextField
              label={dictionary.host.addressLine2}
              value={draft.addressLine2 ?? ''}
              onChange={(value) =>
                change((current) => ({ ...current, addressLine2: emptyToNull(value) }))
              }
            />
            <TextField
              label={dictionary.host.city}
              value={draft.city ?? ''}
              onChange={(value) => change((current) => ({ ...current, city: emptyToNull(value) }))}
            />
            <TextField
              label={dictionary.host.region}
              value={draft.region ?? ''}
              onChange={(value) =>
                change((current) => ({ ...current, region: emptyToNull(value) }))
              }
            />
            <TextField
              label={dictionary.host.postalCode}
              value={draft.postalCode ?? ''}
              onChange={(value) =>
                change((current) => ({ ...current, postalCode: emptyToNull(value) }))
              }
            />
            <TextField
              label={dictionary.host.countryCode}
              value={draft.countryCode ?? ''}
              maxLength={2}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  countryCode: emptyToNull(value.toUpperCase()),
                }))
              }
            />
            <TextField
              label={dictionary.host.mapsUrl}
              value={draft.mapsUrl ?? ''}
              type="url"
              onChange={(value) =>
                change((current) => ({ ...current, mapsUrl: emptyToNull(value) }))
              }
              className="md:col-span-2"
            />
            <TextField
              label={dictionary.host.latitude}
              value={draft.latitude ?? ''}
              type="number"
              min={-90}
              max={90}
              step="any"
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  latitude: value === '' ? null : Number(value),
                }))
              }
            />
            <TextField
              label={dictionary.host.longitude}
              value={draft.longitude ?? ''}
              type="number"
              min={-180}
              max={180}
              step="any"
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  longitude: value === '' ? null : Number(value),
                }))
              }
            />
            <TextAreaField
              label={dictionary.host.arrivalInstructions}
              value={content.arrivalInstructions ?? ''}
              onChange={(value) => changeLocalized('arrivalInstructions', emptyToNull(value))}
              className="md:col-span-2"
            />
            <TextAreaField
              label={dictionary.host.parkingInstructions}
              value={content.parkingInstructions ?? ''}
              onChange={(value) => changeLocalized('parkingInstructions', emptyToNull(value))}
              className="md:col-span-2"
            />
          </div>
        </Card>

        {calendarPreview ? (
          <div id="calendar-preview">
            <Card>
              <SectionHeading title={dictionary.host.calendarPreview} />
              <dl className="mt-5 grid gap-3 md:grid-cols-2">
                <DetailPreview
                  label={dictionary.host.titleLabel}
                  value={calendarPreview.event.title}
                />
                <DetailPreview
                  label={dictionary.host.startDateTime}
                  value={new Intl.DateTimeFormat(locale, {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: calendarPreview.event.timezone,
                  }).format(new Date(calendarPreview.event.startsAt))}
                />
                <DetailPreview
                  label={dictionary.host.venueName}
                  value={calendarPreview.event.location ?? dictionary.host.incomplete}
                />
                <DetailPreview label="UID" value={calendarPreview.stableUid} />
              </dl>
              <p className="mt-4 text-sm text-slate-400">
                {dictionary.host.calendarFallback.replace(
                  '{minutes}',
                  String(calendarPreview.providerFallbackMinutes),
                )}
              </p>
              {calendarPreview.maps ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={calendarPreview.maps.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold"
                  >
                    {dictionary.invitation.googleMaps}
                  </a>
                  <a
                    href={calendarPreview.maps.appleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold"
                  >
                    {dictionary.invitation.appleMaps}
                  </a>
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        <Card>
          <SectionHeading title={dictionary.host.branding} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_16rem]">
            <div className="grid gap-4">
              <TextField
                label={dictionary.host.thumbnailImageRef}
                value={draft.thumbnailImageRef ?? ''}
                onChange={(value) =>
                  change((current) => ({ ...current, thumbnailImageRef: emptyToNull(value) }))
                }
              />
              <TextField
                label={dictionary.host.publicThumbnailRef}
                value={draft.publicThumbnailRef ?? ''}
                onChange={(value) =>
                  change((current) => ({ ...current, publicThumbnailRef: emptyToNull(value) }))
                }
              />
              <TextField
                label={dictionary.host.staticBackgroundRef}
                value={draft.staticBackgroundRef ?? ''}
                onChange={(value) =>
                  change((current) => ({ ...current, staticBackgroundRef: emptyToNull(value) }))
                }
              />
              <TextField
                label={dictionary.host.thumbnailAltText}
                value={content.thumbnailAltText}
                required
                onChange={(value) => changeLocalized('thumbnailAltText', value)}
              />
              <p className="text-xs text-slate-400">{dictionary.host.mediaReferenceHelp}</p>
              <p className="text-xs text-slate-400">{dictionary.host.publicThumbnailHelp}</p>
            </div>
            <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {draft.thumbnailImageRef ? (
                <img
                  src={draft.thumbnailImageRef}
                  alt={content.thumbnailAltText}
                  className="aspect-[4/3] h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center p-5 text-center text-sm text-slate-400">
                  {dictionary.host.noThumbnail}
                </div>
              )}
              <figcaption className="border-t border-white/10 p-3 text-xs text-slate-400">
                {dictionary.host.currentThumbnail}
              </figcaption>
            </figure>
          </div>
        </Card>

        <Card>
          <SectionHeading title={dictionary.host.templateConfiguration} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SelectField
              label={dictionary.host.templateKey}
              value={draft.template.key}
              options={templateOptions(dictionary)}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, key: value as HostEventDetail['templateKey'] },
                  templateKey: value as HostEventDetail['templateKey'],
                }))
              }
            />
            <TextField
              label={dictionary.host.templateVersion}
              value={draft.template.version}
              type="number"
              min={1}
              required
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, version: Number(value) },
                }))
              }
            />
            <SelectField
              label={dictionary.host.animationMode}
              value={draft.template.animationMode}
              options={animationOptions(dictionary)}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: {
                    ...current.template,
                    animationMode: value as HostEventDetail['template']['animationMode'],
                  },
                }))
              }
            />
            <TextField
              label={dictionary.host.overlayIntensity}
              value={draft.template.overlayIntensity}
              type="range"
              min={0}
              max={100}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, overlayIntensity: Number(value) },
                }))
              }
            />
            <TextField
              label={dictionary.host.videoBackgroundRef}
              value={draft.template.videoBackgroundRef ?? ''}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, videoBackgroundRef: emptyToNull(value) },
                }))
              }
            />
            <TextField
              label={dictionary.host.staticFallbackRef}
              value={draft.template.staticFallbackRef ?? ''}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, staticFallbackRef: emptyToNull(value) },
                }))
              }
            />
            <TextField
              label={dictionary.host.audioRef}
              value={draft.template.audioRef ?? ''}
              onChange={(value) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, audioRef: emptyToNull(value) },
                }))
              }
              className="md:col-span-2"
            />
            <Toggle
              label={dictionary.host.animationEnabled}
              checked={draft.template.animationEnabled}
              onChange={(checked) =>
                change((current) => ({
                  ...current,
                  template: {
                    ...current.template,
                    animationEnabled: checked,
                    animationMode: checked
                      ? current.template.animationMode === 'NONE'
                        ? 'SUBTLE'
                        : current.template.animationMode
                      : 'NONE',
                  },
                }))
              }
            />
            <Toggle
              label={dictionary.host.audioEnabled}
              checked={draft.template.audioEnabled}
              onChange={(checked) =>
                change((current) => ({
                  ...current,
                  template: { ...current.template, audioEnabled: checked },
                }))
              }
            />
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
          <span className="hidden text-sm text-slate-400 sm:block">
            {dirty
              ? dictionary.host.unsavedChanges
              : `${dictionary.host.revision} ${draft.revisionNumber}`}
          </span>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="w-full rounded-xl bg-violet-500 px-6 py-3 font-black transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto"
          >
            {saving ? dictionary.host.saving : dictionary.host.save}
          </button>
        </div>
      </form>
    </main>
  );
}

function DetailPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-cyan-200">{label}</dt>
      <dd className="mt-2 break-words text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function LanguageTabs({
  locale,
  setLocale,
  dictionary,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: Dictionary;
}) {
  return (
    <div className="mt-4 flex items-center gap-2" aria-label={dictionary.host.editingLanguage}>
      <span className="mr-2 text-sm text-slate-400">{dictionary.host.editingLanguage}</span>
      {(['en-US', 'es-MX'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={locale === value}
          onClick={() => setLocale(value)}
          className={`rounded-xl px-3 py-2 text-sm font-bold ${
            locale === value ? 'bg-cyan-500 text-slate-950' : 'bg-white/10'
          }`}
        >
          {value === 'en-US' ? 'EN' : 'ES'}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-xl font-black sm:text-2xl">{title}</h2>;
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  min,
  max,
  maxLength,
  step,
  className = '',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number | string;
  className?: string;
}) {
  return (
    <label className={`text-sm text-slate-200 ${className}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`text-sm text-slate-200 ${className}`}>
      <span>{label}</span>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-200">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-cyan-400"
      />
      {label}
    </label>
  );
}

function EditorState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
      <p className={`rounded-2xl p-6 ${error ? 'bg-red-500/15 text-red-200' : 'bg-white/5'}`}>
        {text}
      </p>
    </main>
  );
}

function emptyToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function isoToLocalInput(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function localInputToIso(value: string, timeZone: string): string {
  const [date, time] = value.split('T');
  const [year, month, day] = date!.split('-').map(Number);
  const [hour, minute] = time!.split(':').map(Number);
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let guess = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
    const represented = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
    );
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

function statusOptions(dictionary: Dictionary): [string, string][] {
  return (['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'ARCHIVED'] as const).map((status) => [
    status,
    statusLabel(status, dictionary),
  ]);
}

function templateOptions(dictionary: Dictionary): [string, string][] {
  return (['kids-night-dragon', 'envelope-reveal', 'winter-snow', 'adventure-gates'] as const).map(
    (template) => [template, templateLabel(template, dictionary)],
  );
}

function animationOptions(dictionary: Dictionary): [string, string][] {
  return [
    ['NONE', dictionary.host.animationNone],
    ['SUBTLE', dictionary.host.animationSubtle],
    ['IMMERSIVE', dictionary.host.animationImmersive],
  ];
}
