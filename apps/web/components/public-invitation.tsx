'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  CalendarEvent,
  PrivateInvitation as PrivateInvitationData,
  PublicRsvpResponse,
  RsvpStatus,
} from '@matemyparty/contracts';
import { richTextToHtml } from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { CalendarPlus, ChevronDown, Copy, MapPin, RotateCcw, Sparkles } from 'lucide-react';
import { LanguageSelector } from './language-selector';
import { ThemedInvitationStage } from './themed-invitation-stage';
import { EventCountdown } from './event-countdown';

export function PublicInvitation({
  invitation,
  initialLocale,
  preview = false,
  mediaDisabled = false,
  reducedMotion = false,
  accessToken,
}: {
  invitation: PrivateInvitationData;
  initialLocale: Locale;
  preview?: boolean;
  mediaDisabled?: boolean;
  reducedMotion?: boolean;
  accessToken?: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [opened, setOpened] = useState(false);
  const [calendar, setCalendar] = useState<CalendarEvent>(invitation.tools.calendar);
  const dictionary = getDictionary(locale);
  const { event } = invitation;
  const content = event.localizedContent[locale];
  const startsAt = new Date(event.startsAt);
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(startsAt);
  const endsAt = event.endsAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: event.timezone,
      }).format(new Date(event.endsAt))
    : null;
  const address = [
    event.addressLine1,
    event.addressLine2,
    event.city,
    event.region,
    event.postalCode,
    event.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
  useEffect(() => {
    if (preview || locale === invitation.tools.calendar.locale) {
      setCalendar(invitation.tools.calendar);
      return;
    }
    const controller = new AbortController();
    void fetch(`/internal/calendar?locale=${locale}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: accessToken ? { 'x-invitation-token': accessToken } : {},
    })
      .then(async (response) => {
        if (response.ok) setCalendar((await response.json()) as CalendarEvent);
      })
      .catch(() => {
        /* The original locale calendar remains usable if localization refresh fails. */
      });
    return () => controller.abort();
  }, [accessToken, locale, preview]);
  return (
    <ThemedInvitationStage
      presentation={event.presentation}
      dictionary={dictionary}
      privateExperience
      mediaDisabled={mediaDisabled}
      forceReducedMotion={reducedMotion}
      containedControls={preview}
      mediaUnlocked={opened}
    >
      <div
        lang={locale}
        data-invitation-side={opened ? 'back' : 'front'}
        className="mx-auto min-h-screen max-w-5xl px-4 pb-32 pt-5 @md:px-8"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          {preview ? (
            <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950">
              {dictionary.invitation.previewIndicator}
            </span>
          ) : (
            <span />
          )}
          <LanguageSelector locale={locale} dictionary={dictionary} onChange={setLocale} />
        </header>
        {!opened ? (
          <article
            className={`invitation-front invitation-reveal-${event.presentation.mode.toLowerCase()} mx-auto mt-8 max-w-2xl overflow-hidden rounded-[2rem] border border-amber-200/25 bg-slate-950/72 shadow-2xl backdrop-blur-xl`}
          >
            {event.presentation.thumbnailRef ? (
              <img
                src={event.presentation.thumbnailRef}
                alt={content.thumbnailAltText}
                className="aspect-[4/3] max-h-[26rem] w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/3] bg-[radial-gradient(circle_at_50%_30%,#155e75,#172554_48%,#020617)]" />
            )}
            <div className="p-6 text-center @md:p-10">
              <p className="text-sm font-bold tracking-[0.18em] text-amber-200">
                {dictionary.invitation.youAreInvited}
              </p>
              <h1 className="mt-3 text-4xl font-black text-balance @md:text-6xl">
                {content.celebrantName}
              </h1>
              {event.celebrantAge ? (
                <p className="mt-2 text-lg text-cyan-100">
                  {dictionary.event.age.replace('{age}', String(event.celebrantAge))}
                </p>
              ) : null}
              <p className="mt-6 text-lg text-slate-100">
                {dictionary.invitation.preparedFor.replace(
                  '{guestName}',
                  invitation.guestDisplayName,
                )}
              </p>
              {content.hostMessage ? (
                <div className="rich-text invitation-front-message mt-5 text-slate-300">
                  <RichText value={content.hostMessage} />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setOpened(true)}
                className="mx-auto mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-black text-slate-950 shadow-xl transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
              >
                <Sparkles aria-hidden size={19} />
                {dictionary.invitation.openInvitation}
              </button>
              {event.presentation.audioRef ? (
                <p className="mt-3 text-xs text-slate-400">
                  {dictionary.invitation.audioAfterOpen}
                </p>
              ) : null}
            </div>
          </article>
        ) : (
          <article className="invitation-back mx-auto mt-6 overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/76 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 @md:px-8">
              <div>
                <p className="text-xs font-bold tracking-widest text-amber-200">
                  {dictionary.event.birthday}
                </p>
                <h1 className="mt-1 text-2xl font-black @md:text-3xl">{content.title}</h1>
              </div>
              <button
                type="button"
                onClick={() => setOpened(false)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
              >
                <RotateCcw aria-hidden size={17} />
                {dictionary.invitation.viewFront}
              </button>
            </div>
            <div className="p-4 @md:p-8">
              <EventCountdown
                startsAt={event.startsAt}
                endsAt={event.endsAt}
                dictionary={dictionary}
              />
              <Collapsible title={dictionary.invitation.eventDetails} defaultOpen>
                <dl className="grid gap-x-8 gap-y-5 @md:grid-cols-2">
                  <Detail label={dictionary.event.date} value={dateTime} />
                  {endsAt ? <Detail label={dictionary.invitation.endTime} value={endsAt} /> : null}
                  <Detail
                    label={dictionary.event.venue}
                    value={content.venueName ?? dictionary.event.datePending}
                  />
                  {address ? (
                    <Detail label={dictionary.invitation.address} value={address} />
                  ) : null}
                  <Detail
                    label={dictionary.invitation.invitedParty}
                    value={partyLabel(invitation, dictionary)}
                  />
                </dl>
              </Collapsible>
              {invitation.tools.maps ? (
                <Collapsible title={dictionary.invitation.locationAndDirections}>
                  <MapActions maps={invitation.tools.maps} dictionary={dictionary} />
                </Collapsible>
              ) : null}
              {content.arrivalInstructions || content.parkingInstructions ? (
                <Collapsible title={dictionary.invitation.arrivalInformation}>
                  {content.arrivalInstructions ? (
                    <RichText value={content.arrivalInstructions} />
                  ) : null}
                  {content.parkingInstructions ? (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <h3 className="font-bold text-cyan-100">
                        {dictionary.invitation.parkingInstructions}
                      </h3>
                      <RichText value={content.parkingInstructions} />
                    </div>
                  ) : null}
                </Collapsible>
              ) : null}
              <Collapsible title={dictionary.invitation.calendarTitle}>
                <CalendarActions
                  calendar={calendar}
                  locale={locale}
                  dictionary={dictionary}
                  accessToken={accessToken}
                  preview={preview}
                />
              </Collapsible>
              {content.hostMessage ? (
                <Collapsible title={dictionary.invitation.hostMessageTitle}>
                  <RichText value={content.hostMessage} />
                </Collapsible>
              ) : null}
              <Collapsible title={dictionary.invitation.rsvpTitle} defaultOpen>
                <RsvpPanel
                  invitation={invitation}
                  dictionary={dictionary}
                  accessToken={accessToken}
                  preview={preview}
                />
              </Collapsible>
              <button
                type="button"
                onClick={() => setOpened(false)}
                className="mx-auto mt-8 flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold"
              >
                <RotateCcw aria-hidden size={17} /> {dictionary.invitation.viewFront}
              </button>
            </div>
          </article>
        )}
      </div>
    </ThemedInvitationStage>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="invitation-section mt-4 rounded-2xl border border-white/10 bg-white/[0.045]"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black text-cyan-50 @md:px-5">
        {title}
        <ChevronDown aria-hidden size={19} className="invitation-chevron shrink-0" />
      </summary>
      <div className="rich-text border-t border-white/10 px-4 py-5 text-slate-200 @md:px-5">
        {children}
      </div>
    </details>
  );
}

function RichText({ value }: { value: string }) {
  return <div dangerouslySetInnerHTML={{ __html: richTextToHtml(value) }} />;
}

function RsvpPanel({
  invitation,
  dictionary,
  accessToken,
  preview,
}: {
  invitation: PrivateInvitationData;
  dictionary: Dictionary;
  accessToken?: string;
  preview: boolean;
}) {
  const [response, setResponse] = useState<PublicRsvpResponse | null>(invitation.rsvp);
  const [editing, setEditing] = useState(!invitation.rsvp);
  const [status, setStatus] = useState<Exclude<RsvpStatus, 'CANCELLED'>>(
    invitation.rsvp?.status === 'ACCEPTED' ||
      invitation.rsvp?.status === 'DECLINED' ||
      invitation.rsvp?.status === 'NOT_SURE'
      ? invitation.rsvp.status
      : 'ACCEPTED',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (preview || !invitation.capabilities.canRespond) {
    return (
      <p className="mt-8 rounded-2xl bg-violet-500/15 p-4 text-center text-violet-100">
        {dictionary.invitation.rsvpPreviewDisabled}
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = (name: string) => {
      const value = String(data.get(name) ?? '').trim();
      return value ? Number(value) : null;
    };
    const payload = {
      status,
      totalAttending:
        status === 'ACCEPTED' && invitation.party.mode === 'TOTAL_ONLY'
          ? number('totalAttending')
          : null,
      adultsAttending:
        status === 'ACCEPTED' && invitation.party.mode === 'ADULTS_AND_CHILDREN'
          ? number('adultsAttending')
          : null,
      childrenAttending:
        status === 'ACCEPTED' && invitation.party.mode === 'ADULTS_AND_CHILDREN'
          ? number('childrenAttending')
          : null,
      dietaryNotes: String(data.get('dietaryNotes') ?? '').trim() || null,
      guestMessage: String(data.get('guestMessage') ?? '').trim() || null,
    };
    setSaving(true);
    setError(false);
    const result = await requestRsvp(response ? 'PATCH' : 'POST', payload, accessToken);
    setSaving(false);
    if (!result) {
      setError(true);
      return;
    }
    setResponse(result);
    setEditing(false);
    setConfirmed(true);
  }

  async function cancel() {
    if (!window.confirm(dictionary.invitation.rsvpCancelConfirm)) return;
    setSaving(true);
    setError(false);
    const result = await requestRsvp('DELETE', {}, accessToken);
    setSaving(false);
    if (!result) {
      setError(true);
      return;
    }
    setResponse(result);
    setConfirmed(true);
  }

  return (
    <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 @md:p-7">
      <h2 className="text-2xl font-black text-cyan-100">{dictionary.invitation.rsvpTitle}</h2>
      <p className="mt-2 text-sm text-slate-300">{dictionary.invitation.rsvpDescription}</p>
      {confirmed ? (
        <p role="status" className="mt-4 rounded-xl bg-emerald-500/15 p-3 text-emerald-100">
          {dictionary.invitation.rsvpSaved}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-100">
          {dictionary.invitation.rsvpError}
        </p>
      ) : null}
      {response && !editing ? (
        <div className="mt-5 rounded-2xl bg-white/5 p-4">
          <p className="font-bold text-violet-100">
            {dictionary.invitation.rsvpCurrent}: {statusLabel(response.status, dictionary)}
          </p>
          {response.status === 'ACCEPTED' ? (
            <p className="mt-2 text-sm text-slate-200">
              {dictionary.invitation.rsvpConfirmedPeople.replace(
                '{count}',
                String(response.totalAttending ?? 0),
              )}
            </p>
          ) : null}
          {response.dietaryNotes ? (
            <p className="mt-2 text-sm text-slate-200">
              <strong>{dictionary.invitation.rsvpDietaryNotesSummary}:</strong>{' '}
              {response.dietaryNotes}
            </p>
          ) : null}
          {response.guestMessage ? (
            <p className="mt-2 text-sm text-slate-200">
              <strong>{dictionary.invitation.rsvpGuestMessageSummary}:</strong>{' '}
              {response.guestMessage}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setConfirmed(false);
              }}
              className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold"
            >
              {dictionary.invitation.rsvpUpdate}
            </button>
            {response.status === 'ACCEPTED' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void cancel()}
                className="min-h-11 rounded-xl border border-red-300/40 px-4 py-2 font-bold text-red-100"
              >
                {dictionary.invitation.rsvpCancel}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <form className="mt-5 grid gap-4" onSubmit={submit}>
          <fieldset>
            <legend className="font-bold text-slate-100">
              {dictionary.invitation.rsvpQuestion}
            </legend>
            <div className="mt-3 grid gap-2 @md:grid-cols-3">
              {(['ACCEPTED', 'DECLINED', 'NOT_SURE'] as const).map((value) => (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 py-3 ${
                    status === value
                      ? 'border-cyan-300 bg-cyan-500/20'
                      : 'border-white/15 bg-white/5'
                  }`}
                >
                  <input
                    className="mr-3"
                    type="radio"
                    name="status"
                    value={value}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                  />
                  {statusLabel(value, dictionary)}
                </label>
              ))}
            </div>
          </fieldset>
          {status === 'ACCEPTED' ? (
            invitation.party.mode === 'TOTAL_ONLY' ? (
              <RsvpNumber
                name="totalAttending"
                label={dictionary.invitation.rsvpTotalAttending}
                max={invitation.party.totalInvited}
                defaultValue={response?.totalAttending ?? invitation.party.totalInvited}
              />
            ) : (
              <div className="grid gap-3 @md:grid-cols-2">
                <RsvpNumber
                  name="adultsAttending"
                  label={dictionary.invitation.rsvpAdultsAttending}
                  max={invitation.party.adultsInvited ?? 0}
                  defaultValue={response?.adultsAttending ?? invitation.party.adultsInvited ?? 0}
                />
                <RsvpNumber
                  name="childrenAttending"
                  label={dictionary.invitation.rsvpChildrenAttending}
                  max={invitation.party.childrenInvited ?? 0}
                  defaultValue={
                    response?.childrenAttending ?? invitation.party.childrenInvited ?? 0
                  }
                />
              </div>
            )
          ) : null}
          <label className="text-sm font-semibold text-slate-200">
            {dictionary.invitation.rsvpDietaryNotes}
            <textarea
              name="dietaryNotes"
              maxLength={500}
              defaultValue={response?.dietaryNotes ?? ''}
              className="mt-1 min-h-20 w-full rounded-xl border border-white/15 bg-slate-900 p-3"
            />
          </label>
          <label className="text-sm font-semibold text-slate-200">
            {dictionary.invitation.rsvpGuestMessage}
            <textarea
              name="guestMessage"
              maxLength={1000}
              defaultValue={response?.guestMessage ?? ''}
              className="mt-1 min-h-24 w-full rounded-xl border border-white/15 bg-slate-900 p-3"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-12 rounded-xl bg-violet-500 px-5 py-3 font-black disabled:opacity-60"
            >
              {saving ? dictionary.invitation.rsvpSaving : dictionary.invitation.rsvpSubmit}
            </button>
            {response ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-12 rounded-xl border border-white/20 px-5 py-3 font-bold"
              >
                {dictionary.invitation.rsvpKeepCurrent}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

function MapActions({
  maps,
  dictionary,
}: {
  maps: PrivateInvitationData['tools']['maps'] & object;
  dictionary: Dictionary;
}) {
  const [copied, setCopied] = useState(false);
  async function copyAddress() {
    if (!maps.formattedAddress) return;
    await navigator.clipboard.writeText(maps.formattedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <section aria-label={dictionary.invitation.address}>
      <div className="flex flex-wrap items-center gap-3">
        {maps.configuredMapsUrl ? (
          <ExternalAction
            href={maps.configuredMapsUrl}
            label={dictionary.invitation.directions}
            icon="map"
            primary
          />
        ) : maps.googleMapsUrl ? (
          <ExternalAction
            href={maps.googleMapsUrl}
            label={dictionary.invitation.directions}
            icon="map"
            primary
          />
        ) : maps.appleMapsUrl ? (
          <ExternalAction
            href={maps.appleMapsUrl}
            label={dictionary.invitation.directions}
            icon="map"
            primary
          />
        ) : null}
        {maps.googleMapsUrl || maps.appleMapsUrl ? (
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold">
              {dictionary.invitation.mapProviders} <ChevronDown aria-hidden size={16} />
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {maps.googleMapsUrl ? (
                <ExternalAction
                  href={maps.googleMapsUrl}
                  label={dictionary.invitation.googleMaps}
                />
              ) : null}
              {maps.appleMapsUrl ? (
                <ExternalAction href={maps.appleMapsUrl} label={dictionary.invitation.appleMaps} />
              ) : null}
            </div>
          </details>
        ) : null}
        {maps.formattedAddress ? (
          <button
            type="button"
            title={dictionary.invitation.copyAddress}
            aria-label={dictionary.invitation.copyAddress}
            onClick={() => void copyAddress()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3"
          >
            <Copy aria-hidden size={18} />
            <span className="sr-only">
              {copied ? dictionary.invitation.addressCopied : dictionary.invitation.copyAddress}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CalendarActions({
  calendar,
  locale,
  dictionary,
  accessToken,
  preview,
}: {
  calendar: CalendarEvent;
  locale: Locale;
  dictionary: Dictionary;
  accessToken?: string;
  preview: boolean;
}) {
  const [error, setError] = useState(false);
  async function download() {
    if (preview) return;
    setError(false);
    const response = await fetch(`/internal/calendar/ics?locale=${locale}`, {
      cache: 'no-store',
      headers: accessToken ? { 'x-invitation-token': accessToken } : {},
    });
    if (!response.ok) {
      setError(true);
      return;
    }
    const url = window.URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = calendar.filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
  return (
    <section>
      <div className="flex flex-wrap gap-3">
        <ExternalAction
          href={calendar.googleCalendarUrl}
          label={dictionary.invitation.googleCalendar}
          icon="calendar"
        />
        <ExternalAction
          href={calendar.outlookCalendarUrl}
          label={dictionary.invitation.outlookCalendar}
          icon="calendar"
        />
        <button
          type="button"
          disabled={preview}
          onClick={() => void download()}
          className="min-h-11 rounded-xl bg-violet-500 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dictionary.invitation.appleCalendar}
        </button>
        <button
          type="button"
          disabled={preview}
          onClick={() => void download()}
          className="min-h-11 rounded-xl border border-white/20 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dictionary.invitation.downloadCalendar}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {dictionary.invitation.calendarDownloadError}
        </p>
      ) : null}
    </section>
  );
}

function ExternalAction({
  href,
  label,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon?: 'map' | 'calendar';
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${primary ? 'bg-amber-300 text-slate-950' : 'bg-cyan-700 text-white'}`}
    >
      {icon === 'map' ? <MapPin aria-hidden size={18} /> : null}
      {icon === 'calendar' ? <CalendarPlus aria-hidden size={18} /> : null}
      {label}
    </a>
  );
}

function RsvpNumber({
  name,
  label,
  max,
  defaultValue,
}: {
  name: string;
  label: string;
  max: number;
  defaultValue: number;
}) {
  return (
    <label className="text-sm font-semibold text-slate-200">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={max}
        required
        defaultValue={defaultValue}
        className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-slate-900 px-3"
      />
    </label>
  );
}

async function requestRsvp(
  method: 'POST' | 'PATCH' | 'DELETE',
  body: object,
  accessToken?: string,
): Promise<PublicRsvpResponse | null> {
  const response = await fetch('/internal/rsvp', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-mmp-csrf': '1',
      ...(accessToken ? { 'x-invitation-token': accessToken } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as PublicRsvpResponse;
}

function statusLabel(status: RsvpStatus, dictionary: Dictionary) {
  return {
    ACCEPTED: dictionary.invitation.rsvpAccepted,
    DECLINED: dictionary.invitation.rsvpDeclined,
    NOT_SURE: dictionary.invitation.rsvpNotSure,
    CANCELLED: dictionary.invitation.rsvpCancelled,
  }[status];
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-cyan-200">{label}</dt>
      <dd className="mt-1 text-base text-slate-50">{value}</dd>
    </div>
  );
}

function partyLabel(
  invitation: PrivateInvitationData,
  dictionary: ReturnType<typeof getDictionary>,
) {
  return invitation.party.mode === 'ADULTS_AND_CHILDREN'
    ? dictionary.invitation.adultsAndChildren
        .replace('{adults}', String(invitation.party.adultsInvited ?? 0))
        .replace('{children}', String(invitation.party.childrenInvited ?? 0))
    : dictionary.invitation.peopleInvited.replace('{count}', String(invitation.party.totalInvited));
}

export function InvalidInvitation({ locale = 'en-US' }: { locale?: Locale }) {
  const dictionary = getDictionary(locale);
  return (
    <main
      lang={locale}
      className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white"
    >
      <section className="rounded-3xl border border-white/15 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">{dictionary.invitation.invalidTitle}</h1>
        <p className="mt-4 max-w-md text-slate-300">{dictionary.invitation.invalidMessage}</p>
      </section>
    </main>
  );
}
