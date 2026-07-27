'use client';

import { useState, type FormEvent } from 'react';
import type { PublicEventLanding } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { LanguageSelector } from './language-selector';
import { ThemedInvitationStage } from './themed-invitation-stage';

export function EventInvitation({
  event,
  initialLocale,
  preview = false,
  mediaDisabled = false,
  reducedMotion = false,
}: {
  event: PublicEventLanding;
  initialLocale: Locale;
  preview?: boolean;
  mediaDisabled?: boolean;
  reducedMotion?: boolean;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [method, setMethod] = useState<'EMAIL' | 'PHONE'>('EMAIL');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<'invalid' | 'rate' | null>(null);
  const dictionary = getDictionary(locale);
  const content = event.localizedContent[locale];

  async function lookup(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (preview) return;
    setPending(true);
    setFailure(null);
    const form = new FormData(submission.currentTarget);
    try {
      const response = await fetch('/internal/invitations/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventIdentifier: event.lookupIdentifier,
          displayName: String(form.get('displayName') ?? ''),
          method,
          contact: String(form.get('contact') ?? ''),
        }),
      });
      const result = (await response.json().catch(() => ({ verified: false }))) as {
        verified?: boolean;
        redirectTo?: string;
      };
      if (response.ok && result.verified && result.redirectTo === '/invitation') {
        window.location.assign(result.redirectTo);
        return;
      }
      setFailure(response.status === 429 ? 'rate' : 'invalid');
    } catch {
      setFailure('invalid');
    } finally {
      setPending(false);
    }
  }

  return (
    <ThemedInvitationStage
      presentation={event.presentation}
      dictionary={dictionary}
      mediaDisabled={mediaDisabled}
      forceReducedMotion={reducedMotion}
      containedControls={preview}
    >
      <div
        lang={locale}
        className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-5 @md:px-8"
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
        <div className="grid flex-1 items-center gap-8 py-8 @lg:grid-cols-[1.15fr_.85fr]">
          <section className="text-center @lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-200">
              {dictionary.common.platformName}
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[0.95] text-balance drop-shadow-2xl @md:text-7xl">
              {content.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-100/90 @lg:mx-0">
              {content.description}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-amber-100/90 @lg:mx-0">
              🔒 {dictionary.invitation.invitationRequired}
            </p>
          </section>
          <section className="rounded-[2rem] border border-white/15 bg-slate-950/65 p-5 shadow-2xl backdrop-blur-xl @md:p-7">
            <h2 className="text-2xl font-black">{dictionary.invitation.lookupTitle}</h2>
            <p className="mt-2 text-sm text-slate-300">{dictionary.invitation.lookupDescription}</p>
            <form onSubmit={lookup} className="mt-6 space-y-4">
              <Field
                name="displayName"
                label={dictionary.invitation.displayNameLabel}
                required
                disabled={preview}
              />
              <fieldset>
                <legend className="text-sm font-semibold">
                  {dictionary.invitation.lookupMethodLabel}
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Method
                    selected={method === 'EMAIL'}
                    onClick={() => setMethod('EMAIL')}
                    label={dictionary.invitation.emailMethod}
                  />
                  <Method
                    selected={method === 'PHONE'}
                    onClick={() => setMethod('PHONE')}
                    label={dictionary.invitation.phoneMethod}
                  />
                </div>
              </fieldset>
              <Field
                name="contact"
                type={method === 'EMAIL' ? 'email' : 'tel'}
                label={
                  method === 'EMAIL'
                    ? dictionary.invitation.contactEmailLabel
                    : dictionary.invitation.contactPhoneLabel
                }
                required
                disabled={preview}
              />
              {failure ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-300/20 bg-red-500/15 p-3 text-sm text-red-100"
                >
                  {failure === 'rate'
                    ? dictionary.invitation.lookupRateLimited
                    : dictionary.invitation.lookupFailure}
                </p>
              ) : null}
              <button
                disabled={pending || preview}
                className="min-h-12 w-full rounded-xl bg-violet-500 px-5 py-3 font-black shadow-lg hover:bg-violet-400 disabled:opacity-60"
              >
                {pending ? dictionary.invitation.verifying : dictionary.invitation.findInvitation}
              </button>
            </form>
          </section>
        </div>
      </div>
    </ThemedInvitationStage>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  disabled,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-900/85 px-4 py-3 text-base outline-none focus:border-cyan-300 disabled:opacity-60"
      />
    </label>
  );
}

function Method({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-xl px-3 text-sm font-bold ${selected ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'}`}
    >
      {label}
    </button>
  );
}
