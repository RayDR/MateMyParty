'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  EmailPreview,
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
  const [locale, setLocale] = useState<Locale>('en-US');
  const [eventDetail, setEventDetail] = useState<HostEventDetail | null>(null);
  const [guests, setGuests] = useState<HostGuest[]>([]);
  const [statistics, setStatistics] = useState(emptyStatistics);
  const [rsvpStatistics, setRsvpStatistics] = useState(emptyRsvpStatistics);
  const [emailStatistics, setEmailStatistics] = useState(emptyEmailStatistics);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [emailPreviewGuest, setEmailPreviewGuest] = useState<HostGuest | null>(null);
  const [emailBusy, setEmailBusy] = useState<string | null>(null);
  const [rsvpDetail, setRsvpDetail] = useState<HostInvitationRsvpDetail | null>(null);
  const [sharePreview, setSharePreview] = useState<InvitationSharePreview | null>(null);
  const [previewGuest, setPreviewGuest] = useState<HostGuest | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<HostGuest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [countMode, setCountMode] = useState<'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN'>('TOTAL_ONLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async function showEmailPreview(guest: HostGuest) {
    setEmailPreviewGuest(guest);
    setEmailPreview(null);
    const response = await fetch(
      `/internal/host/guests/${guest.id}/email/preview?locale=${encodeURIComponent(guest.locale)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      setEmailPreviewGuest(null);
      setError(true);
      return;
    }
    setEmailPreview((await response.json()) as EmailPreview);
  }

  async function sendEmail(guest: HostGuest) {
    const delivery = guest.emailDelivery;
    if (!delivery?.eligibility.eligible) return;
    const regenerate = delivery.eligibility.requiresRegeneration;
    if (regenerate && !window.confirm(dictionary.host.confirmEmailRegeneration)) return;
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
      }
      if (result.attempt.status === 'FAILED') setError(true);
      await load();
    } catch {
      setError(true);
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
      setPreviewGuest({ ...guest, invitation: result.invitation });
    }
    await load();
  }

  async function regenerate(guest: HostGuest) {
    if (!guest.invitation) return;
    const result = (await post(
      `/internal/host/invitations/${guest.invitation.id}/regenerate`,
      dictionary.host.confirmRegenerate,
    )) as InvitationResult | null;
    if (result?.publicUrl) {
      setLinks((current) => ({ ...current, [guest.id]: result.publicUrl! }));
      setPreviewGuest({ ...guest, invitation: result.invitation });
    }
    await load();
  }

  async function mutateGuest(path: string, confirmation: string) {
    if (await post(path, confirmation)) await load();
  }

  async function revoke(guest: HostGuest) {
    if (!guest.invitation) return;
    if (
      await post(
        `/internal/host/invitations/${guest.invitation.id}/revoke`,
        dictionary.host.confirmRevoke,
      )
    ) {
      setLinks((current) => {
        const next = { ...current };
        delete next[guest.id];
        return next;
      });
      await load();
    }
  }

  async function copy(guestId: string) {
    const link = links[guestId];
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(guestId);
    window.setTimeout(() => setCopied(null), 1800);
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
                  className="rounded-xl bg-violet-500 px-4 py-2.5 font-bold shadow-lg shadow-violet-900/30"
                >
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

        {showForm ? (
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
        ) : null}

        <StatisticsGrid statistics={statistics} dictionary={dictionary} />
        <RsvpStatisticsGrid statistics={rsvpStatistics} dictionary={dictionary} />
        <EmailDeliveryPanel
          statistics={emailStatistics}
          eventIdentifier={eventIdentifier}
          locale={locale}
          dictionary={dictionary}
        />

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
          <p className="mt-2 text-xs text-slate-400">{dictionary.host.archivedGuestsHidden}</p>
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
                  onPreview={() => setPreviewGuest(guest)}
                  onRsvp={() => void showRsvp(guest)}
                  onRegenerate={() => void regenerate(guest)}
                  onRevoke={() => void revoke(guest)}
                  onArchive={() =>
                    void mutateGuest(
                      `/internal/host/guests/${guest.id}/archive`,
                      dictionary.host.confirmArchive,
                    )
                  }
                  onRestore={() =>
                    void mutateGuest(
                      `/internal/host/guests/${guest.id}/restore`,
                      dictionary.host.confirmRestore,
                    )
                  }
                  onEmailPreview={() => void showEmailPreview(guest)}
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
              onPreview={setPreviewGuest}
              onRsvp={(guest) => void showRsvp(guest)}
              onRegenerate={(guest) => void regenerate(guest)}
              onRevoke={(guest) => void revoke(guest)}
              onArchive={(guest) =>
                void mutateGuest(
                  `/internal/host/guests/${guest.id}/archive`,
                  dictionary.host.confirmArchive,
                )
              }
              onRestore={(guest) =>
                void mutateGuest(
                  `/internal/host/guests/${guest.id}/restore`,
                  dictionary.host.confirmRestore,
                )
              }
              onEmailPreview={(guest) => void showEmailPreview(guest)}
              onEmailSend={(guest) => void sendEmail(guest)}
              emailBusy={emailBusy}
            />
          </>
        )}
      </div>
      {previewGuest ? (
        <SharingPreview
          guest={previewGuest}
          preview={sharePreview}
          publicUrl={links[previewGuest.id]}
          dictionary={dictionary}
          copied={copied === previewGuest.id}
          onCopy={() => void copy(previewGuest.id)}
          onClose={() => setPreviewGuest(null)}
        />
      ) : null}
      {rsvpDetail ? (
        <RsvpDetailModal
          detail={rsvpDetail}
          dictionary={dictionary}
          locale={locale}
          onClose={() => setRsvpDetail(null)}
        />
      ) : null}
      {emailPreviewGuest ? (
        <EmailPreviewModal
          guest={emailPreviewGuest}
          preview={emailPreview}
          dictionary={dictionary}
          onClose={() => {
            setEmailPreviewGuest(null);
            setEmailPreview(null);
          }}
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
  onRsvp: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onEmailPreview: () => void;
  onEmailSend: () => void;
  emailBusy: boolean;
};

function GuestActions(props: GuestActionProps) {
  const { guest, dictionary } = props;
  if (guest.archivedAt) {
    return <ActionButton onClick={props.onRestore} label={dictionary.host.restore} />;
  }
  const activeInvitation = guest.invitation && !guest.invitation.revokedAt;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton onClick={props.onEdit} label={dictionary.host.edit} />
      <ActionButton onClick={props.onEmailPreview} label={dictionary.host.previewEmail} />
      {guest.emailDelivery?.eligibility.eligible ? (
        <ActionButton
          primary
          disabled={props.emailBusy}
          onClick={props.onEmailSend}
          label={
            props.emailBusy
              ? dictionary.host.sendingEmail
              : guest.emailDelivery.eligibility.action === 'REGENERATE_AND_SEND'
                ? dictionary.host.regenerateAndSendEmail
                : dictionary.host.generateAndSendEmail
          }
        />
      ) : null}
      {!guest.invitation ? (
        <ActionButton primary onClick={props.onGenerate} label={dictionary.host.createInvitation} />
      ) : null}
      <ActionButton onClick={props.onPreview} label={dictionary.host.preview} />
      {guest.invitation ? (
        <ActionButton onClick={props.onRsvp} label={dictionary.host.rsvpDetails} />
      ) : null}
      {props.hasLink && activeInvitation ? (
        <ActionButton
          onClick={props.onCopy}
          label={props.copied ? dictionary.host.copied : dictionary.host.copyLink}
        />
      ) : null}
      {guest.invitation ? (
        <ActionButton warning onClick={props.onRegenerate} label={dictionary.host.regenerate} />
      ) : null}
      {activeInvitation ? (
        <ActionButton danger onClick={props.onRevoke} label={dictionary.host.revoke} />
      ) : null}
      <ActionButton onClick={props.onArchive} label={dictionary.host.archive} />
    </div>
  );
}

function GuestCard(props: GuestActionProps & { locale: Locale }) {
  const { guest, dictionary, locale } = props;
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{guest.displayName}</h2>
          <p className="mt-1 text-sm text-slate-300">{countLabel(guest, dictionary)}</p>
        </div>
        <StatusBadge guest={guest} dictionary={dictionary} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <ContactSummary guest={guest} dictionary={dictionary} />
        <InvitationOpeningSummary guest={guest} dictionary={dictionary} locale={locale} />
        <RsvpSummary guest={guest} dictionary={dictionary} locale={locale} />
      </div>
      <div className="mt-4">
        <EmailDeliverySummary guest={guest} dictionary={dictionary} locale={locale} />
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
  onRsvp: (guest: HostGuest) => void;
  onRegenerate: (guest: HostGuest) => void;
  onRevoke: (guest: HostGuest) => void;
  onArchive: (guest: HostGuest) => void;
  onRestore: (guest: HostGuest) => void;
  onEmailPreview: (guest: HostGuest) => void;
  onEmailSend: (guest: HostGuest) => void;
  emailBusy: string | null;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/80 lg:block">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
          <tr>
            <th className="p-4">{dictionary.host.displayName}</th>
            <th className="p-4">{dictionary.host.invited}</th>
            <th className="p-4">{dictionary.host.contacts}</th>
            <th className="p-4">{dictionary.host.notificationEligibility}</th>
            <th className="p-4">{dictionary.host.status}</th>
            <th className="p-4">{dictionary.host.openCount}</th>
            <th className="p-4">{dictionary.host.rsvpSummary}</th>
            <th className="p-4">{dictionary.host.actions}</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr key={guest.id} className="border-t border-white/10 align-top">
              <td className="p-4">
                <strong className="text-base">{guest.displayName}</strong>
                <p className="mt-1 text-xs text-slate-400">{guest.locale}</p>
              </td>
              <td className="p-4">{countLabel(guest, dictionary)}</td>
              <td className="p-4">
                <ContactSummary guest={guest} dictionary={dictionary} />
              </td>
              <td className="max-w-52 p-4">
                <EmailDeliverySummary guest={guest} dictionary={dictionary} locale={locale} />
              </td>
              <td className="p-4">
                <StatusBadge guest={guest} dictionary={dictionary} />
              </td>
              <td className="p-4">
                <InvitationOpeningSummary guest={guest} dictionary={dictionary} locale={locale} />
              </td>
              <td className="p-4">
                <RsvpSummary guest={guest} dictionary={dictionary} locale={locale} />
              </td>
              <td className="max-w-80 p-4">
                <GuestActions
                  guest={guest}
                  dictionary={dictionary}
                  hasLink={Boolean(links[guest.id])}
                  copied={copied === guest.id}
                  onEdit={() => actions.onEdit(guest)}
                  onGenerate={() => actions.onGenerate(guest)}
                  onCopy={() => actions.onCopy(guest)}
                  onPreview={() => actions.onPreview(guest)}
                  onRsvp={() => actions.onRsvp(guest)}
                  onRegenerate={() => actions.onRegenerate(guest)}
                  onRevoke={() => actions.onRevoke(guest)}
                  onArchive={() => actions.onArchive(guest)}
                  onRestore={() => actions.onRestore(guest)}
                  onEmailPreview={() => actions.onEmailPreview(guest)}
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

function Eligibility({ guest, dictionary }: { guest: HostGuest; dictionary: Dictionary }) {
  if (guest.notificationEligibility.canNotifyAutomatically) {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
        ● {dictionary.host.canNotify}
      </span>
    );
  }
  const noContact = guest.notificationEligibility.reason === 'NO_CONTACT';
  return (
    <div
      className={`rounded-xl border p-2 text-xs ${noContact ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}
    >
      <strong>
        {noContact ? dictionary.host.cannotNotify : dictionary.host.notificationNotConfigured}
      </strong>
      {noContact ? <p className="mt-1">{dictionary.host.contactMissing}</p> : null}
    </div>
  );
}

function EmailDeliverySummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const delivery = guest.emailDelivery;
  if (!delivery) return <Eligibility guest={guest} dictionary={dictionary} />;
  const last = delivery.lastAttempt;
  return (
    <div className="space-y-2 text-xs">
      <Eligibility guest={guest} dictionary={dictionary} />
      {last ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-2 text-slate-300">
          <p>
            {dictionary.host.lastEmailStatus}:{' '}
            <strong className={last.status === 'FAILED' ? 'text-red-200' : 'text-cyan-100'}>
              {last.status}
            </strong>
          </p>
          <p>
            {dictionary.host.lastEmailTime}:{' '}
            <time>{formatDate(last.sentAt ?? last.updatedAt, locale, dictionary.host.never)}</time>
          </p>
          {delivery.retryAvailable ? (
            <p className="mt-1 font-semibold text-amber-200">
              {dictionary.host.emailRetryAvailable}
            </p>
          ) : null}
          {last.safeErrorMessage ? (
            <p className="mt-1 text-red-200">{last.safeErrorMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-slate-400">{dictionary.host.noEmailAttempts}</p>
      )}
    </div>
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

function InvitationOpeningSummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  if (!guest.invitation) return <span className="text-slate-400">{dictionary.host.never}</span>;
  return (
    <div className="space-y-1 text-xs text-slate-300">
      <p>
        {dictionary.host.openCount}: <strong>{guest.invitation.openCount}</strong>
      </p>
      <p>
        {dictionary.host.firstOpened}:{' '}
        {formatDate(guest.invitation.firstOpenedAt, locale, dictionary.host.never)}
      </p>
      <p>
        {dictionary.host.lastOpened}:{' '}
        {formatDate(guest.invitation.lastOpenedAt, locale, dictionary.host.never)}
      </p>
    </div>
  );
}

function RsvpSummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const response = guest.invitation?.rsvp;
  if (!guest.invitation || guest.invitation.revokedAt) {
    return <span className="text-xs text-slate-400">{dictionary.host.rsvpNotApplicable}</span>;
  }
  if (!response) {
    return (
      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-100">
        {dictionary.host.rsvpPending}
      </span>
    );
  }
  return (
    <div className="text-xs text-slate-300">
      <strong className="text-cyan-100">{hostRsvpStatus(response.status, dictionary)}</strong>
      {response.status === 'ACCEPTED' ? (
        <p className="mt-1">
          {dictionary.host.rsvpPeople.replace('{count}', String(response.totalAttending ?? 0))}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1 text-[0.7rem]">
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
      <time className="mt-1 block text-[0.7rem] text-slate-500">
        {dictionary.host.rsvpLastResponse}:{' '}
        {formatDate(response.updatedAt, locale, dictionary.host.never)}
      </time>
    </div>
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

function SharingPreview({
  guest,
  preview,
  publicUrl,
  dictionary,
  copied,
  onCopy,
  onClose,
}: {
  guest: HostGuest;
  preview: InvitationSharePreview | null;
  publicUrl?: string;
  dictionary: Dictionary;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const smsText = preview
    ? publicUrl
      ? preview.smsText.replace(/https?:\/\/[^\s]+\/i\/…|\/i\/…/, publicUrl)
      : preview.smsText
    : '';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dictionary.host.invitationPreview}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto my-6 max-w-3xl rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {dictionary.host.invitationPreview}
            </p>
            <h2 className="mt-1 text-2xl font-black">{guest.displayName}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2">
            {dictionary.host.closePreview}
          </button>
        </div>
        {!preview ? (
          <p className="mt-6 text-slate-300">{dictionary.host.loadingPreview}</p>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <section className="overflow-hidden rounded-3xl bg-[#0b141a] shadow-xl">
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
              <div className="p-4">
                <h3 className="font-bold">{preview.eventTitle}</h3>
                <p className="mt-2 text-sm text-slate-300">{preview.invitationText}</p>
                <p className="mt-3 text-xs text-emerald-200">
                  {preview.hostname ?? dictionary.host.notAvailable}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  {dictionary.host.whatsAppApproximation}
                </p>
              </div>
            </section>
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-xl">
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
              <div className="p-4">
                <h3 className="font-bold">{preview.eventTitle}</h3>
                <p className="mt-2 text-sm text-slate-600">{preview.invitationText}</p>
                <p className="mt-3 text-xs uppercase text-slate-500">
                  {preview.hostname ?? dictionary.host.notAvailable}
                </p>
              </div>
            </section>
            <section className="rounded-3xl border border-white/10 bg-slate-950 p-4 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
                {dictionary.host.smsPreview}
              </p>
              <p className="mt-3 rounded-2xl bg-blue-500 p-4 text-sm text-white sm:ml-auto sm:max-w-md">
                {smsText}
              </p>
              <p className="mt-2 text-right text-xs text-slate-400">
                {dictionary.host.characterCount.replace(
                  '{count}',
                  String(Array.from(smsText).length),
                )}
              </p>
            </section>
            <section className="rounded-3xl border border-white/10 bg-slate-950 p-4 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                {dictionary.host.calendarPreview}
              </p>
              <h3 className="mt-3 font-bold">{preview.calendar.title}</h3>
              <p className="mt-2 text-sm text-slate-300">
                {new Intl.DateTimeFormat(preview.locale, {
                  dateStyle: 'full',
                  timeStyle: 'short',
                  timeZone: preview.calendar.timezone,
                }).format(new Date(preview.calendar.startsAt))}
              </p>
              {preview.calendar.location ? (
                <p className="mt-1 text-sm text-slate-400">{preview.calendar.location}</p>
              ) : null}
            </section>
          </div>
        )}
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {dictionary.host.smsUnavailable}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {preview ? (
            <>
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
            </>
          ) : null}
          {publicUrl ? (
            <button onClick={onCopy} className="rounded-xl bg-cyan-600 px-5 py-3 font-bold">
              {copied ? dictionary.host.copied : dictionary.host.copyLink}
            </button>
          ) : (
            <p className="text-sm text-amber-200">
              {guest.invitation ? dictionary.host.linkUnavailable : dictionary.host.generateToCopy}
            </p>
          )}
          <p className="text-xs text-slate-400">{dictionary.host.linkSecurityNote}</p>
        </div>
      </div>
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
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(text).then(onCopied)}
      className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold"
    >
      {copied ? '✓' : label}
    </button>
  );
}

function EmailPreviewModal({
  guest,
  preview,
  dictionary,
  onClose,
}: {
  guest: HostGuest;
  preview: EmailPreview | null;
  dictionary: Dictionary;
  onClose: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dictionary.host.emailPreview}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto my-6 max-w-5xl rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {dictionary.host.emailPreview}
            </p>
            <h2 className="mt-1 text-xl font-black">{guest.displayName}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMobile((value) => !value)}
              className="rounded-xl bg-white/10 px-4 py-2"
            >
              {mobile ? dictionary.host.desktopPreview : dictionary.host.mobilePreview}
            </button>
            <button onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2">
              {dictionary.host.closePreview}
            </button>
          </div>
        </div>
        {!preview ? (
          <p className="mt-6 text-slate-300">{dictionary.host.loadingPreview}</p>
        ) : (
          <div className="mt-5">
            <p className="mb-3 rounded-xl bg-slate-950 p-3 text-sm">
              <strong>{dictionary.host.emailSubject}:</strong> {preview.subject}
            </p>
            <div className="overflow-x-auto rounded-2xl bg-slate-950 p-3">
              <iframe
                title={dictionary.host.emailPreview}
                sandbox=""
                srcDoc={preview.html}
                className="mx-auto h-[680px] rounded-xl bg-white transition-[width]"
                style={{ width: mobile ? 390 : 680, maxWidth: '100%' }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">{dictionary.host.previewUsesPlaceholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function setCopiedTemplateTemporarily(value: string, setValue: (value: string | null) => void) {
  setValue(value);
  window.setTimeout(() => setValue(null), 1800);
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

function ActionButton({
  label,
  onClick,
  primary,
  warning,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  warning?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = danger
    ? 'bg-red-800 hover:bg-red-700'
    : warning
      ? 'bg-amber-700 hover:bg-amber-600'
      : primary
        ? 'bg-violet-600 hover:bg-violet-500'
        : 'bg-slate-700 hover:bg-slate-600';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${color}`}
    >
      {label}
    </button>
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
