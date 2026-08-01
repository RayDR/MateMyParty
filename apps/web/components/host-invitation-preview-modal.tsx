'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  EmailPreview,
  HostGuest,
  HostPresentationPreview,
  InvitationSharePreview,
  PrivateInvitation,
} from '@matemyparty/contracts';
import type { Dictionary } from '@matemyparty/i18n';
import { X } from 'lucide-react';
import { PublicInvitation } from './public-invitation';

export type HostPreviewTab = 'invitation' | 'message' | 'email';

export function HostInvitationPreviewModal({
  eventIdentifier,
  guest,
  sharePreview,
  publicUrl,
  dictionary,
  initialTab,
  linkCopied,
  onCopy,
  onClose,
}: {
  eventIdentifier: string;
  guest: HostGuest;
  sharePreview: InvitationSharePreview | null;
  publicUrl?: string;
  dictionary: Dictionary;
  initialTab: HostPreviewTab;
  linkCopied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<HostPreviewTab>(initialTab);
  const [mobile, setMobile] = useState(true);
  const [presentation, setPresentation] = useState<HostPresentationPreview | null>(null);
  const [presentationFailed, setPresentationFailed] = useState(false);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const emailRequested = useRef(false);
  const [emailFailed, setEmailFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(
      `/internal/host/events/${encodeURIComponent(
        eventIdentifier,
      )}/presentation-preview?locale=${encodeURIComponent(guest.locale)}`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setPresentation((await response.json()) as HostPresentationPreview);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setPresentationFailed(true);
        }
      });

    return () => controller.abort();
  }, [eventIdentifier, guest.locale]);

  useEffect(() => {
    if (tab !== 'email' || emailPreview || emailRequested.current) return;

    const controller = new AbortController();
    let completed = false;

    emailRequested.current = true;
    setEmailFailed(false);

    void fetch(
      `/internal/host/guests/${guest.id}/email/preview?locale=${encodeURIComponent(guest.locale)}`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();

        const result = (await response.json()) as EmailPreview;
        completed = true;
        setEmailPreview(result);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          emailRequested.current = false;
          setEmailFailed(true);
        }
      });

    return () => {
      controller.abort();
      if (!completed) emailRequested.current = false;
    };
  }, [emailPreview, guest.id, guest.locale, tab]);

  const invitation = useMemo<PrivateInvitation | null>(() => {
    if (!presentation) return null;

    return {
      ...presentation.invitation,
      guestDisplayName: guest.displayName,
      invitationLocale: guest.locale,
      openedPreviously: (guest.invitation?.openCount ?? 0) > 0,
      party: {
        mode: guest.invitationCountMode,
        totalInvited: guest.totalInvited,
        adultsInvited: guest.adultsInvited,
        childrenInvited: guest.childrenInvited,
      },
    };
  }, [guest, presentation]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={dictionary.host.invitationPreview}
        className="mx-auto flex h-[100dvh] min-w-0 max-w-6xl flex-col overflow-hidden border-white/15 bg-slate-900 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-3xl sm:border"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {dictionary.host.invitationPreview}
            </p>
            <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{guest.displayName}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={dictionary.host.closePreview}
            aria-label={dictionary.host.closePreview}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700"
          >
            <X aria-hidden size={20} />
          </button>
        </header>

        <div className="shrink-0 border-b border-white/10 p-2 sm:px-4">
          <div
            role="tablist"
            aria-label={dictionary.host.invitationPreview}
            className="flex min-w-0 gap-2 overflow-x-auto"
          >
            <PreviewTab
              active={tab === 'invitation'}
              label={dictionary.host.previewInvitation}
              onClick={() => setTab('invitation')}
            />
            <PreviewTab
              active={tab === 'message'}
              label={dictionary.host.socialPreview}
              onClick={() => setTab('message')}
            />
            <PreviewTab
              active={tab === 'email'}
              label={dictionary.host.emailPreview}
              onClick={() => setTab('email')}
            />
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
          {tab === 'invitation' ? (
            <InvitationPreview
              invitation={invitation}
              failed={presentationFailed}
              mobile={mobile}
              setMobile={setMobile}
              dictionary={dictionary}
            />
          ) : null}

          {tab === 'message' ? (
            <MessagePreview preview={sharePreview} publicUrl={publicUrl} dictionary={dictionary} />
          ) : null}

          {tab === 'email' ? (
            <EmailContent
              preview={emailPreview}
              failed={emailFailed}
              mobile={mobile}
              setMobile={setMobile}
              dictionary={dictionary}
            />
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-slate-950/60 p-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {publicUrl ? (
              <>
                <button
                  type="button"
                  onClick={onCopy}
                  className="min-h-11 shrink-0 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold hover:bg-cyan-500"
                >
                  {linkCopied ? dictionary.host.copied : dictionary.host.copyLink}
                </button>
                <p className="min-w-0 break-all text-xs text-slate-400">{publicUrl}</p>
              </>
            ) : (
              <p className="text-sm text-amber-200">
                {guest.invitation
                  ? dictionary.host.linkUnavailable
                  : dictionary.host.generateToCopy}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">{dictionary.host.linkSecurityNote}</p>
        </footer>
      </section>
    </div>
  );
}

function PreviewTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${
        active ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function ViewportToggle({
  mobile,
  setMobile,
  dictionary,
}: {
  mobile: boolean;
  setMobile: (mobile: boolean) => void;
  dictionary: Dictionary;
}) {
  return (
    <div className="mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => setMobile(!mobile)}
        className="min-h-10 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
      >
        {mobile ? dictionary.host.desktopPreview : dictionary.host.mobilePreview}
      </button>
    </div>
  );
}

function InvitationPreview({
  invitation,
  failed,
  mobile,
  setMobile,
  dictionary,
}: {
  invitation: PrivateInvitation | null;
  failed: boolean;
  mobile: boolean;
  setMobile: (mobile: boolean) => void;
  dictionary: Dictionary;
}) {
  return (
    <div className="min-w-0">
      <ViewportToggle mobile={mobile} setMobile={setMobile} dictionary={dictionary} />

      {failed ? (
        <PreviewError dictionary={dictionary} />
      ) : !invitation ? (
        <PreviewLoading dictionary={dictionary} />
      ) : (
        <div
          data-testid="unified-invitation-viewport"
          data-viewport={mobile ? 'mobile' : 'desktop'}
          className={`mx-auto min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 ${
            mobile ? 'max-w-[390px]' : 'max-w-5xl'
          }`}
        >
          <PublicInvitation
            invitation={invitation}
            initialLocale={invitation.invitationLocale}
            preview
          />
        </div>
      )}
    </div>
  );
}

function MessagePreview({
  preview,
  publicUrl,
  dictionary,
}: {
  preview: InvitationSharePreview | null;
  publicUrl?: string;
  dictionary: Dictionary;
}) {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const smsText = preview
    ? publicUrl
      ? preview.smsText.replace(/https?:\/\/[^\s]+\/i\/…|\/i\/…/, publicUrl)
      : preview.smsText
    : '';

  if (!preview) return <PreviewLoading dictionary={dictionary} />;

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-3xl bg-[#0b141a] shadow-xl">
          <p className="p-3 text-xs font-bold text-emerald-300">
            {dictionary.host.whatsAppPreview}
          </p>
          {preview.publicThumbnailRef ? (
            <img
              src={preview.publicThumbnailRef}
              alt={preview.thumbnailAltText}
              className="h-40 w-full object-cover"
            />
          ) : null}
          <div className="min-w-0 p-4">
            <h3 className="break-words font-bold [overflow-wrap:anywhere]">{preview.eventTitle}</h3>
            <p className="mt-2 break-words text-sm text-slate-300 [overflow-wrap:anywhere]">
              {preview.invitationText}
            </p>
            <p className="mt-3 break-all text-xs text-emerald-200">
              {preview.hostname ?? dictionary.host.notAvailable}
            </p>
            <p className="mt-3 text-[11px] text-slate-400">
              {dictionary.host.whatsAppApproximation}
            </p>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-xl">
          <p className="bg-slate-100 p-3 text-xs font-bold text-slate-600">
            {dictionary.host.socialPreview}
          </p>
          {preview.publicThumbnailRef ? (
            <img
              src={preview.publicThumbnailRef}
              alt={preview.thumbnailAltText}
              className="h-40 w-full object-cover"
            />
          ) : null}
          <div className="min-w-0 p-4">
            <h3 className="break-words font-bold [overflow-wrap:anywhere]">{preview.eventTitle}</h3>
            <p className="mt-2 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">
              {preview.invitationText}
            </p>
            <p className="mt-3 break-all text-xs uppercase text-slate-500">
              {preview.hostname ?? dictionary.host.notAvailable}
            </p>
          </div>
        </section>

        <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-950 p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
            {dictionary.host.smsPreview}
          </p>
          <p className="mt-3 break-words rounded-2xl bg-blue-500 p-4 text-sm text-white [overflow-wrap:anywhere] sm:ml-auto sm:max-w-md">
            {smsText}
          </p>
          <p className="mt-2 text-right text-xs text-slate-400">
            {dictionary.host.characterCount.replace('{count}', String(Array.from(smsText).length))}
          </p>
        </section>

        <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-950 p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            {dictionary.host.calendarPreview}
          </p>
          <h3 className="mt-3 break-words font-bold [overflow-wrap:anywhere]">
            {preview.calendar.title}
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            {new Intl.DateTimeFormat(preview.locale, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: preview.calendar.timezone,
            }).format(new Date(preview.calendar.startsAt))}
          </p>
          {preview.calendar.location ? (
            <p className="mt-1 break-words text-sm text-slate-400 [overflow-wrap:anywhere]">
              {preview.calendar.location}
            </p>
          ) : null}
        </section>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        {dictionary.host.smsUnavailable}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <TemplateCopyButton
          text={preview.invitationText}
          label={dictionary.host.copyInvitationText}
          copied={copiedTemplate === 'invitation'}
          onCopied={() => setCopiedTemplateTemporarily('invitation', setCopiedTemplate)}
        />
        <TemplateCopyButton
          text={smsText}
          label={dictionary.host.copySmsText}
          copied={copiedTemplate === 'sms'}
          onCopied={() => setCopiedTemplateTemporarily('sms', setCopiedTemplate)}
        />
        <TemplateCopyButton
          text={preview.calendar.googleCalendarUrl}
          label={dictionary.host.copyCalendarLink}
          copied={copiedTemplate === 'calendar'}
          onCopied={() => setCopiedTemplateTemporarily('calendar', setCopiedTemplate)}
        />
      </div>
    </div>
  );
}

function EmailContent({
  preview,
  failed,
  mobile,
  setMobile,
  dictionary,
}: {
  preview: EmailPreview | null;
  failed: boolean;
  mobile: boolean;
  setMobile: (mobile: boolean) => void;
  dictionary: Dictionary;
}) {
  return (
    <div className="min-w-0">
      <ViewportToggle mobile={mobile} setMobile={setMobile} dictionary={dictionary} />

      {failed ? (
        <PreviewError dictionary={dictionary} />
      ) : !preview ? (
        <PreviewLoading dictionary={dictionary} />
      ) : (
        <>
          <p className="mb-3 min-w-0 break-words rounded-xl bg-slate-950 p-3 text-sm [overflow-wrap:anywhere]">
            <strong>{dictionary.host.emailSubject}:</strong> {preview.subject}
          </p>

          <div className="min-w-0 overflow-x-auto rounded-2xl bg-slate-950 p-2 sm:p-3">
            <div
              className={`mx-auto min-w-0 transition-[max-width] ${
                mobile ? 'max-w-[390px]' : 'max-w-[680px]'
              }`}
            >
              <iframe
                title={dictionary.host.emailPreview}
                sandbox=""
                srcDoc={preview.html}
                className="h-[680px] w-full min-w-0 rounded-xl bg-white"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">{dictionary.host.previewUsesPlaceholder}</p>
        </>
      )}
    </div>
  );
}

function TemplateCopyButton({
  text,
  label,
  copied,
  onCopied,
}: {
  text: string;
  label: string;
  copied: boolean;
  onCopied: () => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      // Copy failures leave the preview available for manual selection.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="min-h-11 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold"
    >
      {copied ? '✓' : label}
    </button>
  );
}

function PreviewLoading({ dictionary }: { dictionary: Dictionary }) {
  return (
    <p className="rounded-2xl bg-slate-950/60 p-5 text-slate-300">
      {dictionary.host.loadingPreview}
    </p>
  );
}

function PreviewError({ dictionary }: { dictionary: Dictionary }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-500/15 p-5 text-red-100">
      {dictionary.host.actionError}
    </p>
  );
}

function setCopiedTemplateTemporarily(value: string, setValue: (value: string | null) => void) {
  setValue(value);
  window.setTimeout(() => setValue(null), 1800);
}
