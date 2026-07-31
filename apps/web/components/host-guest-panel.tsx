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
  Baby,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CirclePlus,
  Copy,
  Eye,
  Languages,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  UsersRound,
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
type CountFocus = 'total' | 'adults' | null;
type NotificationChannel = 'EMAIL' | 'SMS';
type BulkActionKind = 'archive' | 'revoke' | 'regenerate';

type InvitationResult = {
  guest?: HostGuest;
  invitation: InvitationSummary;
  publicUrl?: string;
};

type ConfirmationKind = 'regenerate' | 'revoke' | 'archive';

type ConfirmationRequest = {
  kind: ConfirmationKind;
  guest: HostGuest;
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
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [countFocus, setCountFocus] = useState<CountFocus>(null);
  const [notificationRequest, setNotificationRequest] = useState<{
    guest: HostGuest;
    channel: NotificationChannel;
  } | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [shareConfirmation, setShareConfirmation] = useState<HostGuest | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkActionKind | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [readRsvpKeys, setReadRsvpKeys] = useState<Set<string>>(() => new Set());
  const [countMode, setCountMode] = useState<'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN'>('TOTAL_ONLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const dictionary = getDictionary(locale);

  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
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
        if (showLoading) setLoading(false);
      }
    },
    [eventIdentifier],
  );

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

  useEffect(() => {
    if (typeof window.matchMedia === 'function') {
      setShowQuickFilters(window.matchMedia('(min-width: 640px)').matches);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`mmp:rsvp-read:${eventIdentifier}`);
      const values = stored ? (JSON.parse(stored) as string[]) : [];
      setReadRsvpKeys(new Set(values));
    } catch {
      setReadRsvpKeys(new Set());
    }
  }, [eventIdentifier]);

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

  const selectedGuests = useMemo(
    () => guests.filter((guest) => selectedGuestIds.has(guest.id)),
    [guests, selectedGuestIds],
  );
  const visibleGuestIds = filtered.map((guest) => guest.id);
  const allVisibleSelected =
    visibleGuestIds.length > 0 && visibleGuestIds.every((guestId) => selectedGuestIds.has(guestId));
  const bulkEligibleCounts = {
    archive: selectedGuests.filter((guest) => !guest.archivedAt).length,
    revoke: selectedGuests.filter(
      (guest) => guest.invitation && !guest.invitation.revokedAt && !guest.archivedAt,
    ).length,
    regenerate: selectedGuests.filter((guest) => guest.invitation && !guest.archivedAt).length,
  };

  function beginCreate() {
    setEditing(null);
    setCountFocus(null);
    setCountMode('TOTAL_ONLY');
    setShowForm(true);
  }

  function beginEdit(guest: HostGuest, focus: CountFocus = null) {
    setEditing(guest);
    setCountFocus(focus);
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

    const savedGuest: HostGuest | undefined =
      'displayName' in result ? (result as HostGuest) : result.guest;

    if (savedGuest) {
      setGuests((current) => {
        const exists = current.some((guest) => guest.id === savedGuest.id);
        return exists
          ? current.map((guest) => (guest.id === savedGuest.id ? savedGuest : guest))
          : [...current, savedGuest];
      });
    }

    setEditing(null);
    setCountFocus(null);
    setShowForm(false);
    formElement.reset();
    await load(false);
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
      await load(false);
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
      await load(false);
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
    await load(false);
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

    await load(false);
    return true;
  }

  async function mutateGuest(path: string, confirmationMessage?: string): Promise<boolean> {
    if (!(await post(path, confirmationMessage))) return false;
    await load(false);
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

    await load(false);
    return true;
  }

  function requestConfirmation(kind: ConfirmationKind, guest: HostGuest) {
    setConfirmation({ kind, guest });
  }

  async function performConfirmedAction() {
    if (!confirmation) return;

    setConfirmationBusy(true);

    try {
      const completed =
        confirmation.kind === 'regenerate'
          ? await regenerate(confirmation.guest)
          : confirmation.kind === 'revoke'
            ? await revoke(confirmation.guest)
            : await mutateGuest(`/internal/host/guests/${confirmation.guest.id}/archive`);

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

  async function shareWithUrl(guest: HostGuest, url: string) {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: eventDetail?.title ?? guest.displayName,
          text: sharePreview?.invitationText,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(guest.id);
        window.setTimeout(() => setCopied(null), 1800);
      }

      setError(false);
      return true;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      setError(true);
      return false;
    }
  }

  async function createShareableLink(guest: HostGuest, regenerateExisting: boolean) {
    const path = regenerateExisting
      ? `/internal/host/invitations/${guest.invitation!.id}/regenerate`
      : `/internal/host/guests/${guest.id}/invitations`;
    const response = await fetch(path, { method: 'POST' });

    if (!response.ok) {
      setError(true);
      return null;
    }

    const result = (await response.json()) as InvitationResult;
    if (!result.publicUrl) {
      setError(true);
      return null;
    }

    setLinks((current) => ({ ...current, [guest.id]: result.publicUrl! }));
    await load(false);
    return result.publicUrl;
  }

  async function shareInvitation(guest: HostGuest) {
    const existingLink = links[guest.id];
    if (existingLink) {
      await shareWithUrl(guest, existingLink);
      return;
    }

    if (guest.invitation) {
      setShareConfirmation(guest);
      return;
    }

    setShareBusy(true);
    try {
      const newLink = await createShareableLink(guest, false);
      if (newLink) await shareWithUrl(guest, newLink);
    } finally {
      setShareBusy(false);
    }
  }

  async function performShareConfirmation() {
    if (!shareConfirmation?.invitation) return;

    setShareBusy(true);
    try {
      const newLink = await createShareableLink(shareConfirmation, true);
      if (newLink) {
        await shareWithUrl(shareConfirmation, newLink);
        setShareConfirmation(null);
      }
    } finally {
      setShareBusy(false);
    }
  }

  function requestNotification(guest: HostGuest, channel: NotificationChannel) {
    setNotificationRequest({ guest, channel });
  }

  async function performNotificationRequest() {
    if (!notificationRequest || notificationRequest.channel !== 'EMAIL') return;

    setNotificationBusy(true);
    try {
      const completed = await sendEmail(notificationRequest.guest);
      if (completed) setNotificationRequest(null);
    } finally {
      setNotificationBusy(false);
    }
  }

  function rsvpReadKey(guest: HostGuest) {
    const response = guest.invitation?.rsvp;
    return response ? `${guest.id}:${response.updatedAt}` : null;
  }

  function guestHasMessage(guest: HostGuest) {
    const response = guest.invitation?.rsvp;
    return Boolean(response?.hasGuestMessage || response?.hasDietaryNotes);
  }

  function rsvpUnread(guest: HostGuest) {
    const key = rsvpReadKey(guest);
    return Boolean(key && guestHasMessage(guest) && !readRsvpKeys.has(key));
  }

  async function openGuestMessage(guest: HostGuest) {
    const key = rsvpReadKey(guest);
    if (key) {
      setReadRsvpKeys((current) => {
        const next = new Set(current);
        next.add(key);
        window.localStorage.setItem(`mmp:rsvp-read:${eventIdentifier}`, JSON.stringify([...next]));
        return next;
      });
    }

    await showRsvp(guest);
  }

  function toggleGuestSelection(guestId: string) {
    setSelectedGuestIds((current) => {
      const next = new Set(current);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedGuestIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleGuestIds.forEach((guestId) => next.delete(guestId));
      else visibleGuestIds.forEach((guestId) => next.add(guestId));
      return next;
    });
  }

  async function performBulkAction() {
    if (!bulkAction) return;

    const eligible = selectedGuests.filter((guest) => {
      if (bulkAction === 'archive') return !guest.archivedAt;
      if (bulkAction === 'revoke') {
        return Boolean(guest.invitation && !guest.invitation.revokedAt && !guest.archivedAt);
      }
      return Boolean(guest.invitation && !guest.archivedAt);
    });

    if (!eligible.length) return;

    setBulkBusy(true);
    try {
      const generatedLinks: Record<string, string> = {};
      const revokedGuestIds = new Set<string>();

      const results = await Promise.allSettled(
        eligible.map(async (guest) => {
          const path =
            bulkAction === 'archive'
              ? `/internal/host/guests/${guest.id}/archive`
              : bulkAction === 'revoke'
                ? `/internal/host/invitations/${guest.invitation!.id}/revoke`
                : `/internal/host/invitations/${guest.invitation!.id}/regenerate`;
          const response = await fetch(path, { method: 'POST' });
          if (!response.ok) throw new Error();

          if (bulkAction === 'regenerate') {
            const result = (await response.json()) as InvitationResult;
            if (result.publicUrl) generatedLinks[guest.id] = result.publicUrl;
          } else if (bulkAction === 'revoke') {
            revokedGuestIds.add(guest.id);
          }
        }),
      );

      setLinks((current) => {
        const next = { ...current, ...generatedLinks };
        revokedGuestIds.forEach((guestId) => delete next[guestId]);
        return next;
      });

      await load(false);
      setError(results.some((result) => result.status === 'rejected'));
      setSelectedGuestIds(new Set());
      setBulkAction(null);
    } finally {
      setBulkBusy(false);
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
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
              className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold"
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

            <button
              type="button"
              aria-expanded={showQuickFilters}
              onClick={() => setShowQuickFilters((current) => !current)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/5"
            >
              <SlidersHorizontal aria-hidden size={17} />
              {showQuickFilters
                ? dictionary.host.hideQuickFilters
                : dictionary.host.showQuickFilters}
            </button>
          </div>

          {showQuickFilters ? (
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
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={showContactDetails}
                onChange={(event) => setShowContactDetails(event.target.checked)}
                className="size-4 accent-cyan-500"
              />
              {dictionary.host.showContactDetails}
            </label>
            <p className="text-xs text-slate-400">{dictionary.host.archivedGuestsHidden}</p>
          </div>
        </section>

        {selectedGuestIds.size > 0 ? (
          <section
            aria-label={dictionary.host.bulkActions}
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3"
          >
            <strong className="mr-2 text-sm text-cyan-100">
              {dictionary.host.selectedGuests.replace('{count}', String(selectedGuestIds.size))}
            </strong>
            <button
              type="button"
              disabled={bulkEligibleCounts.regenerate === 0}
              onClick={() => setBulkAction('regenerate')}
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              {dictionary.host.bulkRegenerate}
            </button>
            <button
              type="button"
              disabled={bulkEligibleCounts.revoke === 0}
              onClick={() => setBulkAction('revoke')}
              className="rounded-xl bg-red-900/70 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-40"
            >
              {dictionary.host.bulkRevoke}
            </button>
            <button
              type="button"
              disabled={bulkEligibleCounts.archive === 0}
              onClick={() => setBulkAction('archive')}
              className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              {dictionary.host.bulkArchive}
            </button>
            <button
              type="button"
              onClick={() => setSelectedGuestIds(new Set())}
              className="ml-auto rounded-xl px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
            >
              {dictionary.host.clearSelection}
            </button>
          </section>
        ) : null}

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
                  showContactDetails={showContactDetails}
                  selected={selectedGuestIds.has(guest.id)}
                  onSelect={() => toggleGuestSelection(guest.id)}
                  hasLink={Boolean(links[guest.id])}
                  copied={copied === guest.id}
                  onEdit={() => beginEdit(guest)}
                  onEditCounts={() =>
                    beginEdit(
                      guest,
                      guest.invitationCountMode === 'TOTAL_ONLY' ? 'total' : 'adults',
                    )
                  }
                  onGenerate={() => void generate(guest)}
                  onCopy={() => void copy(guest.id)}
                  onShare={() => void shareInvitation(guest)}
                  onPreview={() => openPreview(guest, 'invitation')}
                  onSocialPreview={() => openPreview(guest, 'message', true)}
                  onNotify={(channel) => requestNotification(guest, channel)}
                  onOpenGuestMessage={() => void openGuestMessage(guest)}
                  rsvpUnread={rsvpUnread(guest)}
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
              showContactDetails={showContactDetails}
              selectedGuestIds={selectedGuestIds}
              allVisibleSelected={allVisibleSelected}
              onToggleVisibleSelection={toggleVisibleSelection}
              onToggleGuestSelection={toggleGuestSelection}
              onEdit={beginEdit}
              onEditCounts={(guest) =>
                beginEdit(guest, guest.invitationCountMode === 'TOTAL_ONLY' ? 'total' : 'adults')
              }
              onGenerate={(guest) => void generate(guest)}
              onCopy={(guest) => void copy(guest.id)}
              onShare={(guest) => void shareInvitation(guest)}
              onPreview={(guest) => openPreview(guest, 'invitation')}
              onSocialPreview={(guest) => openPreview(guest, 'message', true)}
              onNotify={(guest, channel) => requestNotification(guest, channel)}
              onOpenGuestMessage={(guest) => void openGuestMessage(guest)}
              isRsvpUnread={rsvpUnread}
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
          onConfirm={() => void performConfirmedAction()}
          onCancel={() => {
            if (!confirmationBusy) setConfirmation(null);
          }}
        />
      ) : null}
      {notificationRequest ? (
        <NotificationChannelDialog
          request={notificationRequest}
          dictionary={dictionary}
          busy={notificationBusy}
          onConfirm={() => void performNotificationRequest()}
          onClose={() => {
            if (!notificationBusy) setNotificationRequest(null);
          }}
        />
      ) : null}
      {shareConfirmation ? (
        <HostActionConfirmationDialog
          title={dictionary.host.shareRegenerateTitle}
          description={dictionary.host.shareRegenerateDescription.replace(
            '{guest}',
            shareConfirmation.displayName,
          )}
          confirmLabel={dictionary.host.shareInvitation}
          cancelLabel={dictionary.host.cancel}
          closeLabel={dictionary.host.closeDialog}
          variant="warning"
          busy={shareBusy}
          onConfirm={() => void performShareConfirmation()}
          onCancel={() => {
            if (!shareBusy) setShareConfirmation(null);
          }}
        />
      ) : null}
      {bulkAction ? (
        <HostActionConfirmationDialog
          title={bulkActionTitle(bulkAction, dictionary)}
          description={dictionary.host.bulkActionDescription
            .replace('{eligible}', String(bulkEligibleCounts[bulkAction]))
            .replace('{selected}', String(selectedGuestIds.size))}
          confirmLabel={bulkActionLabel(bulkAction, dictionary)}
          cancelLabel={dictionary.host.cancel}
          closeLabel={dictionary.host.closeDialog}
          variant={bulkAction === 'revoke' ? 'danger' : 'warning'}
          busy={bulkBusy}
          onConfirm={() => void performBulkAction()}
          onCancel={() => {
            if (!bulkBusy) setBulkAction(null);
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
                setCountFocus(null);
                setShowForm(false);
              }}
              aria-label={dictionary.host.closeDialog}
              className="absolute right-4 top-4 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-950/85"
            >
              <X aria-hidden size={20} />
            </button>
            {editing ? (
              <GuestEditSummary guest={editing} dictionary={dictionary} locale={locale} />
            ) : null}
            <GuestForm
              key={editing?.id ?? 'new'}
              dictionary={dictionary}
              locale={locale}
              editing={editing}
              countMode={countMode}
              focusCount={countFocus}
              setCountMode={setCountMode}
              submit={submit}
              cancel={() => {
                setEditing(null);
                setCountFocus(null);
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
  focusCount,
  setCountMode,
  submit,
  cancel,
}: {
  dictionary: Dictionary;
  locale: Locale;
  editing: HostGuest | null;
  countMode: 'TOTAL_ONLY' | 'ADULTS_AND_CHILDREN';
  focusCount: CountFocus;
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
              autoFocus={focusCount === 'total'}
              defaultValue={editing?.totalInvited ?? 0}
            />
          ) : (
            <>
              <Field
                name="adultsInvited"
                label={dictionary.host.adultsInvited}
                type="number"
                required
                autoFocus={focusCount === 'adults'}
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
  onEditCounts: () => void;
  onGenerate: () => void;
  onCopy: () => void;
  onShare: () => void;
  onPreview: () => void;
  onSocialPreview: () => void;
  onNotify: (channel: NotificationChannel) => void;
  onOpenGuestMessage: () => void;
  rsvpUnread: boolean;
  onRegenerate: () => void;
  onRevoke: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onEmailPreview: () => void;
  onLocaleChange: (locale: Locale) => Promise<void>;
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
    <div className="inline-flex max-w-full flex-nowrap items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
      <IconAction icon={Pencil} onClick={props.onEdit} label={dictionary.host.edit} />
      <PreviewSplitButton
        dictionary={dictionary}
        onInvitation={props.onPreview}
        onEmail={props.onEmailPreview}
        onSocial={props.onSocialPreview}
      />
      <span className="mx-0.5 h-7 w-px bg-white/10" />
      <IconAction icon={Share2} onClick={props.onShare} label={dictionary.host.shareInvitation} />
      <MoreActionsMenu {...props} />
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

function GuestCard(
  props: GuestActionProps & {
    locale: Locale;
    showContactDetails: boolean;
    selected: boolean;
    onSelect: () => void;
  },
) {
  const { guest, dictionary, locale } = props;

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={props.selected}
          onChange={props.onSelect}
          aria-label={dictionary.host.selectGuest.replace('{guest}', guest.displayName)}
          className="mt-1 size-4 shrink-0 accent-cyan-500"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{guest.displayName}</h2>
          <div className="mt-1">
            <InlineLocaleEditor
              guest={guest}
              dictionary={dictionary}
              onChange={props.onLocaleChange}
            />
          </div>
          <div className="mt-2">
            <GuestCountSummary guest={guest} dictionary={dictionary} onEdit={props.onEditCounts} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <ContactDeliverySummary
          guest={guest}
          dictionary={dictionary}
          locale={locale}
          showAll={props.showContactDetails}
          emailBusy={props.emailBusy}
          onNotify={props.onNotify}
        />
        <InvitationActivitySummary
          guest={guest}
          dictionary={dictionary}
          locale={locale}
          messageUnread={props.rsvpUnread}
          onOpenMessage={props.onOpenGuestMessage}
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
  showContactDetails,
  selectedGuestIds,
  allVisibleSelected,
  onToggleVisibleSelection,
  onToggleGuestSelection,
  ...actions
}: {
  guests: HostGuest[];
  dictionary: Dictionary;
  locale: Locale;
  links: Record<string, string>;
  copied: string | null;
  showContactDetails: boolean;
  selectedGuestIds: Set<string>;
  allVisibleSelected: boolean;
  onToggleVisibleSelection: () => void;
  onToggleGuestSelection: (guestId: string) => void;
  onEdit: (guest: HostGuest) => void;
  onEditCounts: (guest: HostGuest) => void;
  onGenerate: (guest: HostGuest) => void;
  onCopy: (guest: HostGuest) => void;
  onShare: (guest: HostGuest) => void;
  onPreview: (guest: HostGuest) => void;
  onSocialPreview: (guest: HostGuest) => void;
  onNotify: (guest: HostGuest, channel: NotificationChannel) => void;
  onOpenGuestMessage: (guest: HostGuest) => void;
  isRsvpUnread: (guest: HostGuest) => boolean;
  onRegenerate: (guest: HostGuest) => void;
  onRevoke: (guest: HostGuest) => void;
  onArchive: (guest: HostGuest) => void;
  onRestore: (guest: HostGuest) => void;
  onEmailPreview: (guest: HostGuest) => void;
  onLocaleChange: (guest: HostGuest, locale: Locale) => Promise<void>;
  emailBusy: string | null;
}) {
  return (
    <div className="hidden max-h-[70vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/80 lg:block">
      <table className="w-full min-w-[980px] table-fixed text-left text-sm">
        <thead className="sticky top-0 z-20 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-300 backdrop-blur">
          <tr>
            <th className="w-[4%] p-3 text-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onToggleVisibleSelection}
                aria-label={dictionary.host.selectAllGuests}
                className="size-4 accent-cyan-500"
              />
            </th>
            <th className="w-[19%] p-3">{dictionary.host.displayName}</th>
            <th className="w-[12%] p-3">{dictionary.host.invited}</th>
            <th className="w-[18%] p-3">{dictionary.host.contacts}</th>
            <th className="w-[27%] p-3">{dictionary.host.status}</th>
            <th className="w-[20%] p-3">{dictionary.host.actions}</th>
          </tr>
        </thead>

        <tbody>
          {guests.map((guest) => (
            <tr
              key={guest.id}
              className="border-t border-white/10 align-middle transition hover:bg-white/[0.025]"
            >
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedGuestIds.has(guest.id)}
                  onChange={() => onToggleGuestSelection(guest.id)}
                  aria-label={dictionary.host.selectGuest.replace('{guest}', guest.displayName)}
                  className="size-4 accent-cyan-500"
                />
              </td>

              <td className="p-3">
                <p className="max-w-full truncate text-base font-bold text-white">
                  {guest.displayName}
                </p>
                <div className="mt-2">
                  <InlineLocaleEditor
                    guest={guest}
                    dictionary={dictionary}
                    onChange={(nextLocale) => actions.onLocaleChange(guest, nextLocale)}
                  />
                </div>
              </td>

              <td className="p-3">
                <GuestCountSummary
                  guest={guest}
                  dictionary={dictionary}
                  onEdit={() => actions.onEditCounts(guest)}
                />
              </td>

              <td className="p-3">
                <ContactDeliverySummary
                  guest={guest}
                  dictionary={dictionary}
                  locale={locale}
                  showAll={showContactDetails}
                  emailBusy={actions.emailBusy === guest.id}
                  onNotify={(channel) => actions.onNotify(guest, channel)}
                />
              </td>

              <td className="p-3">
                <InvitationActivitySummary
                  guest={guest}
                  dictionary={dictionary}
                  locale={locale}
                  messageUnread={actions.isRsvpUnread(guest)}
                  onOpenMessage={() => actions.onOpenGuestMessage(guest)}
                />
              </td>

              <td className="p-3">
                <GuestActions
                  guest={guest}
                  dictionary={dictionary}
                  hasLink={Boolean(links[guest.id])}
                  copied={copied === guest.id}
                  onEdit={() => actions.onEdit(guest)}
                  onEditCounts={() => actions.onEditCounts(guest)}
                  onGenerate={() => actions.onGenerate(guest)}
                  onCopy={() => actions.onCopy(guest)}
                  onShare={() => actions.onShare(guest)}
                  onPreview={() => actions.onPreview(guest)}
                  onSocialPreview={() => actions.onSocialPreview(guest)}
                  onNotify={(channel) => actions.onNotify(guest, channel)}
                  onOpenGuestMessage={() => actions.onOpenGuestMessage(guest)}
                  rsvpUnread={actions.isRsvpUnread(guest)}
                  onRegenerate={() => actions.onRegenerate(guest)}
                  onRevoke={() => actions.onRevoke(guest)}
                  onArchive={() => actions.onArchive(guest)}
                  onRestore={() => actions.onRestore(guest)}
                  onEmailPreview={() => actions.onEmailPreview(guest)}
                  onLocaleChange={(nextLocale) => actions.onLocaleChange(guest, nextLocale)}
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

function GuestCountSummary({
  guest,
  dictionary,
  onEdit,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  onEdit: () => void;
}) {
  const totalLabel = dictionary.host.peopleInvitedShort.replace(
    '{count}',
    String(guest.totalInvited),
  );
  const adultsLabel = dictionary.host.adultsBreakdown.replace(
    '{count}',
    String(guest.adultsInvited ?? 0),
  );
  const childrenLabel = dictionary.host.childrenBreakdown.replace(
    '{count}',
    String(guest.childrenInvited ?? 0),
  );
  const summary =
    guest.invitationCountMode === 'ADULTS_AND_CHILDREN'
      ? `${totalLabel}: ${adultsLabel}, ${childrenLabel}`
      : totalLabel;

  return (
    <button
      type="button"
      title={summary}
      aria-label={`${dictionary.host.editInvitationCount}: ${summary}`}
      onClick={onEdit}
      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-2.5 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
    >
      {guest.invitationCountMode === 'ADULTS_AND_CHILDREN' ? (
        <>
          <span className="inline-flex items-center gap-1" title={adultsLabel}>
            <UserRound aria-hidden size={16} />
            {guest.adultsInvited ?? 0}
          </span>
          <span className="inline-flex items-center gap-1" title={childrenLabel}>
            <Baby aria-hidden size={16} />
            {guest.childrenInvited ?? 0}
          </span>
        </>
      ) : (
        <span className="inline-flex items-center gap-1" title={totalLabel}>
          <UsersRound aria-hidden size={16} />
          {guest.totalInvited}
        </span>
      )}
    </button>
  );
}

function ContactDeliverySummary({
  guest,
  dictionary,
  locale,
  showAll,
  emailBusy,
  onNotify,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
  showAll: boolean;
  emailBusy: boolean;
  onNotify: (channel: NotificationChannel) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const revealDetails = showAll || expanded;
  const hasEmail = Boolean(guest.email);
  const hasPhone = Boolean(guest.phone);
  const hasContact = hasEmail || hasPhone;
  const emailPreferred = guest.preferredChannel === 'EMAIL' || guest.preferredChannel === 'BOTH';
  const phonePreferred = guest.preferredChannel === 'SMS' || guest.preferredChannel === 'BOTH';
  const attempt = guest.emailDelivery?.lastAttempt;
  const emailSent = attempt?.status === 'SENT' || attempt?.status === 'DELIVERED';
  const emailFailed = attempt?.status === 'FAILED';
  const attemptTime = attempt
    ? (attempt.deliveredAt ??
      attempt.sentAt ??
      attempt.failedAt ??
      attempt.updatedAt ??
      attempt.createdAt)
    : null;
  const failedDetail = emailFailed ? (attempt?.safeErrorMessage ?? attempt?.safeErrorCode) : null;

  return (
    <div className="max-w-56 text-xs">
      <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/45 p-1">
        <ContactChannelButton
          icon={Mail}
          label={dictionary.host.emailNotification}
          available={hasEmail}
          preferred={emailPreferred}
          sent={emailSent}
          failed={emailFailed}
          stateLabel={
            emailSent
              ? dictionary.host.notificationSent
              : emailFailed
                ? dictionary.host.notificationFailed
                : emailPreferred
                  ? dictionary.host.preferredContactChannel
                  : dictionary.host.availableContactChannel
          }
          busy={emailBusy}
          onClick={() => onNotify('EMAIL')}
        />
        <ContactChannelButton
          icon={Phone}
          label={dictionary.host.smsNotification}
          available={hasPhone}
          preferred={phonePreferred}
          sent={false}
          failed={false}
          stateLabel={
            hasPhone
              ? phonePreferred
                ? dictionary.host.preferredContactChannel
                : dictionary.host.availableContactChannel
              : dictionary.host.unavailableContactChannel
          }
          onClick={() => onNotify('SMS')}
        />

        {!hasContact ? (
          <button
            type="button"
            title={dictionary.host.noContactDeliveryNotice}
            aria-label={dictionary.host.noContactDeliveryNotice}
            aria-expanded={revealDetails}
            onClick={() => setExpanded((current) => !current)}
            className="relative flex size-8 items-center justify-center rounded-lg text-amber-300 hover:bg-amber-500/10"
          >
            <TriangleAlert aria-hidden size={17} />
          </button>
        ) : (
          <button
            type="button"
            title={dictionary.host.contactAndDeliveryDetails}
            aria-label={dictionary.host.contactAndDeliveryDetails}
            aria-expanded={revealDetails}
            onClick={() => setExpanded((current) => !current)}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <ChevronDown
              aria-hidden
              size={14}
              className={`transition ${revealDetails ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {revealDetails ? (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 leading-5 text-slate-300">
          {!hasContact ? (
            <p className="text-amber-100">{dictionary.host.noContactDeliveryNotice}</p>
          ) : null}
          {guest.email ? (
            <p className="flex items-start gap-2">
              <Mail aria-hidden size={15} className="mt-0.5 shrink-0 text-cyan-300" />
              <span className="break-all">{guest.email}</span>
            </p>
          ) : null}
          {guest.phone ? (
            <p className="flex items-start gap-2">
              <Phone aria-hidden size={15} className="mt-0.5 shrink-0 text-cyan-300" />
              <span className="break-all">{guest.phone}</span>
            </p>
          ) : null}
          <p>
            {dictionary.host.preferredChannel}:{' '}
            <strong>{channelLabel(guest.preferredChannel, dictionary)}</strong>
          </p>
          {attempt ? (
            <>
              <p>
                {dictionary.host.lastEmailStatus}: <strong>{attempt.status}</strong>
              </p>
              <p>
                {dictionary.host.lastEmailTime}:{' '}
                {formatDate(attemptTime, locale, dictionary.host.never)}
              </p>
              {failedDetail ? (
                <p className="rounded-lg bg-red-500/10 px-2 py-1 text-red-200">{failedDetail}</p>
              ) : null}
            </>
          ) : hasEmail ? (
            <p>{dictionary.host.emailNotSentShort}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ContactChannelButton({
  icon: Icon,
  label,
  available,
  preferred,
  sent,
  failed,
  stateLabel,
  busy,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  available: boolean;
  preferred: boolean;
  sent: boolean;
  failed: boolean;
  stateLabel: string;
  busy?: boolean;
  onClick: () => void;
}) {
  const style = !available
    ? 'border-white/5 bg-white/[0.025] text-slate-600'
    : preferred
      ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
      : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200';
  return (
    <button
      type="button"
      disabled={!available || busy}
      title={`${label}: ${stateLabel}`}
      aria-label={`${label}: ${stateLabel}`}
      onClick={onClick}
      className={`relative flex size-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed ${style}`}
    >
      <Icon aria-hidden size={16} className={busy ? 'animate-pulse' : undefined} />
      {sent ? (
        <CheckCircle2
          aria-hidden
          size={12}
          className="absolute -right-1 -top-1 rounded-full bg-slate-950 text-emerald-300"
        />
      ) : failed ? (
        <CircleAlert
          aria-hidden
          size={12}
          className="absolute -right-1 -top-1 rounded-full bg-slate-950 text-red-300"
        />
      ) : preferred && available ? (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-cyan-300"
        />
      ) : null}
    </button>
  );
}

function NotificationChannelDialog({
  request,
  dictionary,
  busy,
  onConfirm,
  onClose,
}: {
  request: { guest: HostGuest; channel: NotificationChannel };
  dictionary: Dictionary;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isEmail = request.channel === 'EMAIL';
  const isResend = Boolean(request.guest.emailDelivery?.lastAttempt);
  const title = isEmail
    ? isResend
      ? dictionary.host.resendEmailTitle
      : dictionary.host.sendEmailTitle
    : dictionary.host.smsUnavailableTitle;
  const description = isEmail
    ? (isResend
        ? dictionary.host.resendEmailDescription
        : dictionary.host.sendEmailDescription
      ).replace('{guest}', request.guest.displayName)
    : dictionary.host.smsUnavailableDescription;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <section className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span
            className={`rounded-2xl p-3 ${isEmail ? 'bg-cyan-500/15 text-cyan-200' : 'bg-amber-500/15 text-amber-200'}`}
          >
            {isEmail ? <Mail aria-hidden size={22} /> : <TriangleAlert aria-hidden size={22} />}
          </span>
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl bg-slate-700 px-4 py-2.5 font-bold disabled:opacity-50"
          >
            {isEmail ? dictionary.host.cancel : dictionary.host.closeDialog}
          </button>
          {isEmail ? (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 font-bold text-white disabled:cursor-wait disabled:opacity-50"
            >
              {busy
                ? dictionary.host.sendingEmail
                : isResend
                  ? dictionary.host.resendEmailAction
                  : dictionary.host.sendEmailAction}
            </button>
          ) : null}
        </div>
      </section>
    </div>
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

function InvitationActivitySummary({
  guest,
  dictionary,
  locale,
  messageUnread,
  onOpenMessage,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
  messageUnread: boolean;
  onOpenMessage: () => void;
}) {
  const invitation = guest.invitation;
  const response = invitation?.rsvp;
  const hasMessage = Boolean(response?.hasGuestMessage || response?.hasDietaryNotes);
  const openingLabel = dictionary.host.totalOpenings.replace(
    '{count}',
    String(invitation?.openCount ?? 0),
  );
  const openingDetails = invitation
    ? [
        openingLabel,
        invitation.firstOpenedAt
          ? `${dictionary.host.firstOpened}: ${formatDate(invitation.firstOpenedAt, locale, dictionary.host.never)}`
          : null,
        invitation.lastOpenedAt
          ? `${dictionary.host.lastOpened}: ${formatDate(invitation.lastOpenedAt, locale, dictionary.host.never)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : openingLabel;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge guest={guest} dictionary={dictionary} />
      {invitation ? (
        <span
          title={openingDetails}
          aria-label={openingLabel}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
            invitation.openCount > 0
              ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
              : 'border-white/10 bg-white/5 text-slate-300'
          }`}
        >
          <Eye aria-hidden size={14} />
          {invitation.openCount}
        </span>
      ) : null}
      {hasMessage ? (
        <button
          type="button"
          title={
            messageUnread ? dictionary.host.unreadGuestMessage : dictionary.host.guestMessageDetails
          }
          aria-label={
            messageUnread ? dictionary.host.unreadGuestMessage : dictionary.host.guestMessageDetails
          }
          onClick={onOpenMessage}
          className={`relative flex size-8 items-center justify-center rounded-xl border border-white/10 bg-slate-800 text-slate-200 hover:bg-slate-700 ${
            messageUnread ? 'animate-pulse ring-2 ring-amber-300/60' : ''
          }`}
        >
          <MessageSquare aria-hidden size={16} />
          {messageUnread ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-300" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({ guest, dictionary }: { guest: HostGuest; dictionary: Dictionary }) {
  const response = guest.invitation?.rsvp;
  let label = dictionary.host.invitationNotCreated;
  let style = 'bg-slate-700 text-slate-200';

  if (guest.archivedAt) {
    label = dictionary.host.guestArchived;
    style = 'bg-slate-600 text-slate-100';
  } else if (guest.invitation?.revokedAt) {
    label = dictionary.host.invitationRevoked;
    style = 'bg-slate-700 text-slate-200';
  } else if (response?.status === 'ACCEPTED') {
    label = dictionary.host.rsvpAccepted;
    style = 'bg-emerald-500/20 text-emerald-100';
  } else if (response?.status === 'DECLINED') {
    label = dictionary.host.rsvpDeclined;
    style = 'bg-red-500/20 text-red-100';
  } else if (response?.status === 'NOT_SURE') {
    label = dictionary.host.rsvpNotSure;
    style = 'bg-cyan-500/20 text-cyan-100';
  } else if (response?.status === 'CANCELLED') {
    label = dictionary.host.rsvpCancelled;
    style = 'bg-slate-600 text-slate-100';
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

function GuestEditSummary({
  guest,
  dictionary,
  locale,
}: {
  guest: HostGuest;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const response = guest.invitation?.rsvp;
  const attempt = guest.emailDelivery?.lastAttempt;

  return (
    <div className="m-4 mb-0 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
        {dictionary.host.editingGuest}
      </p>
      <h2 className="mt-1 text-2xl font-black">{guest.displayName}</h2>
      <p className="mt-1 text-xs text-slate-400">
        {dictionary.host.originalGuestName}: {guest.displayName}
      </p>

      <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <summary className="cursor-pointer font-bold text-slate-100">
          {dictionary.host.guestStatusSummary}
        </summary>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.status}</dt>
            <dd className="mt-1 font-semibold">{guestStatusText(guest, dictionary)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.openCount}</dt>
            <dd className="mt-1 font-semibold">{guest.invitation?.openCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.preferredChannel}</dt>
            <dd className="mt-1 font-semibold">
              {channelLabel(guest.preferredChannel, dictionary)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.lastEmailStatus}</dt>
            <dd className="mt-1 font-semibold">
              {attempt?.status ?? dictionary.host.emailNotSentShort}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.rsvpCurrent}</dt>
            <dd className="mt-1 font-semibold">
              {response ? hostRsvpStatus(response.status, dictionary) : dictionary.host.rsvpPending}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{dictionary.host.rsvpLastResponse}</dt>
            <dd className="mt-1 font-semibold">
              {response
                ? formatDate(response.updatedAt, locale, dictionary.host.never)
                : dictionary.host.never}
            </dd>
          </div>
        </dl>
      </details>
    </div>
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
        className={`relative flex size-10 items-center justify-center rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${color}`}
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
  autoFocus,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
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
        autoFocus={autoFocus}
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

function guestStatusText(guest: HostGuest, dictionary: Dictionary) {
  if (guest.archivedAt) return dictionary.host.guestArchived;
  if (guest.invitation?.revokedAt) return dictionary.host.invitationRevoked;
  if (guest.invitation?.rsvp) return hostRsvpStatus(guest.invitation.rsvp.status, dictionary);
  if ((guest.invitation?.openCount ?? 0) > 0) return dictionary.host.invitationOpened;
  if (guest.invitation) return dictionary.host.invitationReady;
  return dictionary.host.invitationNotCreated;
}

function bulkActionLabel(action: BulkActionKind, dictionary: Dictionary) {
  if (action === 'archive') return dictionary.host.bulkArchive;
  if (action === 'revoke') return dictionary.host.bulkRevoke;
  return dictionary.host.bulkRegenerate;
}

function bulkActionTitle(action: BulkActionKind, dictionary: Dictionary) {
  if (action === 'archive') return dictionary.host.bulkArchiveTitle;
  if (action === 'revoke') return dictionary.host.bulkRevokeTitle;
  return dictionary.host.bulkRegenerateTitle;
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
