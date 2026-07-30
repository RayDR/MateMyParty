'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  EventEmailStatistics,
  GuestInvitationStatistics,
  HostEventDetail,
  HostGuest,
  HostInvitationRsvpDetail,
  HostRsvpStatistics,
  InvitationSharePreview,
  InvitationSummary,
  SendInvitationEmailResult,
  SendTestEmailResult,
  RsvpStatus,
} from '@matemyparty/contracts';
import { getDictionary, type Dictionary, type Locale } from '@matemyparty/i18n';
import { usePersistentLocale } from '../lib/use-persistent-locale';
import { HostActionConfirmationDialog } from './host-action-confirmation-dialog';
import { HostInvitationPreviewModal, type HostPreviewTab } from './host-invitation-preview-modal';
import {
  Archive,
  Ban,
  ChevronDown,
  CirclePlus,
  Copy,
  Eye,
  Languages,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  X,
  type LucideIcon,
} from 'lucide-react';

type Filter =
  | 'all'
  | 'without'
  | 'notOpened'
  | 'opened'
  | 'cannotNotify'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'notSure'
  | 'cancelled'
  | 'dietaryNotes'
  | 'guestMessage'
  | 'archived';
type InvitationResult = {
  guest?: HostGuest;
  invitation: InvitationSummary;
  publicUrl?: string;
};

type ConfirmationKind = 'regenerate' | 'revoke' | 'archive';

type ConfirmationRequest = {
  kind: ConfirmationKind;
  guest: HostGuest;
  resendEmail: boolean;
};

const emptyStatistics: GuestInvitationStatistics = {
  totalGuests: 0,
  totalPeopleInvited: 0,
  generated: 0,
  notGenerated: 0,
  opened: 0,
  notOpened: 0,
  revoked: 0,
  notContactable: 0,
};
const emptyRsvpStatistics: HostRsvpStatistics = {
  pending: 0,
  accepted: 0,
  declined: 0,
  notSure: 0,
  cancelled: 0,
  confirmedTotal: 0,
  confirmedAdults: 0,
  confirmedChildren: 0,
  invitationsWithoutResponse: 0,
};
const emptyEmailStatistics: EventEmailStatistics = {
  eligibleGuests: 0,
  ineligibleGuests: 0,
  queued: 0,
  sending: 0,
  sent: 0,
  delivered: 0,
  failed: 0,
  cancelled: 0,
};

