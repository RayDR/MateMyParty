'use client';

import { useState, type FormEvent } from 'react';
import type {
  PrivateInvitation as PrivateInvitationData,
  PublicRsvpResponse,
  RsvpStatus,
} from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { LanguageSelector } from './language-selector';
import { ThemedInvitationStage } from './themed-invitation-stage';

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
  return (
    <ThemedInvitationStage
      presentation={event.presentation}
      dictionary={dictionary}
      privateExperience
      mediaDisabled={mediaDisabled}
      forceReducedMotion={reducedMotion}
      containedControls={preview}
    >
      <div lang={locale} className="mx-auto min-h-screen max-w-5xl px-4 pb-32 pt-5 @md:px-8">
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
        <article className="mx-auto mt-8 overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/68 shadow-2xl backdrop-blur-xl">
          {event.presentation.thumbnailRef ? (
            <img
              src={event.presentation.thumbnailRef}
              alt={content.thumbnailAltText}
              className="max-h-72 w-full object-cover"
            />
          ) : null}
          <div className="p-5 @md:p-9">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-200">
                {dictionary.event.birthday}
              </p>
              <h1 className="mt-4 text-4xl font-black @md:text-6xl">{content.title}</h1>
              <p className="mt-3 text-xl text-violet-100">{content.celebrantName}</p>
              {event.celebrantAge ? (
                <p className="mt-1 text-slate-300">
                  {dictionary.event.age.replace('{age}', String(event.celebrantAge))}
                </p>
              ) : null}
              <p className="mt-6 rounded-2xl bg-cyan-400/10 p-4 text-lg text-cyan-50">
                {dictionary.invitation.preparedFor.replace(
                  '{guestName}',
                  invitation.guestDisplayName,
                )}
              </p>
            </div>
            <dl className="mt-8 grid gap-3 @md:grid-cols-2">
              <Detail label={dictionary.event.date} value={dateTime} />
              {endsAt ? <Detail label={dictionary.invitation.endTime} value={endsAt} /> : null}
              <Detail label={dictionary.event.timezone} value={event.timezone} />
              <Detail
                label={dictionary.event.venue}
                value={content.venueName ?? dictionary.event.datePending}
              />
              {address ? <Detail label={dictionary.invitation.address} value={address} /> : null}
              <Detail
                label={dictionary.invitation.invitedParty}
                value={partyLabel(invitation, dictionary)}
              />
            </dl>
            {event.mapsUrl ? (
              <a
                href={event.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 py-2 font-bold"
              >
                {dictionary.invitation.openMaps}
              </a>
            ) : null}
            {content.arrivalInstructions ? (
              <section className="mt-6 rounded-2xl bg-white/5 p-4">
                <h2 className="font-bold text-cyan-200">
                  {dictionary.invitation.arrivalInstructions}
                </h2>
                <p className="mt-2 text-slate-200">{content.arrivalInstructions}</p>
              </section>
            ) : null}
            {content.hostMessage ? (
              <p className="mt-7 text-center text-lg text-slate-100">{content.hostMessage}</p>
            ) : null}
            <RsvpPanel
              invitation={invitation}
              dictionary={dictionary}
              accessToken={accessToken}
              preview={preview}
            />
          </div>
        </article>
      </div>
    </ThemedInvitationStage>
  );
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
          <p className="mt-3 rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">
            {dictionary.invitation.rsvpCalendarPlaceholder}
          </p>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-cyan-200">{label}</dt>
      <dd className="mt-2 text-base text-slate-50">{value}</dd>
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
