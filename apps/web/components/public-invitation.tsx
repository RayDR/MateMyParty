'use client';

import { useState } from 'react';
import type { PrivateInvitation as PrivateInvitationData } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { LanguageSelector } from './language-selector';
import { ThemedInvitationStage } from './themed-invitation-stage';

export function PublicInvitation({
  invitation,
  initialLocale,
  preview = false,
  mediaDisabled = false,
  reducedMotion = false,
}: {
  invitation: PrivateInvitationData;
  initialLocale: Locale;
  preview?: boolean;
  mediaDisabled?: boolean;
  reducedMotion?: boolean;
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
            <p className="mt-8 rounded-2xl bg-violet-500/15 p-4 text-center text-violet-100">
              {dictionary.invitation.rsvpSoon}
            </p>
          </div>
        </article>
      </div>
    </ThemedInvitationStage>
  );
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