export function HostGuestPanel({ eventIdentifier }: { eventIdentifier: string }) {
  const [locale, setLocale] = usePersistentLocale('en-US');
  const [eventDetail, setEventDetail] = useState<HostEventDetail | null>(null);
  const [guests, setGuests] = useState<HostGuest[]>([]);
  const [statistics, setStatistics] = useState(emptyStatistics);
  const [rsvpStatistics, setRsvpStatistics] = useState(emptyRsvpStatistics);
  const [emailStatistics, setEmailStatistics] = useState(emptyEmailStatistics);
  const [emailBusy, setEmailBusy] = useState<string | null>(null);
  const [rsvpDetail, setRsvpDetail] = useState<HostInvitationRsvpDetail | null>(null);
  const [sharePreview, setSharePreview] = useState<InvitationSharePreview | null>(null);
  const [previewGuest, setPreviewGuest] = useState<HostGuest | null>(null);
  const [previewTab, setPreviewTab] = useState<HostPreviewTab>('message');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<HostGuest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [countMode, setCountMode] = useState<'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN'>('TOTAL_ONLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const dictionary = getDictionary(locale);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const identifier = encodeURIComponent(eventIdentifier);
      const [
        eventResponse,
        guestsResponse,
        statisticsResponse,
        rsvpStatisticsResponse,
        emailStatisticsResponse,
      ] = await Promise.all([
        fetch(`/internal/host/events/${identifier}`, { cache: 'no-store' }),
        fetch(`/internal/host/events/${identifier}/guests?includeArchived=true`, {
          cache: 'no-store',
        }),
        fetch(`/internal/host/events/${identifier}/guest-statistics`, { cache: 'no-store' }),
        fetch(`/internal/host/events/${identifier}/rsvp-statistics`, { cache: 'no-store' }),
        fetch(`/internal/host/events/${identifier}/email/statistics`, { cache: 'no-store' }),
      ]);
      if (
        !eventResponse.ok ||
        !guestsResponse.ok ||
        !statisticsResponse.ok ||
        !rsvpStatisticsResponse.ok ||
        !emailStatisticsResponse.ok
      )
        throw new Error();
      setEventDetail((await eventResponse.json()) as HostEventDetail);
      setGuests((await guestsResponse.json()) as HostGuest[]);
      setStatistics((await statisticsResponse.json()) as GuestInvitationStatistics);
      setRsvpStatistics((await rsvpStatisticsResponse.json()) as HostRsvpStatistics);
      setEmailStatistics((await emailStatisticsResponse.json()) as EventEmailStatistics);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [eventIdentifier]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    setSharePreview(null);
    void fetch(
      `/internal/host/events/${encodeURIComponent(eventIdentifier)}/share-preview?locale=${locale}`,
      { cache: 'no-store' },
    ).then(async (response) => {
      if (active && response.ok) setSharePreview((await response.json()) as InvitationSharePreview);
    });
    return () => {
      active = false;
    };
  }, [eventIdentifier, locale]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return guests.filter((guest) => {
      const matchesSearch =
        !query ||
        [guest.displayName, guest.contactName, guest.email, guest.phone, guest.privateNotes]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase(locale).includes(query));
      if (!matchesSearch) return false;
      if (filter === 'without')
        return !guest.archivedAt && (!guest.invitation || Boolean(guest.invitation.revokedAt));
      if (filter === 'notOpened')
        return (
          !guest.archivedAt &&
          Boolean(guest.invitation && !guest.invitation.revokedAt) &&
          guest.invitation!.openCount === 0
        );
      if (filter === 'opened')
        return (
          !guest.archivedAt &&
          !guest.invitation?.revokedAt &&
          (guest.invitation?.openCount ?? 0) > 0
        );
      if (filter === 'cannotNotify')
        return !guest.archivedAt && !guest.notificationEligibility.canNotifyAutomatically;
      if (filter === 'pending')
        return Boolean(guest.invitation && !guest.invitation.revokedAt && !guest.invitation.rsvp);
      if (filter === 'accepted') return guest.invitation?.rsvp?.status === 'ACCEPTED';
      if (filter === 'declined') return guest.invitation?.rsvp?.status === 'DECLINED';
      if (filter === 'notSure') return guest.invitation?.rsvp?.status === 'NOT_SURE';
      if (filter === 'cancelled') return guest.invitation?.rsvp?.status === 'CANCELLED';
      if (filter === 'dietaryNotes') return Boolean(guest.invitation?.rsvp?.hasDietaryNotes);
      if (filter === 'guestMessage') return Boolean(guest.invitation?.rsvp?.hasGuestMessage);
      if (filter === 'archived') return Boolean(guest.archivedAt);
      return !guest.archivedAt;
    });
  }, [filter, guests, locale, search]);

  function beginCreate() {
    setEditing(null);
    setCountMode('TOTAL_ONLY');
    setShowForm(true);
  }

  function beginEdit(guest: HostGuest) {
    setEditing(guest);
    setCountMode(guest.invitationCountMode);
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const count = (name: string) => (value(name) === '' ? null : Number(value(name)));
    const preferredChannel = value('preferredChannel');
    const invitationCountMode = value('invitationCountMode');
    const payload = {
      displayName: value('displayName'),
      contactName: value('contactName') || null,
      email: preferredChannel === 'MANUAL' ? null : value('email') || null,
      phone: preferredChannel === 'MANUAL' ? null : value('phone') || null,
      preferredChannel,
      locale: value('locale'),
      invitationCountMode,
      totalInvited: invitationCountMode === 'TOTAL_ONLY' ? count('totalInvited') : null,
      adultsInvited: invitationCountMode === 'ADULTS_AND_CHILDREN' ? count('adultsInvited') : null,
      childrenInvited:
        invitationCountMode === 'ADULTS_AND_CHILDREN' ? count('childrenInvited') : null,
      privateNotes: value('privateNotes') || null,
      ...(!editing ? { createInvitation: form.get('createInvitation') === 'on' } : {}),
    };
    const response = await fetch(
      editing
        ? `/internal/host/guests/${editing.id}`
        : `/internal/host/events/${encodeURIComponent(eventIdentifier)}/guests`,
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      setError(true);
      return;
    }
    const result = (await response.json()) as HostGuest | InvitationResult;
    if ('publicUrl' in result && result.publicUrl && result.guest) {
      setLinks((current) => ({ ...current, [result.guest!.id]: result.publicUrl! }));
    }
    setEditing(null);
    setShowForm(false);
    formElement.reset();
    await load();
  }

  async function post(path: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return null;
    const response = await fetch(path, { method: 'POST' });
    if (!response.ok) {
      setError(true);
      return null;
    }
    setError(false);
    return response.json() as Promise<unknown>;
  }

  function openPreview(guest: HostGuest, tab: HostPreviewTab, copyLinkAutomatically = false) {
    setPreviewTab(tab);
    setPreviewGuest(guest);

    if (copyLinkAutomatically && links[guest.id]) {
      void copy(guest.id);
    }
  }

  async function updateGuestLocale(guest: HostGuest, nextLocale: Locale) {
    if (guest.locale === nextLocale) return;

    setGuests((current) =>
      current.map((currentGuest) =>
        currentGuest.id === guest.id ? { ...currentGuest, locale: nextLocale } : currentGuest,
      ),
    );

    try {
      const response = await fetch(`/internal/host/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) throw new Error();

      setError(false);
      await load();
    } catch {
      setGuests((current) =>
        current.map((currentGuest) =>
          currentGuest.id === guest.id ? { ...currentGuest, locale: guest.locale } : currentGuest,
        ),
      );
      setError(true);
    }
  }

  async function sendEmail(
    guest: HostGuest,
    regenerateOverride?: boolean,
    openPreviewAfter = false,
  ): Promise<boolean> {
    const delivery = guest.emailDelivery;
    if (!delivery?.eligibility.eligible) return false;

    const regenerate = regenerateOverride ?? delivery.eligibility.requiresRegeneration;
    setEmailBusy(guest.id);

    try {
      const response = await fetch(`/internal/host/guests/${guest.id}/email/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mmp-csrf': '1' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          regenerate,
          overridePreferredChannel: false,
        }),
      });

      if (!response.ok) throw new Error();

      const result = (await response.json()) as SendInvitationEmailResult;

      if (result.publicUrl) {
        setLinks((current) => ({ ...current, [guest.id]: result.publicUrl! }));

        if (openPreviewAfter) {
          setPreviewTab('message');
          setPreviewGuest({ ...guest, invitation: result.invitation });
        }
      }

      const failed = result.attempt.status === 'FAILED';
      await load();
      setError(failed);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setEmailBusy(null);
    }
  }

  async function generate(guest: HostGuest) {
    const result = (await post(
      `/internal/host/guests/${guest.id}/invitations`,
    )) as InvitationResult | null;
    if (result?.publicUrl) {
      setLinks((current) => ({ ...current, [guest.id]: result.publicUrl! }));
      setPreviewTab('message');
      setPreviewGuest({ ...guest, invitation: result.invitation });
    }
    await load();
  }

  async function regenerate(guest: HostGuest): Promise<boolean> {
    if (!guest.invitation) return false;

    const result = (await post(
      `/internal/host/invitations/${guest.invitation.id}/regenerate`,
    )) as InvitationResult | null;

    if (!result) return false;

    if (result.publicUrl) {
      setLinks((current) => ({ ...current, [guest.id]: result.publicUrl! }));
      setPreviewTab('message');
      setPreviewGuest({ ...guest, invitation: result.invitation });
    }

    await load();
    return true;
  }

  async function mutateGuest(path: string, confirmationMessage?: string): Promise<boolean> {
    if (!(await post(path, confirmationMessage))) return false;
    await load();
    return true;
  }

  async function revoke(guest: HostGuest): Promise<boolean> {
    if (!guest.invitation) return false;

    if (!(await post(`/internal/host/invitations/${guest.invitation.id}/revoke`))) {
      return false;
    }

    setLinks((current) => {
      const next = { ...current };
      delete next[guest.id];
      return next;
    });

    await load();
    return true;
  }

  function requestConfirmation(kind: ConfirmationKind, guest: HostGuest) {
    setConfirmation({
      kind,
      guest,
      resendEmail: kind === 'regenerate' && Boolean(guest.emailDelivery?.eligibility.eligible),
    });
  }

  async function performConfirmedAction() {
    if (!confirmation) return;

    setConfirmationBusy(true);

    try {
      let completed = false;

      if (confirmation.kind === 'regenerate') {
        completed = confirmation.resendEmail
          ? await sendEmail(confirmation.guest, true, true)
          : await regenerate(confirmation.guest);
      } else if (confirmation.kind === 'revoke') {
        completed = await revoke(confirmation.guest);
      } else {
        completed = await mutateGuest(`/internal/host/guests/${confirmation.guest.id}/archive`);
      }

      if (completed) setConfirmation(null);
    } finally {
      setConfirmationBusy(false);
    }
  }

  async function copy(guestId: string) {
    const link = links[guestId];
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(guestId);
      setError(false);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError(true);
    }
  }

  async function showRsvp(guest: HostGuest) {
    if (!guest.invitation) return;
    const response = await fetch(`/internal/host/invitations/${guest.invitation.id}/rsvp`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      setError(true);
      return;
    }
    setRsvpDetail((await response.json()) as HostInvitationRsvpDetail);
  }

  const content = eventDetail?.localizedContent[locale];
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81_0,#0f172a_38%,#020617_78%)] p-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/85 shadow-2xl shadow-violet-950/30">
          <div className="flex flex-col sm:flex-row">
            {eventDetail?.thumbnailImageRef ? (
              <img
                src={eventDetail.thumbnailImageRef}
                alt={content?.thumbnailAltText ?? eventDetail.title}
                className="h-44 w-full object-cover sm:h-auto sm:w-56"
              />
            ) : (
              <div className="flex h-36 items-center justify-center bg-violet-500/15 text-5xl sm:h-auto sm:w-44">
                ✦
              </div>
            )}
            <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-7">
              <div>
                <a href="/host/events" className="text-sm font-semibold text-cyan-300">
                  ← {dictionary.host.backToEvents}
                </a>
                <h1 className="mt-3 text-3xl font-black sm:text-4xl">
                  {content?.title ?? eventDetail?.title ?? dictionary.host.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  {dictionary.host.guestsDescription}
                </p>
                {eventDetail ? (
                  <p className="mt-3 text-sm text-violet-200">
                    {dictionary.host.eventStarts}:{' '}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                      timeStyle: 'short',
                      timeZone: eventDetail.timezone,
                    }).format(new Date(eventDetail.startsAt))}
                    {eventDetail.primaryHostname ? ` · ${eventDetail.primaryHostname}` : ''}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/host/events/${encodeURIComponent(eventIdentifier)}/preview`}
                  className="rounded-xl bg-white/10 px-4 py-2.5 font-bold"
                >
                  {dictionary.host.previewInvitation}
                </a>
                <button
                  type="button"
                  onClick={showForm ? () => setShowForm(false) : beginCreate}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-bold"
                >
                  {!showForm ? <Plus aria-hidden size={18} /> : null}
                  {showForm ? dictionary.host.hideGuestForm : dictionary.host.showGuestForm}
                </button>
                <label className="ml-auto text-sm text-slate-300">
                  {dictionary.host.language}
                  <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value as Locale)}
                    className="ml-2 rounded-xl border border-white/10 bg-slate-800 p-2 text-white"
                  >
                    <option value="en-US">{dictionary.common.english}</option>
                    <option value="es-MX">{dictionary.common.spanish}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/15 p-4 text-red-100"
          >
            {dictionary.host.actionError}
          </div>
        ) : null}

        <section
          aria-label={dictionary.host.guestSummary}
          className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 text-sm"
        >
          <strong>
            {statistics.totalGuests} {dictionary.host.totalGuestsStat.toLocaleLowerCase()}
          </strong>
          <span>
            {statistics.totalPeopleInvited} {dictionary.host.totalPeopleStat.toLocaleLowerCase()}
          </span>
          <span>
            {rsvpStatistics.confirmedTotal}{' '}
            {dictionary.host.rsvpConfirmedTotalStat.toLocaleLowerCase()}
          </span>
          <details className="basis-full border-t border-white/10 pt-3">
            <summary className="cursor-pointer font-bold text-cyan-200">
              {dictionary.host.showDetailedStatistics}
            </summary>
            <div className="mt-4">
              <StatisticsGrid statistics={statistics} dictionary={dictionary} />
              <RsvpStatisticsGrid statistics={rsvpStatistics} dictionary={dictionary} />
              <EmailDeliveryPanel
                statistics={emailStatistics}
                eventIdentifier={eventIdentifier}
                locale={locale}
                dictionary={dictionary}
              />
            </div>
          </details>
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="sr-only" htmlFor="guest-search">
              {dictionary.host.search}
            </label>
            <input
              id="guest-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={dictionary.host.search}
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none focus:border-cyan-400"
            />
            <select
              aria-label={dictionary.host.filter}
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3"
            >
              <option value="all">{dictionary.host.filterAll}</option>
              <option value="without">{dictionary.host.filterWithoutInvitation}</option>
              <option value="notOpened">{dictionary.host.filterNotOpened}</option>
              <option value="opened">{dictionary.host.filterOpened}</option>
              <option value="cannotNotify">{dictionary.host.filterCannotNotify}</option>
              <option value="pending">{dictionary.host.filterRsvpPending}</option>
              <option value="accepted">{dictionary.host.filterRsvpAccepted}</option>
              <option value="declined">{dictionary.host.filterRsvpDeclined}</option>
              <option value="notSure">{dictionary.host.filterRsvpNotSure}</option>
              <option value="cancelled">{dictionary.host.filterRsvpCancelled}</option>
              <option value="dietaryNotes">{dictionary.host.filterDietaryNotes}</option>
              <option value="guestMessage">{dictionary.host.filterGuestMessage}</option>
              <option value="archived">{dictionary.host.filterArchived}</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['all', dictionary.host.filterAll],
                ['without', dictionary.host.filterWithoutInvitation],
                ['notOpened', dictionary.host.filterNotOpened],
                ['pending', dictionary.host.filterRsvpPending],
                ['accepted', dictionary.host.filterRsvpAccepted],
                ['cannotNotify', dictionary.host.filterCannotNotify],
                ['archived', dictionary.host.filterArchived],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  filter === value
                    ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-slate-950/60 text-slate-300 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">{dictionary.host.archivedGuestsHidden}</p>
        </section>

        {loading ? (
          <LoadingState label={dictionary.host.loading} />
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-slate-900/60 p-12 text-center text-slate-300">
            <p className="text-4xl">✦</p>
            <p className="mt-3">{dictionary.host.noGuests}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:hidden">
              {filtered.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  dictionary={dictionary}
                  locale={locale}
                  hasLink={Boolean(links[guest.id])}
                  copied={copied === guest.id}
                  onEdit={() => beginEdit(guest)}
                  onGenerate={() => void generate(guest)}
                  onCopy={() => void copy(guest.id)}
                  onPreview={() => openPreview(guest, 'invitation')}
                  onSocialPreview={() => openPreview(guest, 'message', true)}
                  onRsvp={() => void showRsvp(guest)}
                  onRegenerate={() => requestConfirmation('regenerate', guest)}
                  onRevoke={() => requestConfirmation('revoke', guest)}
                  onArchive={() => requestConfirmation('archive', guest)}
                  onRestore={() =>
                    void mutateGuest(
                      `/internal/host/guests/${guest.id}/restore`,
                      dictionary.host.confirmRestore,
                    )
                  }
                  onEmailPreview={() => openPreview(guest, 'email')}
                  onLocaleChange={(nextLocale) => updateGuestLocale(guest, nextLocale)}
                  onEmailSend={() => void sendEmail(guest)}
                  emailBusy={emailBusy === guest.id}
                />
              ))}
            </div>
            <GuestTable
              guests={filtered}
              dictionary={dictionary}
              locale={locale}
              links={links}
              copied={copied}
              onEdit={beginEdit}
              onGenerate={(guest) => void generate(guest)}
              onCopy={(guest) => void copy(guest.id)}
              onPreview={(guest) => openPreview(guest, 'invitation')}
              onSocialPreview={(guest) => openPreview(guest, 'message', true)}
              onRsvp={(guest) => void showRsvp(guest)}
              onRegenerate={(guest) => requestConfirmation('regenerate', guest)}
              onRevoke={(guest) => requestConfirmation('revoke', guest)}
              onArchive={(guest) => requestConfirmation('archive', guest)}
              onRestore={(guest) =>
                void mutateGuest(
                  `/internal/host/guests/${guest.id}/restore`,
                  dictionary.host.confirmRestore,
                )
              }
              onEmailPreview={(guest) => openPreview(guest, 'email')}
              onLocaleChange={(guest, nextLocale) => updateGuestLocale(guest, nextLocale)}
              onEmailSend={(guest) => void sendEmail(guest)}
              emailBusy={emailBusy}
            />
          </>
        )}
      </div>
      {previewGuest ? (
        <HostInvitationPreviewModal
          eventIdentifier={eventIdentifier}
          guest={previewGuest}
          sharePreview={sharePreview}
          publicUrl={links[previewGuest.id]}
          dictionary={dictionary}
          initialTab={previewTab}
          linkCopied={copied === previewGuest.id}
          onCopy={() => void copy(previewGuest.id)}
          onClose={() => setPreviewGuest(null)}
        />
      ) : null}
      {confirmation ? (
        <HostActionConfirmationDialog
          title={
            confirmation.kind === 'regenerate'
              ? dictionary.host.regenerateTitle
              : confirmation.kind === 'revoke'
                ? dictionary.host.revokeTitle
                : dictionary.host.archiveTitle
          }
          description={
            confirmation.kind === 'regenerate'
              ? dictionary.host.regenerateDescription
              : confirmation.kind === 'revoke'
                ? dictionary.host.revokeDescription
                : dictionary.host.archiveDescription
          }
          confirmLabel={
            confirmation.kind === 'regenerate'
              ? dictionary.host.regenerate
              : confirmation.kind === 'revoke'
                ? dictionary.host.revoke
                : dictionary.host.archive
          }
          cancelLabel={dictionary.host.cancel}
          closeLabel={dictionary.host.closeDialog}
          variant={confirmation.kind === 'revoke' ? 'danger' : 'warning'}
          busy={confirmationBusy}
          checkbox={
            confirmation.kind === 'regenerate'
              ? {
                  label: dictionary.host.resendInvitationEmail,
                  checked: confirmation.resendEmail,
                  disabled: !confirmation.guest.emailDelivery?.eligibility.eligible,
                  helpText: !confirmation.guest.emailDelivery?.eligibility.eligible
                    ? dictionary.host.resendEmailUnavailable
                    : undefined,
                  onChange: (checked: boolean) =>
                    setConfirmation((current) =>
                      current ? { ...current, resendEmail: checked } : current,
                    ),
                }
              : undefined
          }
          onConfirm={() => void performConfirmedAction()}
          onCancel={() => {
            if (!confirmationBusy) setConfirmation(null);
          }}
        />
      ) : null}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={editing ? dictionary.host.save : dictionary.host.showGuestForm}
            className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(false);
              }}
              aria-label={dictionary.host.closeDialog}
              className="absolute right-4 top-4 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-950/85"
            >
              <X aria-hidden size={20} />
            </button>
            <GuestForm
              key={editing?.id ?? 'new'}
              dictionary={dictionary}
              locale={locale}
              editing={editing}
              countMode={countMode}
              setCountMode={setCountMode}
              submit={submit}
              cancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
            />
          </section>
        </div>
      ) : null}
      {rsvpDetail ? (
        <RsvpDetailModal
          detail={rsvpDetail}
          dictionary={dictionary}
          locale={locale}
          onClose={() => setRsvpDetail(null)}
        />
      ) : null}
    </main>
  );
}

function GuestForm({
  dictionary,
  locale,
  editing,
  countMode,
  setCountMode,
  submit,
  cancel,
}: {
  dictionary: Dictionary;
  locale: Locale;
  editing: HostGuest | null;
  countMode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN';
  setCountMode: (mode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN') => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  cancel: () => void;
}) {
  return (
    <div className="mb-6 rounded-3xl border border-violet-400/20 bg-slate-900/95 p-6 shadow-2xl">
      <form onSubmit={submit} className="grid gap-5">
        <fieldset className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-3 text-lg font-bold text-violet-200">
            {dictionary.host.guestDetails}
          </legend>
          <Field
            name="displayName"
            label={dictionary.host.displayName}
            required
            defaultValue={editing?.displayName}
          />
          <Field
            name="contactName"
            label={dictionary.host.contactName}
            defaultValue={editing?.contactName}
          />
          <Select
            name="locale"
            label={dictionary.host.locale}
            defaultValue={editing?.locale ?? locale}
            options={[
              ['en-US', dictionary.common.english],
              ['es-MX', dictionary.common.spanish],
            ]}
          />
        </fieldset>
        <fieldset className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-3 text-lg font-bold text-violet-200">
            {dictionary.host.invitationDetails}
          </legend>
          <label className="text-sm">
            {dictionary.host.countMode}
            <select
              name="invitationCountMode"
              value={countMode}
              onChange={(event) =>
                setCountMode(event.target.value as 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN')
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 p-3"
            >
              <option value="TOTAL_ONLY">{dictionary.host.totalOnly}</option>
              <option value="ADULTS_AND_CHILDREN">{dictionary.host.adultsAndChildren}</option>
            </select>
          </label>
          {countMode === 'TOTAL_ONLY' ? (
            <Field
              name="totalInvited"
              label={dictionary.host.totalInvited}
              type="number"
              required
              defaultValue={editing?.totalInvited ?? 0}
            />
          ) : (
            <>
              <Field
                name="adultsInvited"
                label={dictionary.host.adultsInvited}
                type="number"
                required
                defaultValue={editing?.adultsInvited ?? 0}
              />
              <Field
                name="childrenInvited"
                label={dictionary.host.childrenInvited}
                type="number"
                required
                defaultValue={editing?.childrenInvited ?? 0}
              />
            </>
          )}
          <Field
            name="privateNotes"
            label={dictionary.host.privateNotes}
            defaultValue={editing?.privateNotes}
          />
        </fieldset>
        <fieldset className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-3 text-lg font-bold text-violet-200">
            {dictionary.host.contactDetails}
          </legend>
          <Field
            name="email"
            label={dictionary.host.email}
            type="email"
            defaultValue={editing?.email}
          />
          <Field
            name="phone"
            label={dictionary.host.phone}
            type="tel"
            defaultValue={editing?.phone}
          />
          <Select
            name="preferredChannel"
            label={dictionary.host.preferredChannel}
            defaultValue={editing?.preferredChannel ?? 'MANUAL'}
            options={[
              ['MANUAL', dictionary.host.manual],
              ['EMAIL', dictionary.host.email],
              ['SMS', dictionary.host.sms],
              ['BOTH', dictionary.host.both],
            ]}
          />
        </fieldset>
        {!editing ? (
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" name="createInvitation" className="size-4 accent-violet-500" />
            {dictionary.host.includeInvitation}
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-violet-500 px-5 py-3 font-bold">
            {editing ? dictionary.host.save : dictionary.host.createGuest}
          </button>
          <button type="button" onClick={cancel} className="rounded-xl bg-slate-700 px-5 py-3">
            {dictionary.host.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatisticsGrid({
  statistics,
  dictionary,
}: {
  statistics: GuestInvitationStatistics;
  dictionary: Dictionary;
}) {
  const values = [
    [dictionary.host.totalGuestsStat, statistics.totalGuests],
    [dictionary.host.totalPeopleStat, statistics.totalPeopleInvited],
    [dictionary.host.generatedStat, statistics.generated],
    [dictionary.host.notGeneratedStat, statistics.notGenerated],
    [dictionary.host.openedStat, statistics.opened],
    [dictionary.host.notOpenedStat, statistics.notOpened],
    [dictionary.host.revokedStat, statistics.revoked],
    [dictionary.host.notContactableStat, statistics.notContactable],
  ] as const;
  return (
    <section
      aria-label={dictionary.host.status}
      className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8"
    >
      {values.map(([label, value], index) => (
        <div
          key={label}
          className={`rounded-2xl border p-4 ${index === 7 && value > 0 ? 'border-red-400/30 bg-red-500/10' : 'border-white/10 bg-slate-900/75'}`}
        >
          <p className="text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs text-slate-300">{label}</p>
        </div>
      ))}
    </section>
  );
}

function RsvpStatisticsGrid({
  statistics,
  dictionary,
}: {
  statistics: HostRsvpStatistics;
  dictionary: Dictionary;
}) {
  const values = [
    [dictionary.host.rsvpPendingStat, statistics.pending],
    [dictionary.host.rsvpAcceptedStat, statistics.accepted],
    [dictionary.host.rsvpDeclinedStat, statistics.declined],
    [dictionary.host.rsvpNotSureStat, statistics.notSure],
    [dictionary.host.rsvpCancelledStat, statistics.cancelled],
    [dictionary.host.rsvpConfirmedTotalStat, statistics.confirmedTotal],
    [dictionary.host.rsvpConfirmedAdultsStat, statistics.confirmedAdults],
    [dictionary.host.rsvpConfirmedChildrenStat, statistics.confirmedChildren],
  ] as const;
  return (
    <section
      aria-label={dictionary.host.rsvpSummary}
      className="mb-5 rounded-3xl border border-cyan-300/15 bg-cyan-950/30 p-4"
    >
      <h2 className="mb-3 text-lg font-black text-cyan-100">{dictionary.host.rsvpSummary}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-950/55 p-3">
            <p className="text-2xl font-black">{value}</p>
            <p className="mt-1 text-xs text-slate-300">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmailDeliveryPanel({
  statistics,
  eventIdentifier,
  locale,
  dictionary,
}: {
  statistics: EventEmailStatistics;
  eventIdentifier: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [result, setResult] = useState<SendTestEmailResult | null>(null);
  const [busy, setBusy] = useState(false);
  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/internal/host/events/${encodeURIComponent(eventIdentifier)}/email/test`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mmp-csrf': '1' },
          body: JSON.stringify({ email: String(form.get('testEmail') ?? ''), locale }),
        },
      );
      const body = (await response.json()) as SendTestEmailResult;
      setResult(
        response.ok
          ? body
          : {
              accepted: false,
              providerStatus: 'REJECTED',
              safeErrorCode: null,
              safeErrorMessage: dictionary.host.testEmailFailed,
            },
      );
    } catch {
      setResult({
        accepted: false,
        providerStatus: 'FAILED',
        safeErrorCode: null,
        safeErrorMessage: dictionary.host.testEmailFailed,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-5 rounded-3xl border border-violet-300/15 bg-violet-950/25 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-violet-100">{dictionary.host.emailDelivery}</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <EmailCount label={dictionary.host.emailEligible} value={statistics.eligibleGuests} />
            <EmailCount label={dictionary.host.emailSent} value={statistics.sent} />
            <EmailCount label={dictionary.host.emailDelivered} value={statistics.delivered} />
            <EmailCount label={dictionary.host.emailFailed} value={statistics.failed} />
          </div>
        </div>
        <form onSubmit={sendTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs text-slate-300">
            {dictionary.host.testEmailDestination}
            <input
              name="testEmail"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <button
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2 font-bold disabled:opacity-60"
          >
            {busy ? dictionary.host.sendingEmail : dictionary.host.sendTestEmail}
          </button>
        </form>
      </div>
      {result ? (
        <p className={`mt-3 text-sm ${result.accepted ? 'text-emerald-200' : 'text-red-200'}`}>
          {result.accepted
            ? dictionary.host.testEmailAccepted
            : (result.safeErrorMessage ?? dictionary.host.testEmailFailed)}
        </p>
      ) : null}
    </section>
  );
}

function EmailCount({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-slate-950/60 px-3 py-1">
      {label}: {value}
    </span>
  );
}

type GuestActionProps = {
  guest: HostGuest;
  dictionary: Dictionary;
  hasLink: boolean;
  copied: boolean;
  onEdit: () => void;
  onGenerate: () => void;
  onCopy: () => void;
  onPreview: () => void;
  onSocialPreview: () => void;
  onRsvp: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onEmailPreview: () => void;
  onLocaleChange: (locale: Locale) => Promise<void>;
  onEmailSend: () => void;
  emailBusy: boolean;
};

function GuestActions(props: GuestActionProps) {
  const { guest, dictionary } = props;

  if (guest.archivedAt) {
    return (
      <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/40 p-1">
        <IconAction icon={RotateCcw} onClick={props.onRestore} label={dictionary.host.restore} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
        <IconAction icon={Pencil} onClick={props.onEdit} label={dictionary.host.edit} />
        <PreviewSplitButton
          dictionary={dictionary}
          onInvitation={props.onPreview}
          onEmail={props.onEmailPreview}
          onSocial={props.onSocialPreview}
        />
      </div>

      {guest.invitation ? (
        <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/40 p-1">
          <IconAction
            icon={MessageSquare}
            onClick={props.onRsvp}
            label={dictionary.host.rsvpDetails}
          />
        </div>
      ) : null}

      <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/40 p-1">
        <MoreActionsMenu {...props} />
      </div>
    </div>
  );
}

function PreviewSplitButton({
  dictionary,
  onInvitation,
  onEmail,
  onSocial,
}: {
  dictionary: Dictionary;
  onInvitation: () => void;
  onEmail: () => void;
  onSocial: () => void;
}) {
  const [open, setOpen] = useState(false);

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div
      className="relative inline-flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        title={dictionary.host.previewInvitation}
        aria-label={dictionary.host.preview}
        onClick={(event) => {
          event.stopPropagation();
          onInvitation();
        }}
        className="flex size-10 items-center justify-center rounded-l-xl bg-slate-700 text-slate-100 transition hover:bg-slate-600"
      >
        <Eye aria-hidden size={18} />
      </button>

      <button
        type="button"
        title={dictionary.host.previewOptions}
        aria-label={dictionary.host.previewOptions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-10 w-7 items-center justify-center rounded-r-xl border-l border-white/10 bg-slate-700 text-slate-200 transition hover:bg-slate-600"
      >
        <ChevronDown aria-hidden size={15} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-1.5 shadow-2xl"
        >
          <MenuAction
            icon={Eye}
            label={dictionary.host.previewInvitation}
            onClick={() => select(onInvitation)}
          />
          <MenuAction
            icon={Mail}
            label={dictionary.host.emailPreview}
            onClick={() => select(onEmail)}
          />
          <MenuAction
            icon={Share2}
            label={dictionary.host.socialPreview}
            onClick={() => select(onSocial)}
          />
        </div>
      ) : null}
    </div>
  );
}

function MoreActionsMenu(props: GuestActionProps) {
  const [open, setOpen] = useState(false);
  const { guest, dictionary } = props;
  const activeInvitation = Boolean(guest.invitation && !guest.invitation.revokedAt);
  const canSendInitialEmail =
    !guest.invitation && Boolean(guest.emailDelivery?.eligibility.eligible);

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        title={dictionary.host.moreActions}
        aria-label={dictionary.host.moreActions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex size-10 items-center justify-center rounded-xl bg-slate-700 text-slate-100 transition hover:bg-slate-600"
      >
        <MoreHorizontal aria-hidden size={19} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-1.5 shadow-2xl"
        >
          {canSendInitialEmail ? (
            <MenuAction
              icon={props.emailBusy ? RefreshCw : Send}
              label={
                props.emailBusy
                  ? dictionary.host.sendingEmail
                  : dictionary.host.generateAndSendEmail
              }
              disabled={props.emailBusy}
              onClick={() => select(props.onEmailSend)}
            />
          ) : null}

          {!guest.invitation ? (
            <MenuAction
              icon={CirclePlus}
              label={dictionary.host.createInvitation}
              onClick={() => select(props.onGenerate)}
            />
          ) : null}

          {props.hasLink && activeInvitation ? (
            <MenuAction
              icon={Copy}
              label={props.copied ? dictionary.host.copied : dictionary.host.copyLink}
              onClick={() => select(props.onCopy)}
            />
          ) : null}

          {guest.invitation ? (
            <>
              <div className="my-1 border-t border-white/10" />
              <MenuAction
                icon={RefreshCw}
                label={dictionary.host.regenerate}
                tone="warning"
                onClick={() => select(props.onRegenerate)}
              />
            </>
          ) : null}

          {activeInvitation ? (
            <MenuAction
              icon={Ban}
              label={dictionary.host.revoke}
              tone="danger"
              onClick={() => select(props.onRevoke)}
            />
          ) : null}

          <MenuAction
            icon={Archive}
            label={dictionary.host.archive}
            onClick={() => select(props.onArchive)}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'warning' | 'danger';
  disabled?: boolean;
}) {
  const color =
    tone === 'danger'
      ? 'text-red-200 hover:bg-red-500/15'
      : tone === 'warning'
        ? 'text-amber-200 hover:bg-amber-500/15'
        : 'text-slate-200 hover:bg-white/10';

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold disabled:cursor-wait disabled:opacity-50 ${color}`}
    >
      <Icon aria-hidden size={17} className={disabled ? 'animate-spin' : undefined} />
      <span>{label}</span>
    </button>
  );
}

function GuestCard(props: GuestActionProps & { locale: Locale }) {
  const { guest, dictionary, locale } = props;

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{guest.displayName}</h2>
          <div className="mt-1">
            <InlineLocaleEditor
              guest={guest}
              dictionary={dictionary}
              onChange={props.onLocaleChange}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">{countLabel(guest, dictionary)}</p>
        </div>
        <StatusBadge guest={guest} dictionary={dictionary} />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <ContactSummary guest={guest} dictionary={dictionary} />
        <NotificationDeliverySummary guest={guest} dictionary={dictionary} locale={locale} />
        <InvitationActivitySummary guest={guest} dictionary={dictionary} locale={locale} />
        <RsvpSummary
          guest={guest}
          dictionary={dictionary}
          locale={locale}
          onClick={guest.invitation ? props.onRsvp : undefined}
        />
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <GuestActions {...props} />
      </div>
    </article>
  );
}

function GuestTable({
  guests,
  dictionary,
  locale,
  links,
  copied,
  ...actions
}: {
  guests: HostGuest[];
  dictionary: Dictionary;
  locale: Locale;
  links: Record<string, string>;
  copied: string | null;
  onEdit: (guest: HostGuest) => void;
  onGenerate: (guest: HostGuest) => void;
  onCopy: (guest: HostGuest) => void;
  onPreview: (guest: HostGuest) => void;
  onSocialPreview: (guest: HostGuest) => void;
  onRsvp: (guest: HostGuest) => void;
  onRegenerate: (guest: HostGuest) => void;
  onRevoke: (guest: HostGuest) => void;
  onArchive: (guest: HostGuest) => void;
  onRestore: (guest: HostGuest) => void;
  onEmailPreview: (guest: HostGuest) => void;
  onLocaleChange: (guest: HostGuest, locale: Locale) => Promise<void>;
  onEmailSend: (guest: HostGuest) => void;
  emailBusy: string | null;
}) {
  return (
    <div className="hidden max-h-[70vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/80 lg:block">
      <table className="w-full min-w-[940px] table-fixed text-left text-sm">
        <thead className="sticky top-0 z-20 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-300 backdrop-blur">
          <tr>
            <th className="w-[17%] p-4">{dictionary.host.displayName}</th>
            <th className="w-[12%] p-4">{dictionary.host.invited}</th>
            <th className="w-[22%] p-4">{dictionary.host.contacts}</th>
            <th className="w-[16%] p-4">{dictionary.host.status}</th>
            <th className="w-[15%] p-4">{dictionary.host.rsvpSummary}</th>
            <th className="w-[18%] p-4">{dictionary.host.actions}</th>
          </tr>
        </thead>

        <tbody>
          {guests.map((guest) => (
            <tr
              key={guest.id}
              className="border-t border-white/10 align-top transition hover:bg-white/[0.025]"
            >
              <td className="p-4">
                <button
                  type="button"
                  onClick={() => actions.onEdit(guest)}
                  className="max-w-full truncate text-left text-base font-bold text-white hover:text-cyan-200"
                >
                  {guest.displayName}
                </button>
                <div className="mt-2">
                  <InlineLocaleEditor
                    guest={guest}
                    dictionary={dictionary}
                    onChange={(nextLocale) => actions.onLocaleChange(guest, nextLocale)}
                  />
                </div>
              </td>

              <td className="p-4">
                <p className="font-bold text-white">{guest.totalInvited}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {countLabel(guest, dictionary)}
                </p>
              </td>

              <td className="p-4">
                <ContactSummary guest={guest} dictionary={dictionary} />
                <div className="mt-3">
                  <NotificationDeliverySummary
                    guest={guest}
                    dictionary={dictionary}
                    locale={locale}
                  />
                </div>
              </td>

              <td className="p-4">
                <InvitationActivitySummary guest={guest} dictionary={dictionary} locale={locale} />
              </td>

              <td className="p-4">
                <RsvpSummary
                  guest={guest}
                  dictionary={dictionary}
                  locale={locale}
                  onClick={guest.invitation ? () => actions.onRsvp(guest) : undefined}
                />
              </td>

              <td className="p-4">
                <GuestActions
                  guest={guest}
                  dictionary={dictionary}
                  hasLink={Boolean(links[guest.id])}
                  copied={copied === guest.id}
                  onEdit={() => actions.onEdit(guest)}
                  onGenerate={() => actions.onGenerate(guest)}
                  onCopy={() => actions.onCopy(guest)}
                  onPreview={() => actions.onPreview(guest)}
                  onSocialPreview={() => actions.onSocialPreview(guest)}
                  onRsvp={() => actions.onRsvp(guest)}
                  onRegenerate={() => actions.onRegenerate(guest)}
                  onRevoke={() => actions.onRevoke(guest)}
                  onArchive={() => actions.onArchive(guest)}
                  onRestore={() => actions.onRestore(guest)}
                  onEmailPreview={() => actions.onEmailPreview(guest)}
                  onLocaleChange={(nextLocale) => actions.onLocaleChange(guest, nextLocale)}
                  onEmailSend={() => actions.onEmailSend(guest)}
                  emailBusy={actions.emailBusy === guest.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationDeliverySummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const delivery = guest.emailDelivery;
  const last = delivery?.lastAttempt;
  const ready = guest.notificationEligibility.canNotifyAutomatically;

  const label = last
    ? `${dictionary.host.lastEmailStatus}: ${last.status}`
    : ready
      ? dictionary.host.automaticNotificationsReady
      : dictionary.host.noContactShort;

  const tone: 'success' | 'warning' | 'danger' =
    last?.status === 'FAILED' ? 'danger' : ready ? 'success' : 'warning';

  return (
    <CompactDisclosure label={label} tone={tone}>
      <p>
        {dictionary.host.preferredChannel}:{' '}
        <strong>{channelLabel(guest.preferredChannel, dictionary)}</strong>
      </p>

      {!ready ? (
        <p className="mt-1">
          {guest.notificationEligibility.reason === 'NO_CONTACT'
            ? dictionary.host.contactMissing
            : dictionary.host.notificationNotConfigured}
        </p>
      ) : null}

      {last ? (
        <>
          <p className="mt-1">
            {dictionary.host.lastEmailTime}:{' '}
            {formatDate(last.sentAt ?? last.updatedAt, locale, dictionary.host.never)}
          </p>
          {last.safeErrorMessage ? (
            <p className="mt-1 text-red-200">{last.safeErrorMessage}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-1">{dictionary.host.emailNotSentShort}</p>
      )}
    </CompactDisclosure>
  );
}

function CompactDisclosure({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const style =
    tone === 'success'
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
      : tone === 'warning'
        ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
        : tone === 'danger'
          ? 'border-red-400/25 bg-red-500/10 text-red-100'
          : 'border-white/10 bg-white/5 text-slate-200';

  return (
    <details className="group max-w-64 text-xs">
      <summary
        title={label}
        className={`flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-xl border px-2.5 py-1.5 font-semibold ${style}`}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          aria-hidden
          size={13}
          className="ml-auto shrink-0 transition group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 leading-5 text-slate-300">
        {children}
      </div>
    </details>
  );
}

function InlineLocaleEditor({
  guest,
  dictionary,
  onChange,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  onChange: (locale: Locale) => Promise<void>;
}) {
  const [editingLocale, setEditingLocale] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentLabel =
    guest.locale === 'es-MX' ? dictionary.common.spanish : dictionary.common.english;

  if (editingLocale) {
    return (
      <select
        autoFocus
        aria-label={dictionary.host.changeLanguage}
        value={guest.locale}
        disabled={busy}
        onBlur={() => {
          if (!busy) setEditingLocale(false);
        }}
        onChange={async (event) => {
          const nextLocale = event.target.value as Locale;
          setBusy(true);
          await onChange(nextLocale);
          setBusy(false);
          setEditingLocale(false);
        }}
        className="max-w-full rounded-lg border border-cyan-400/40 bg-slate-950 px-2 py-1 text-xs text-white outline-none"
      >
        <option value="en-US">{dictionary.common.english}</option>
        <option value="es-MX">{dictionary.common.spanish}</option>
      </select>
    );
  }

  return (
    <button
      type="button"
      title={dictionary.host.changeLanguage}
      aria-label={`${dictionary.host.changeLanguage}: ${currentLabel}`}
      onClick={() => setEditingLocale(true)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
    >
      <Languages aria-hidden size={13} />
      <span className="truncate">{currentLabel}</span>
    </button>
  );
}

function ContactSummary({ guest, dictionary }: { guest: HostGuest; dictionary: Dictionary }) {
  return (
    <div className="space-y-1 text-xs text-slate-300">
      <p>{guest.email ? `✉ ${guest.email}` : `✉ ${dictionary.host.notAvailable}`}</p>
      <p>{guest.phone ? `◉ ${guest.phone}` : `◉ ${dictionary.host.notAvailable}`}</p>
      <p className="font-semibold text-violet-200">
        {channelLabel(guest.preferredChannel, dictionary)}
      </p>
    </div>
  );
}

function InvitationActivitySummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  if (!guest.invitation) {
    return <StatusBadge guest={guest} dictionary={dictionary} />;
  }

  return (
    <div className="space-y-2">
      <StatusBadge guest={guest} dictionary={dictionary} />
      <CompactDisclosure
        label={dictionary.host.opensSummary.replace('{count}', String(guest.invitation.openCount))}
        tone={guest.invitation.openCount > 0 ? 'success' : 'neutral'}
      >
        <p>
          {dictionary.host.firstOpened}:{' '}
          {formatDate(guest.invitation.firstOpenedAt, locale, dictionary.host.never)}
        </p>
        <p className="mt-1">
          {dictionary.host.lastOpened}:{' '}
          {formatDate(guest.invitation.lastOpenedAt, locale, dictionary.host.never)}
        </p>
      </CompactDisclosure>
    </div>
  );
}

function RsvpSummary({
  guest,
  dictionary,
  locale,
  onClick,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
  onClick?: () => void;
}) {
  const response = guest.invitation?.rsvp;

  if (!guest.invitation || guest.invitation.revokedAt) {
    return <span className="text-xs text-slate-400">{dictionary.host.rsvpNotApplicable}</span>;
  }

  const content = !response ? (
    <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">
      {dictionary.host.rsvpPending}
    </span>
  ) : (
    <div className="text-left text-xs text-slate-300">
      <strong className="text-cyan-100">{hostRsvpStatus(response.status, dictionary)}</strong>

      {response.status === 'ACCEPTED' ? (
        <p className="mt-1">
          {dictionary.host.rsvpPeople.replace('{count}', String(response.totalAttending ?? 0))}
        </p>
      ) : null}

      {response.hasDietaryNotes || response.hasGuestMessage ? (
        <div className="mt-1 flex flex-wrap gap-1 text-[0.68rem]">
          {response.hasDietaryNotes ? (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5">
              {dictionary.host.rsvpDietaryIndicator}
            </span>
          ) : null}
          {response.hasGuestMessage ? (
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5">
              {dictionary.host.rsvpMessageIndicator}
            </span>
          ) : null}
        </div>
      ) : null}

      <time className="mt-1 block text-[0.68rem] text-slate-500">
        {formatDate(response.updatedAt, locale, dictionary.host.never)}
      </time>
    </div>
  );

  return onClick ? (
    <button
      type="button"
      title={dictionary.host.rsvpDetails}
      aria-label={dictionary.host.rsvpDetails}
      onClick={onClick}
      className="rounded-xl p-1.5 text-left transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      {content}
    </button>
  ) : (
    content
  );
}

function StatusBadge({ guest, dictionary }: { guest: HostGuest; dictionary: Dictionary }) {
  let label = dictionary.host.invitationNotCreated;
  let style = 'bg-slate-700 text-slate-200';
  if (guest.archivedAt) {
    label = dictionary.host.guestArchived;
    style = 'bg-slate-600 text-slate-100';
  } else if (guest.invitation?.revokedAt) {
    label = dictionary.host.invitationRevoked;
    style = 'bg-slate-700 text-slate-200';
  } else if ((guest.invitation?.openCount ?? 0) > 0) {
    label = dictionary.host.invitationOpened;
    style = 'bg-cyan-500/20 text-cyan-100';
  } else if (guest.invitation) {
    label = dictionary.host.invitationReady;
    style = 'bg-emerald-500/20 text-emerald-100';
  }
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${style}`}>{label}</span>
  );
}

