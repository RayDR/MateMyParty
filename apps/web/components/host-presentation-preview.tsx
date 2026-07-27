'use client';

import { useState } from 'react';
import type { HostPresentationPreview as HostPresentationPreviewData } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { EventInvitation } from './event-invitation';
import { PublicInvitation } from './public-invitation';
import { usePersistentLocale } from '../lib/use-persistent-locale';

type Experience = 'public' | 'private';
type Viewport = 'mobile' | 'tablet' | 'desktop';

const viewportClasses: Record<Viewport, string> = {
  mobile: 'max-w-[390px]',
  tablet: 'max-w-[820px]',
  desktop: 'max-w-[1440px]',
};

export function HostPresentationPreview({
  preview,
  identifier,
}: {
  preview: HostPresentationPreviewData;
  identifier: string;
}) {
  const [locale, setLocale] = usePersistentLocale(preview.landing.defaultLocale);
  const [experience, setExperience] = useState<Experience>('public');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [mediaDisabled, setMediaDisabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dictionary = getDictionary(locale);
  const modeLabel = {
    NIGHT_DRAGON_FLIGHT: dictionary.invitation.modeNightDragonFlight,
    ADVENTURE_GATES: dictionary.invitation.modeAdventureGates,
    ENVELOPE_REVEAL: dictionary.invitation.modeEnvelopeReveal,
    WINTER_SNOW: dictionary.invitation.modeWinterSnow,
  }[preview.landing.presentation.mode];

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-white sm:p-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-3">
        <a
          href={`/host/events/${encodeURIComponent(identifier)}`}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold"
        >
          ← {dictionary.host.eventEditor}
        </a>
        <strong className="mr-auto text-sm text-amber-200">
          {dictionary.invitation.previewIndicator}
        </strong>
        <span className="text-xs text-slate-300">{modeLabel}</span>
        <select
          aria-label={dictionary.host.language}
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          className="rounded-xl bg-slate-800 px-3 py-2"
        >
          <option value="en-US">EN</option>
          <option value="es-MX">ES</option>
        </select>
      </header>
      <nav
        aria-label={dictionary.host.previewInvitation}
        className="mx-auto mb-4 flex max-w-7xl flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-900 p-3"
      >
        <Toggle
          active={experience === 'public'}
          onClick={() => setExperience('public')}
          label={dictionary.invitation.publicPreview}
        />
        <Toggle
          active={experience === 'private'}
          onClick={() => setExperience('private')}
          label={dictionary.invitation.privatePreview}
        />
        <span className="mx-1 hidden w-px bg-white/15 sm:block" />
        <Toggle
          active={viewport === 'mobile'}
          onClick={() => setViewport('mobile')}
          label={dictionary.invitation.mobileViewport}
        />
        <Toggle
          active={viewport === 'tablet'}
          onClick={() => setViewport('tablet')}
          label={dictionary.invitation.tabletViewport}
        />
        <Toggle
          active={viewport === 'desktop'}
          onClick={() => setViewport('desktop')}
          label={dictionary.invitation.desktopViewport}
        />
        <label className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-sm">
          <input
            type="checkbox"
            checked={mediaDisabled}
            onChange={(event) => setMediaDisabled(event.target.checked)}
          />
          {dictionary.invitation.mediaDisabled}
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-sm">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          {dictionary.invitation.reducedMotion}
        </label>
      </nav>
      <div
        data-testid="preview-viewport"
        data-viewport={viewport}
        className={`mx-auto overflow-hidden rounded-3xl border border-white/15 shadow-2xl ${viewportClasses[viewport]}`}
      >
        {experience === 'public' ? (
          <EventInvitation
            key={`public-${locale}`}
            event={preview.landing}
            initialLocale={locale}
            preview
            mediaDisabled={mediaDisabled}
            reducedMotion={reducedMotion}
          />
        ) : (
          <PublicInvitation
            key={`private-${locale}`}
            invitation={preview.invitation}
            initialLocale={locale}
            preview
            mediaDisabled={mediaDisabled}
            reducedMotion={reducedMotion}
          />
        )}
      </div>
    </main>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 rounded-xl px-3 text-sm font-bold ${active ? 'bg-violet-500' : 'bg-white/10'}`}
    >
      {label}
    </button>
  );
}
