'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type {
  CalendarEvent,
  PrivateInvitation as PrivateInvitationData,
  PublicRsvpResponse,
  RsvpStatus,
} from '@matemyparty/contracts';
import { richTextToHtml } from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  Download,
  HelpCircle,
  Mail,
  MailOpen,
  MapPin,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
import { LanguageSelector } from './language-selector';
import { ThemedInvitationStage, type InvitationMediaHandle } from './themed-invitation-stage';
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
  const [phase, setPhase] = useState<'closed' | 'summary' | 'full'>('closed');
  const [calendar, setCalendar] = useState<CalendarEvent>(invitation.tools.calendar);
  const media = useRef<InvitationMediaHandle>(null);
  const summary = useRef<HTMLElement>(null);
  const openingTracked = useRef(false);
  const dictionary = getDictionary(locale);
  const { event } = invitation;
  const content = event.localizedContent[locale];
  const fallbackContent = event.localizedContent[event.defaultLocale];
  const localized = (value: string | null, fallback: string | null) =>
    value?.trim() ? value : fallback?.trim() ? fallback : null;
  const venueName = localized(content.venueName, fallbackContent.venueName);
  const hostMessage = localized(content.hostMessage, fallbackContent.hostMessage);
  const arrivalInstructions = localized(
    content.arrivalInstructions,
    fallbackContent.arrivalInstructions,
  );
  const parkingInstructions = localized(
    content.parkingInstructions,
    fallbackContent.parkingInstructions,
  );
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
  useEffect(() => {
    if (phase !== 'summary') return;
    const frame = window.requestAnimationFrame(() => {
      const shouldReduce =
        reducedMotion ||
        (typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      summary.current?.scrollIntoView?.({
        behavior: shouldReduce ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, reducedMotion]);

  function revealInvitation() {
    if (!preview && !openingTracked.current) {
      openingTracked.current = true;

      void fetch('/internal/invitation/open', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'x-mmp-csrf': '1',
          ...(accessToken ? { 'x-invitation-token': accessToken } : {}),
        },
      }).catch(() => {
        /*
         * Tracking must never prevent the guest from opening the
         * invitation or unlocking its media.
         */
      });
    }

    void media.current?.unlockAudio();
    setPhase('summary');
  }

  return (
    <ThemedInvitationStage
      ref={media}
      presentation={event.presentation}
      dictionary={dictionary}
      privateExperience
      mediaDisabled={mediaDisabled}
      forceReducedMotion={reducedMotion}
      containedControls={preview}
      mediaUnlocked={phase !== 'closed'}
      controlsRaised={phase !== 'closed'}
    >
      <div
        lang={locale}
        data-invitation-side={phase === 'full' ? 'back' : 'front'}
        data-invitation-phase={phase}
        className={`mx-auto min-h-screen w-full min-w-0 max-w-5xl overflow-x-clip px-3 pt-4 @md:px-8 ${phase === 'closed' ? 'pb-8' : 'pb-32'}`}
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
        {phase !== 'full' ? (
          <article className="invitation-front invitation-closed-card group/front mx-auto mt-8 max-w-2xl overflow-hidden rounded-[2rem] border border-amber-200/25 bg-slate-950 shadow-2xl">
            <div
              className={`relative overflow-hidden transition-all duration-500 ${
                phase === 'closed' ? 'rounded-b-[2rem]' : ''
              }`}
            >
              <div className="aspect-[4/3] w-full">
                {event.presentation.thumbnailRef ? (
                  <img
                    src={event.presentation.thumbnailRef}
                    alt={content.thumbnailAltText}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full bg-[radial-gradient(circle_at_50%_30%,#155e75,#172554_48%,#020617)]" />
                )}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent px-5 text-center">
                <h1 className="text-4xl font-black text-balance drop-shadow-2xl @md:text-6xl">
                  {content.celebrantName}
                </h1>
                {event.celebrantAge ? (
                  <p className="mt-1 text-lg font-bold text-amber-100 drop-shadow-lg">
                    {dictionary.invitation.turningAge.replace('{age}', String(event.celebrantAge))}
                  </p>
                ) : null}
                {phase === 'closed' ? (
                  <div className="mt-5 flex flex-col items-center">
                    <button
                      type="button"
                      title={dictionary.invitation.openInvitation}
                      aria-label={dictionary.invitation.openInvitation}
                      onClick={revealInvitation}
                      className="invitation-envelope-button relative flex size-16 items-center justify-center rounded-full border border-amber-200/60 bg-slate-950/45 text-amber-200 shadow-xl backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
                    >
                      <Mail aria-hidden size={28} className="invitation-envelope-closed absolute" />
                      <MailOpen
                        aria-hidden
                        size={28}
                        className="invitation-envelope-open absolute"
                      />
                    </button>
                    <span className="mt-2 text-sm font-black text-amber-100 drop-shadow-lg">
                      {dictionary.invitation.openInvitation}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            {phase === 'summary' ? (
              <section
                ref={summary}
                aria-label={dictionary.invitation.youAreInvited}
                className="invitation-summary scroll-mt-4 border-t border-white/10 bg-slate-950/82 px-5 py-7 text-center backdrop-blur-xl @md:px-10 @md:py-9"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                  {dictionary.invitation.youAreInvited}
                </p>
                <h2 className="mt-3 text-2xl font-black text-white @md:text-3xl">
                  {invitation.guestDisplayName}
                </h2>
                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  {venueName ? <p className="font-bold">{venueName}</p> : null}
                  {address ? <p>{address}</p> : null}
                </div>
                <div className="mt-4 flex justify-center gap-3">
                  {invitation.tools.maps ? (
                    <MapActions maps={invitation.tools.maps} dictionary={dictionary} compact />
                  ) : null}
                  <CalendarActions
                    calendar={calendar}
                    locale={locale}
                    dictionary={dictionary}
                    accessToken={accessToken}
                    preview={preview}
                    compact
                  />
                </div>
                {hostMessage ? (
                  <RichText
                    value={hostMessage}
                    className="rich-text mx-auto mt-4 max-w-xl text-slate-200"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setPhase('full')}
                  className="mx-auto mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-black text-slate-950 shadow-xl hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
                >
                  <MailOpen aria-hidden size={19} />
                  {dictionary.invitation.eventDetails}
                </button>
              </section>
            ) : null}
          </article>
        ) : (
          <article
            className={`invitation-back invitation-opening-${event.presentation.mode.toLowerCase()} relative mx-auto mt-5 overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/80 shadow-2xl backdrop-blur-xl`}
          >
            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 @md:px-7">
              <div>
                <h1 className="text-xl font-black text-balance @md:text-3xl">{content.title}</h1>
              </div>
              <button
                type="button"
                title={dictionary.invitation.viewFront}
                aria-label={dictionary.invitation.viewFront}
                onClick={() => setPhase('summary')}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 hover:bg-white/10"
              >
                <RotateCcw aria-hidden size={17} />
              </button>
            </div>
            <div className="relative p-4 @md:p-8">
              <EventCountdown
                startsAt={event.startsAt}
                endsAt={event.endsAt}
                dictionary={dictionary}
                presentation="watermark"
              />
              {hostMessage ? (
                <Collapsible title={dictionary.invitation.hostMessageTitle} defaultOpen>
                  <RichText value={hostMessage} />
                </Collapsible>
              ) : null}
              <section
                aria-label={dictionary.invitation.eventDetails}
                className="invitation-essential relative z-10 rounded-3xl border border-white/10 bg-slate-950/62 p-4 @md:p-6"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <Detail label={dictionary.invitation.when} value={dateTime} />
                  <CalendarActions
                    calendar={calendar}
                    locale={locale}
                    dictionary={dictionary}
                    accessToken={accessToken}
                    preview={preview}
                  />
                </div>
                {endsAt ? (
                  <p className="mt-1 text-sm text-slate-300">
                    {dictionary.invitation.endTime}: {endsAt}
                  </p>
                ) : null}
                <div className="my-5 h-px bg-white/10" />
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                    {dictionary.invitation.where}
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {venueName ?? dictionary.event.datePending}
                  </p>
                  {invitation.tools.maps ? (
                    <EmbeddedMap
                      maps={invitation.tools.maps}
                      address={address}
                      dictionary={dictionary}
                    />
                  ) : address ? (
                    <p className="mx-auto mt-2 max-w-xl text-slate-200">{address}</p>
                  ) : null}
                </div>
                <div className="my-5 h-px bg-white/10" />
                <Detail
                  label={dictionary.invitation.invitedParty}
                  value={invitation.guestDisplayName}
                  supporting={partyLabel(invitation, dictionary)}
                />
              </section>
              {arrivalInstructions ? (
                <Collapsible title={dictionary.invitation.arrivalInstructions}>
                  <RichText value={arrivalInstructions} />
                </Collapsible>
              ) : null}
              {parkingInstructions ? (
                <Collapsible title={dictionary.invitation.parkingInstructions}>
                  <RichText value={parkingInstructions} />
                </Collapsible>
              ) : null}
            </div>
          </article>
        )}
        {phase !== 'closed' ? (
          <RsvpPanel
            invitation={invitation}
            dictionary={dictionary}
            accessToken={accessToken}
            preview={preview}
            useAbsolutePositioning={preview}
          />
        ) : null}
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

function RichText({ value, className }: { value: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: richTextToHtml(value) }} />;
}

function RsvpPanel({
  invitation,
  dictionary,
  accessToken,
  preview,
  useAbsolutePositioning = false,
}: {
  invitation: PrivateInvitationData;
  dictionary: Dictionary;
  accessToken?: string;
  preview: boolean;
  useAbsolutePositioning?: boolean;
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
  const [panelOpen, setPanelOpen] = useState(false);
  const responseEnabled = !preview && invitation.capabilities.canRespond;

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
    setPanelOpen(true);
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
    <>
      {panelOpen ? (
        <section
          role="dialog"
          aria-labelledby="rsvp-panel-title"
          className={`${useAbsolutePositioning ? 'absolute' : 'fixed'} invitation-rsvp-panel inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-h-[min(68dvh,42rem)] w-auto min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-3xl border border-cyan-300/20 bg-slate-950/96 p-5 shadow-2xl backdrop-blur-xl @md:p-7`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="rsvp-panel-title" className="text-xl font-black text-cyan-100">
                {dictionary.invitation.rsvpTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{dictionary.invitation.rsvpDescription}</p>
            </div>
            <button
              type="button"
              title={dictionary.invitation.closeRsvp}
              aria-label={dictionary.invitation.closeRsvp}
              onClick={() => setPanelOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15"
            >
              <X aria-hidden size={18} />
            </button>
          </div>
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
          ) : responseEnabled ? (
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
                      defaultValue={
                        response?.adultsAttending ?? invitation.party.adultsInvited ?? 0
                      }
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
          ) : (
            <p className="mt-4 rounded-2xl bg-violet-500/15 p-4 text-center text-violet-100">
              {dictionary.invitation.rsvpPreviewDisabled}
            </p>
          )}
        </section>
      ) : null}
      <footer
        aria-label={dictionary.invitation.rsvpTitle}
        className={`${useAbsolutePositioning ? 'absolute' : 'fixed'} invitation-rsvp-footer inset-x-0 bottom-0 z-40 w-full max-w-[100dvw] overflow-x-clip border-t border-white/15 bg-slate-950/96 px-2 pt-2 pb-[calc(.45rem+env(safe-area-inset-bottom))] shadow-[0_-0.5rem_1.5rem_rgb(2_6_23_/_24%)] backdrop-blur-xl`}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-3 items-stretch gap-1">
          <p className="col-span-3 hidden min-w-0 truncate px-2 text-center text-xs font-bold text-cyan-100 @sm:block">
            {response
              ? `${dictionary.invitation.rsvpCurrent}: ${statusLabel(response.status, dictionary)}`
              : dictionary.invitation.rsvpQuestion}
          </p>
          <RsvpQuickAction
            label={dictionary.invitation.rsvpYesShort}
            title={dictionary.invitation.rsvpAccepted}
            selected={(editing ? status : response?.status) === 'ACCEPTED'}
            disabled={!responseEnabled}
            icon={<Check aria-hidden size={18} />}
            onClick={() => {
              setStatus('ACCEPTED');
              setEditing(true);
              setConfirmed(false);
              setPanelOpen(true);
            }}
          />
          <RsvpQuickAction
            label={dictionary.invitation.rsvpNoShort}
            title={dictionary.invitation.rsvpDeclined}
            selected={(editing ? status : response?.status) === 'DECLINED'}
            disabled={!responseEnabled}
            icon={<X aria-hidden size={18} />}
            onClick={() => {
              setStatus('DECLINED');
              setEditing(true);
              setConfirmed(false);
              setPanelOpen(true);
            }}
          />
          <RsvpQuickAction
            label={dictionary.invitation.rsvpMaybeShort}
            title={dictionary.invitation.rsvpNotSure}
            selected={(editing ? status : response?.status) === 'NOT_SURE'}
            disabled={!responseEnabled}
            icon={<HelpCircle aria-hidden size={18} />}
            onClick={() => {
              setStatus('NOT_SURE');
              setEditing(true);
              setConfirmed(false);
              setPanelOpen(true);
            }}
          />
          {response ? (
            <button
              type="button"
              disabled={!responseEnabled}
              title={dictionary.invitation.rsvpUpdate}
              aria-label={dictionary.invitation.rsvpUpdate}
              onClick={() => {
                setEditing(false);
                setPanelOpen(true);
              }}
              className="col-span-3 mx-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 disabled:opacity-45"
            >
              <Pencil aria-hidden size={17} />
            </button>
          ) : null}
        </div>
        {preview ? (
          <span className="sr-only">{dictionary.invitation.rsvpPreviewDisabled}</span>
        ) : null}
      </footer>
    </>
  );
}

function RsvpQuickAction({
  label,
  title,
  selected,
  disabled,
  icon,
  onClick,
}: {
  label: string;
  title: string;
  selected: boolean;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-1.5 py-1 text-[11px] font-black leading-tight transition-colors ${selected ? 'bg-cyan-300 text-slate-950 shadow-inner' : 'bg-white/5 text-white hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function MapActions({
  maps,
  dictionary,
  compact = false,
}: {
  maps: PrivateInvitationData['tools']['maps'] & object;
  dictionary: Dictionary;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copyAddress() {
    if (!maps.formattedAddress) return;
    await navigator.clipboard.writeText(maps.formattedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  const primaryUrl = maps.configuredMapsUrl ?? maps.googleMapsUrl ?? maps.appleMapsUrl;

  if (compact) {
    if (!primaryUrl) return null;
    return (
      <a
        href={primaryUrl}
        target="_blank"
        rel="noreferrer"
        title={dictionary.invitation.directions}
        aria-label={dictionary.invitation.directions}
        className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10"
      >
        <MapPin aria-hidden size={19} />
      </a>
    );
  }

  return (
    <section aria-label={dictionary.invitation.address}>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
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
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-sm font-bold">
              <span className="sr-only">{dictionary.invitation.mapProviders}</span>
              <ChevronDown aria-hidden size={18} />
            </summary>
            <div className="absolute top-full right-0 z-50 mt-2 grid w-[min(17rem,calc(100dvw-2rem))] max-w-[calc(100dvw-2rem)] gap-2 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-3 text-left shadow-2xl">
              {maps.googleMapsUrl ? (
                <ExternalAction
                  href={maps.googleMapsUrl}
                  label={dictionary.invitation.googleMaps}
                />
              ) : null}
              {maps.appleMapsUrl ? (
                <ExternalAction href={maps.appleMapsUrl} label={dictionary.invitation.appleMaps} />
              ) : null}
              {maps.formattedAddress ? (
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold"
                >
                  <Copy aria-hidden size={18} />
                  {copied ? dictionary.invitation.addressCopied : dictionary.invitation.copyAddress}
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
        {!maps.googleMapsUrl && !maps.appleMapsUrl && maps.formattedAddress ? (
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
  compact = false,
  preview,
}: {
  calendar: CalendarEvent;
  locale: Locale;
  dictionary: Dictionary;
  accessToken?: string;
  compact?: boolean;
  preview: boolean;
}) {
  const [error, setError] = useState(false);
  async function download(event: MouseEvent<HTMLButtonElement>) {
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
    event.currentTarget.closest('details')?.removeAttribute('open');
    const url = window.URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = calendar.filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
  return (
    <details className="relative shrink-0">
      <summary
        title={dictionary.invitation.calendarTitle}
        aria-label={dictionary.invitation.calendarTitle}
        className={`flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10 ${compact ? '' : 'shrink-0'}`}
      >
        <CalendarPlus aria-hidden size={19} />
      </summary>
      <div
        className={`z-[60] grid w-[min(18rem,calc(100dvw-1.5rem))] max-w-[calc(100dvw-1.5rem)] gap-2 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-3 shadow-2xl ${
          preview
            ? 'absolute top-full right-0 mt-2'
            : 'fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] mx-auto'
        }`}
      >
        <ExternalAction
          href={calendar.googleCalendarUrl}
          label={dictionary.invitation.googleCalendar}
        />
        <ExternalAction
          href={calendar.outlookCalendarUrl}
          label={dictionary.invitation.outlookCalendar}
        />
        <button
          type="button"
          disabled={preview}
          onClick={(event) => void download(event)}
          className="inline-flex min-h-11 w-full min-w-0 items-center gap-2 whitespace-normal break-words rounded-xl bg-violet-500 px-4 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarPlus aria-hidden size={18} />
          {dictionary.invitation.appleCalendar}
        </button>
        <button
          type="button"
          disabled={preview}
          onClick={(event) => void download(event)}
          className="inline-flex min-h-11 w-full min-w-0 items-center gap-2 whitespace-normal break-words rounded-xl border border-white/20 px-4 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden size={18} />
          {dictionary.invitation.downloadCalendar}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="absolute top-full right-0 z-40 mt-2 w-64 rounded-xl bg-red-950 p-3 text-sm text-red-200"
        >
          {dictionary.invitation.calendarDownloadError}
        </p>
      ) : null}
    </details>
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
      className={`inline-flex min-h-11 w-full min-w-0 items-center gap-2 whitespace-normal break-words rounded-xl px-4 py-2 text-left text-sm font-bold ${primary ? 'bg-amber-300 text-slate-950 shadow-lg hover:bg-amber-200' : 'bg-cyan-700 text-white hover:bg-cyan-600'}`}
    >
      {icon === 'map' ? <MapPin aria-hidden size={18} /> : null}
      {icon === 'calendar' ? <CalendarPlus aria-hidden size={18} /> : null}
      {label}
    </a>
  );
}

function EmbeddedMap({
  maps,
  address,
  dictionary,
}: {
  maps: PrivateInvitationData['tools']['maps'] & object;
  address: string;
  dictionary: Dictionary;
}) {
  const mapAddress = maps.formattedAddress ?? address;
  const embedUrl = mapAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`
    : null;
  const primaryUrl = maps.configuredMapsUrl ?? maps.googleMapsUrl ?? maps.appleMapsUrl;

  if (!embedUrl && !primaryUrl) return null;

  return (
    <div className="mt-4">
      {embedUrl ? (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-slate-900">
          <iframe
            title={dictionary.invitation.address}
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[4/3] w-full border-0 @md:aspect-video"
          />
        </div>
      ) : null}
      <div className="mt-3 flex justify-center gap-2">
        {primaryUrl ? (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noreferrer"
            title={dictionary.invitation.directions}
            aria-label={dictionary.invitation.directions}
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10"
          >
            <MapPin aria-hidden size={19} />
          </a>
        ) : null}
        {maps.appleMapsUrl && maps.appleMapsUrl !== primaryUrl ? (
          <a
            href={maps.appleMapsUrl}
            target="_blank"
            rel="noreferrer"
            title={dictionary.invitation.appleMaps}
            aria-label={dictionary.invitation.appleMaps}
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10"
          >
            <MapPin aria-hidden size={19} />
          </a>
        ) : null}
      </div>
    </div>
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

function Detail({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-cyan-200">{label}</p>
      <p className="mt-1 text-base text-slate-50">{value}</p>
      {supporting ? <p className="mt-1 text-sm text-slate-300">{supporting}</p> : null}
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