function RsvpDetailModal({
  detail,
  dictionary,
  locale,
  onClose,
}: {
  detail: HostInvitationRsvpDetail;
  dictionary: Dictionary;
  locale: Locale;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dictionary.host.rsvpDetails}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto my-8 max-w-2xl rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {dictionary.host.rsvpDetails}
            </p>
            <h2 className="mt-1 text-2xl font-black">{detail.guestDisplayName}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2">
            {dictionary.host.closePreview}
          </button>
        </div>
        <section className="mt-5 rounded-2xl bg-white/5 p-4">
          <h3 className="font-bold text-violet-100">{dictionary.host.rsvpCurrent}</h3>
          {detail.current ? (
            <RsvpSnapshot response={detail.current} dictionary={dictionary} locale={locale} />
          ) : (
            <p className="mt-2 text-slate-300">{dictionary.host.rsvpPending}</p>
          )}
        </section>
        <section className="mt-5">
          <h3 className="font-bold text-violet-100">{dictionary.host.rsvpHistory}</h3>
          {detail.history.length ? (
            <ol className="mt-3 space-y-3">
              {detail.history.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-white/10 p-4">
                  <RsvpSnapshot response={entry} dictionary={dictionary} locale={locale} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-slate-400">{dictionary.host.rsvpNoHistory}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function RsvpSnapshot({
  response,
  dictionary,
  locale,
}: {
  response: HostInvitationRsvpDetail['current'] & object;
  dictionary: Dictionary;
  locale: Locale;
}) {
  return (
    <div className="mt-2 space-y-1 text-sm text-slate-300">
      <p className="font-bold text-cyan-100">{hostRsvpStatus(response.status, dictionary)}</p>
      {response.status === 'ACCEPTED' ? (
        <p>{dictionary.host.rsvpPeople.replace('{count}', String(response.totalAttending ?? 0))}</p>
      ) : null}
      {response.dietaryNotes ? (
        <p>
          {dictionary.host.rsvpDietary}: {response.dietaryNotes}
        </p>
      ) : null}
      {response.guestMessage ? (
        <p>
          {dictionary.host.rsvpMessage}: {response.guestMessage}
        </p>
      ) : null}
      <time className="block text-xs text-slate-500">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(response.updatedAt),
        )}
      </time>
    </div>
  );
}

