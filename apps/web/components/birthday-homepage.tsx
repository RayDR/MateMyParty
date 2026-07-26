'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicEventPreview } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';
import { LanguageSelector } from './language-selector';

const INTRO_VIDEO = '/private-media/raymundo-6/dragons-intro.mp4';

export function BirthdayHomepage({
  event,
  locale,
  lookupFailed,
}: {
  event: PublicEventPreview;
  locale: Locale;
  lookupFailed: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const dictionary = getDictionary(locale);

  useEffect(() => {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    videoRef.current?.pause();
    setVideoUnavailable(true);
  }, []);

  const heading = dictionary.event.publicHeading
    .replace('{name}', event.celebrantName)
    .replace('{age}', String(event.celebrantAge ?? ''));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02070d] text-white">
      <div
        className="dragon-pulse fixed inset-0"
        aria-label={dictionary.invitation.fallbackExperience}
      >
        <div className="dragon-eye dragon-eye-left" />
        <div className="dragon-eye dragon-eye-right" />
      </div>
      <video
        ref={videoRef}
        aria-label={dictionary.event.backgroundVideo}
        className={`birthday-video fixed inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          videoUnavailable ? 'opacity-0' : 'opacity-70'
        }`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setVideoUnavailable(true)}
      >
        <source src={INTRO_VIDEO} type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-[linear-gradient(180deg,rgba(2,7,13,0.38),rgba(2,7,13,0.92))]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col p-5 sm:p-8">
        <div className="flex justify-end">
          <LanguageSelector locale={locale} dictionary={dictionary} />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-xl">
            <h1 className="mb-8 text-center text-4xl font-black drop-shadow-lg sm:text-6xl">
              {heading}
            </h1>
            <Card>
              <h2 className="text-2xl font-bold">{dictionary.event.lookupTitle}</h2>
              <p className="mt-3 text-slate-300">{dictionary.event.lookupDescription}</p>
              {lookupFailed ? (
                <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-100" role="alert">
                  {dictionary.event.lookupFailure}
                </p>
              ) : null}
              <form action="/lookup" method="post" className="mt-6 space-y-4">
                <input type="hidden" name="publicSlug" value={event.publicSlug} />
                <label className="block">
                  <span className="text-sm text-slate-200">{dictionary.event.lookupName}</span>
                  <input
                    name="displayName"
                    required
                    maxLength={160}
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-200">{dictionary.event.lookupContact}</span>
                  <input
                    name="contact"
                    required
                    maxLength={254}
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3"
                  />
                </label>
                <button className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400">
                  {dictionary.event.lookupSubmit}
                </button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