function hostRsvpStatus(status: RsvpStatus, dictionary: Dictionary) {
  return {
    ACCEPTED: dictionary.host.rsvpAccepted,
    DECLINED: dictionary.host.rsvpDeclined,
    NOT_SURE: dictionary.host.rsvpNotSure,
    CANCELLED: dictionary.host.rsvpCancelled,
  }[status];
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  primary,
  warning,
  danger,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  warning?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = danger
    ? 'bg-red-800 text-red-50 hover:bg-red-700'
    : warning
      ? 'bg-amber-700 text-amber-50 hover:bg-amber-600'
      : primary
        ? 'bg-violet-600 text-white hover:bg-violet-500'
        : 'bg-slate-700 text-slate-100 hover:bg-slate-600';

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={`flex size-10 items-center justify-center rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${color}`}
      >
        <Icon aria-hidden size={18} className={disabled ? 'animate-spin' : undefined} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xl group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        name={name}
        type={type}
        min={type === 'number' ? 0 : undefined}
        required={required}
        defaultValue={defaultValue ?? ''}
        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 p-3 outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function Select({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: [string, string][];
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 p-3"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-4">
      <p className="text-slate-300">{label}</p>
      {[0, 1, 2].map((value) => (
        <div key={value} className="h-32 animate-pulse rounded-3xl bg-white/5" />
      ))}
    </div>
  );
}

function countLabel(guest: HostGuest, dictionary: Dictionary) {
  return guest.invitationCountMode === 'ADULTS_AND_CHILDREN'
    ? `${guest.totalInvited} (${guest.adultsInvited ?? 0} ${dictionary.host.adultsInvited.toLocaleLowerCase()}, ${guest.childrenInvited ?? 0} ${dictionary.host.childrenInvited.toLocaleLowerCase()})`
    : `${guest.totalInvited}`;
}

function channelLabel(channel: HostGuest['preferredChannel'], dictionary: Dictionary) {
  if (channel === 'EMAIL') return dictionary.host.email;
  if (channel === 'SMS') return dictionary.host.sms;
  if (channel === 'BOTH') return dictionary.host.both;
  return dictionary.host.manual;
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    : fallback;
}
