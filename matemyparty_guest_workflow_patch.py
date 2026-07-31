from pathlib import Path
import json

component_path = Path('apps/web/components/host-guest-panel.tsx')
test_path = Path('apps/web/test/host-panel.test.tsx')
component = component_path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global component
    count = component.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    component = component.replace(old, new, 1)


def replace_range(start_marker: str, end_marker: str, replacement: str, label: str) -> None:
    global component
    start = component.find(start_marker)
    end = component.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise SystemExit(f'{label}: range was not found')
    component = component[:start] + replacement + component[end:]


# ---------------------------------------------------------------------------
# Imports and shared types
# ---------------------------------------------------------------------------

if '  SlidersHorizontal,\n' not in component:
    replace_once(
        '  Share2,\n',
        '  Share2,\n  SlidersHorizontal,\n  TriangleAlert,\n',
        'workflow icon imports',
    )

# Send was only used by the old More-actions email command.
component = component.replace('  Send,\n', '')
component = component.replace('  Clock3,\n', '')

if "type NotificationChannel = 'EMAIL' | 'SMS';" not in component:
    replace_once(
        "type CountFocus = 'total' | 'adults' | null;\n",
        "type CountFocus = 'total' | 'adults' | null;\n"
        "type NotificationChannel = 'EMAIL' | 'SMS';\n"
        "type BulkActionKind = 'archive' | 'revoke' | 'regenerate';\n",
        'workflow types',
    )

# Regeneration no longer carries a resend-email option.
replace_once(
    '''type ConfirmationRequest = {
  kind: ConfirmationKind;
  guest: HostGuest;
  resendEmail: boolean;
};
''',
    '''type ConfirmationRequest = {
  kind: ConfirmationKind;
  guest: HostGuest;
};
''',
    'confirmation request type',
)


# ---------------------------------------------------------------------------
# State and browser-persisted unread state
# ---------------------------------------------------------------------------

replace_once(
    '''  const [showContactDetails, setShowContactDetails] = useState(false);
  const [countFocus, setCountFocus] = useState<CountFocus>(null);
''',
    '''  const [showContactDetails, setShowContactDetails] = useState(false);
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
''',
    'workflow state',
)

# Insert responsive quick-filter initialization and local unread persistence after share preview effect.
share_effect_end = '''  }, [eventIdentifier, locale]);

  const filtered = useMemo(() => {
'''
replace_once(
    share_effect_end,
    '''  }, [eventIdentifier, locale]);

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
''',
    'responsive filters and unread state effects',
)

# Derived selection state immediately after the filtered memo.
filtered_end = '''  }, [filter, guests, locale, search]);

  function beginCreate() {
'''
replace_once(
    filtered_end,
    '''  }, [filter, guests, locale, search]);

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
''',
    'selection derived state',
)


# ---------------------------------------------------------------------------
# Immediate local guest update after save
# ---------------------------------------------------------------------------

replace_once(
    '''    if ('publicUrl' in result && result.publicUrl && result.guest) {
      setLinks((current) => ({ ...current, [result.guest!.id]: result.publicUrl! }));
    }
    setEditing(null);
''',
    '''    if ('publicUrl' in result && result.publicUrl && result.guest) {
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
''',
    'immediate saved guest update',
)


# ---------------------------------------------------------------------------
# Share, notification-channel, unread-message, selection, and bulk behavior
# ---------------------------------------------------------------------------

replace_range(
    '  function requestConfirmation(kind: ConfirmationKind, guest: HostGuest) {',
    '  async function showRsvp(guest: HostGuest) {',
    '''  function requestConfirmation(kind: ConfirmationKind, guest: HostGuest) {
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
        window.localStorage.setItem(
          `mmp:rsvp-read:${eventIdentifier}`,
          JSON.stringify([...next]),
        );
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

''',
    'workflow behavior functions',
)

# The old shareInvitation function is now duplicated earlier in the file; remove it.
old_share_start = component.find('  async function shareInvitation(guest: HostGuest) {')
new_share_start = component.find('  async function shareWithUrl(guest: HostGuest, url: string)')
if old_share_start >= 0 and old_share_start < new_share_start:
    old_share_end = component.find('  async function showRsvp(guest: HostGuest) {', old_share_start)
    if old_share_end < 0:
        raise SystemExit('old shareInvitation end was not found')
    component = component[:old_share_start] + component[old_share_end:]


# ---------------------------------------------------------------------------
# Filters: always-visible full dropdown and collapsible quick filters
# ---------------------------------------------------------------------------

filter_section_start = '        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4">'
filter_section_end = '        {loading ? ('
replace_range(
    filter_section_start,
    filter_section_end,
    '''        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4">
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
              {dictionary.host.selectedGuests.replace(
                '{count}',
                String(selectedGuestIds.size),
              )}
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

''',
    'responsive filters and bulk selection bar',
)


# ---------------------------------------------------------------------------
# Wire new presentation props
# ---------------------------------------------------------------------------

replace_once(
    '''                  showContactDetails={showContactDetails}
                  hasLink={Boolean(links[guest.id])}
''',
    '''                  showContactDetails={showContactDetails}
                  selected={selectedGuestIds.has(guest.id)}
                  onSelect={() => toggleGuestSelection(guest.id)}
                  hasLink={Boolean(links[guest.id])}
''',
    'GuestCard selection props',
)

replace_once(
    '''                  onSocialPreview={() => openPreview(guest, 'message', true)}
                  onRsvp={() => void showRsvp(guest)}
''',
    '''                  onSocialPreview={() => openPreview(guest, 'message', true)}
                  onNotify={(channel) => requestNotification(guest, channel)}
                  onOpenGuestMessage={() => void openGuestMessage(guest)}
                  rsvpUnread={rsvpUnread(guest)}
''',
    'GuestCard notification and message props',
)

replace_once(
    '''              copied={copied}
              showContactDetails={showContactDetails}
              onEdit={beginEdit}
''',
    '''              copied={copied}
              showContactDetails={showContactDetails}
              selectedGuestIds={selectedGuestIds}
              allVisibleSelected={allVisibleSelected}
              onToggleVisibleSelection={toggleVisibleSelection}
              onToggleGuestSelection={toggleGuestSelection}
              onEdit={beginEdit}
''',
    'GuestTable selection props',
)

replace_once(
    '''              onSocialPreview={(guest) => openPreview(guest, 'message', true)}
              onRsvp={(guest) => void showRsvp(guest)}
''',
    '''              onSocialPreview={(guest) => openPreview(guest, 'message', true)}
              onNotify={(guest, channel) => requestNotification(guest, channel)}
              onOpenGuestMessage={(guest) => void openGuestMessage(guest)}
              isRsvpUnread={rsvpUnread}
''',
    'GuestTable notification and message props',
)

# Remove obsolete email action wiring from card and table calls.
component = component.replace('                  onEmailSend={() => void sendEmail(guest)}\n', '')
component = component.replace('              onEmailSend={(guest) => void sendEmail(guest)}\n', '')


# ---------------------------------------------------------------------------
# Dialog rendering and editing summary
# ---------------------------------------------------------------------------

# Remove the resend checkbox from regenerate confirmation.
checkbox_start = component.find('          checkbox={\n            confirmation.kind === \'regenerate\'')
if checkbox_start >= 0:
    checkbox_end = component.find('          onConfirm={() => void performConfirmedAction()}', checkbox_start)
    if checkbox_end < 0:
        raise SystemExit('regenerate checkbox end was not found')
    component = component[:checkbox_start] + component[checkbox_end:]

confirmation_close = '''      ) : null}
      {showForm ? (
'''
replace_once(
    confirmation_close,
    '''      ) : null}
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
''',
    'workflow dialogs',
)

replace_once(
    '''            <GuestForm
              key={editing?.id ?? 'new'}
''',
    '''            {editing ? (
              <GuestEditSummary guest={editing} dictionary={dictionary} locale={locale} />
            ) : null}
            <GuestForm
              key={editing?.id ?? 'new'}
''',
    'editing guest summary',
)


# ---------------------------------------------------------------------------
# Action contract, grouped Share/More, and remove RSVP/email actions
# ---------------------------------------------------------------------------

replace_once(
    '''  onSocialPreview: () => void;
  onRsvp: () => void;
  onRegenerate: () => void;
''',
    '''  onSocialPreview: () => void;
  onNotify: (channel: NotificationChannel) => void;
  onOpenGuestMessage: () => void;
  rsvpUnread: boolean;
  onRegenerate: () => void;
''',
    'GuestActionProps notification contract',
)
component = component.replace('  onEmailSend: () => void;\n', '')

replace_range(
    'function GuestActions(props: GuestActionProps) {',
    'function PreviewSplitButton(',
    '''function GuestActions(props: GuestActionProps) {
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
      <IconAction
        icon={Share2}
        onClick={props.onShare}
        label={dictionary.host.shareInvitation}
      />
      <MoreActionsMenu {...props} />
    </div>
  );
}

''',
    'grouped action layout',
)

# Remove email send command from More actions.
more_start = component.find('function MoreActionsMenu(')
more_end = component.find('function MenuAction(', more_start)
if more_start < 0 or more_end < 0:
    raise SystemExit('MoreActionsMenu range was not found')
more = component[more_start:more_end]
can_send_start = more.find('  const canSendInitialEmail =')
if can_send_start >= 0:
    can_send_end = more.find('\n\n  function select', can_send_start)
    more = more[:can_send_start] + more[can_send_end + 2:]
email_menu_start = more.find('          {canSendInitialEmail ? (')
if email_menu_start >= 0:
    email_menu_end = more.find('          {!guest.invitation ? (', email_menu_start)
    if email_menu_end < 0:
        raise SystemExit('More-actions email block end was not found')
    more = more[:email_menu_start] + more[email_menu_end:]
component = component[:more_start] + more + component[more_end:]


# ---------------------------------------------------------------------------
# Mobile card and desktop table with selection and better column sizing
# ---------------------------------------------------------------------------

replace_range(
    'function GuestCard(',
    'function GuestTable(',
    '''function GuestCard(
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

''',
    'mobile card workflow layout',
)

replace_range(
    'function GuestTable(',
    'function GuestCountSummary(',
    '''function GuestTable({
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

''',
    'desktop table workflow layout',
)


# ---------------------------------------------------------------------------
# Channel icons with per-channel delivery state and styled resend dialog
# ---------------------------------------------------------------------------

replace_range(
    'function ContactDeliverySummary(',
    'function InlineLocaleEditor(',
    '''function ContactDeliverySummary({
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
          <span className={`rounded-2xl p-3 ${isEmail ? 'bg-cyan-500/15 text-cyan-200' : 'bg-amber-500/15 text-amber-200'}`}>
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

''',
    'channel delivery controls and dialog',
)


# ---------------------------------------------------------------------------
# Invitation status owns RSVP state, compact openings, and unread messages
# ---------------------------------------------------------------------------

replace_range(
    'function InvitationActivitySummary(',
    'function RsvpDetailModal(',
    '''function InvitationActivitySummary({
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

''',
    'status, opening, message, and edit summary',
)

# Remove stale contextual RSVP action helpers.
helper_start = component.find('function rsvpActionLabel(')
helper_end = component.find('function IconAction(', helper_start)
if helper_start >= 0 and helper_end >= 0:
    component = component[:helper_start] + component[helper_end:]

# Remove IconAction's old RSVP indicator API.
component = component.replace('  indicatorClassName,\n', '')
component = component.replace('  indicatorClassName?: string;\n', '')
indicator_render = '''        {indicatorClassName ? (
          <span
            aria-hidden
            className={`absolute right-1 top-1 size-2 rounded-full ring-2 ring-slate-700 ${indicatorClassName}`}
          />
        ) : null}
'''
component = component.replace(indicator_render, '')

# Helpers used by edit and bulk summaries.
helper_marker = 'function channelLabel(channel: HostGuest[\'preferredChannel\'], dictionary: Dictionary) {'
helper_code = '''function guestStatusText(guest: HostGuest, dictionary: Dictionary) {
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

'''
if helper_code.strip() not in component:
    position = component.find(helper_marker)
    if position < 0:
        raise SystemExit('helper insertion point was not found')
    component = component[:position] + helper_code + component[position:]

# Component output is held in memory until every transformation succeeds.


# ---------------------------------------------------------------------------
# Localization
# ---------------------------------------------------------------------------

translations = {
    'packages/i18n/locales/en-US/host.json': {
        'showQuickFilters': 'Show quick filters',
        'hideQuickFilters': 'Hide quick filters',
        'emailNotification': 'Email notification',
        'smsNotification': 'SMS notification',
        'sendEmailTitle': 'Send email notification?',
        'resendEmailTitle': 'Resend email notification?',
        'sendEmailDescription': 'Send the invitation email to {guest}?',
        'resendEmailDescription': 'Send a new invitation email to {guest}? A new private link may be created when required.',
        'sendEmailAction': 'Send email',
        'resendEmailAction': 'Resend email',
        'smsUnavailableTitle': 'SMS delivery unavailable',
        'smsUnavailableDescription': 'Automatic SMS delivery is not configured yet. The phone channel remains available for manual delivery and preview workflows.',
        'shareRegenerateTitle': 'Create a new shareable link?',
        'shareRegenerateDescription': 'The current private link for {guest} cannot be displayed again. Sharing requires regenerating it, which invalidates the previous link.',
        'totalOpenings': 'Total openings: {count}',
        'guestMessageDetails': 'Guest message and request details',
        'unreadGuestMessage': 'Unread guest message or request',
        'selectGuest': 'Select {guest}',
        'selectAllGuests': 'Select all visible guests',
        'bulkActions': 'Bulk actions',
        'selectedGuests': '{count} selected',
        'clearSelection': 'Clear selection',
        'bulkArchive': 'Archive selected',
        'bulkRevoke': 'Revoke selected',
        'bulkRegenerate': 'Regenerate selected',
        'bulkArchiveTitle': 'Archive selected guests?',
        'bulkRevokeTitle': 'Revoke selected invitations?',
        'bulkRegenerateTitle': 'Regenerate selected invitations?',
        'bulkActionDescription': '{eligible} of {selected} selected guests are eligible for this action. Ineligible guests will be skipped.',
        'editingGuest': 'Editing guest',
        'originalGuestName': 'Original guest name',
        'guestStatusSummary': 'Guest and invitation status summary',
    },
    'packages/i18n/locales/es-MX/host.json': {
        'showQuickFilters': 'Mostrar filtros rápidos',
        'hideQuickFilters': 'Ocultar filtros rápidos',
        'emailNotification': 'Notificación por correo',
        'smsNotification': 'Notificación por SMS',
        'sendEmailTitle': '¿Enviar notificación por correo?',
        'resendEmailTitle': '¿Reenviar notificación por correo?',
        'sendEmailDescription': '¿Enviar el correo de invitación a {guest}?',
        'resendEmailDescription': '¿Enviar un nuevo correo de invitación a {guest}? Se puede crear un nuevo enlace privado cuando sea necesario.',
        'sendEmailAction': 'Enviar correo',
        'resendEmailAction': 'Reenviar correo',
        'smsUnavailableTitle': 'Entrega por SMS no disponible',
        'smsUnavailableDescription': 'La entrega automática por SMS todavía no está configurada. El canal telefónico permanece disponible para entrega manual y vistas previas.',
        'shareRegenerateTitle': '¿Crear un nuevo enlace para compartir?',
        'shareRegenerateDescription': 'El enlace privado actual de {guest} no puede mostrarse nuevamente. Para compartirlo es necesario regenerarlo, lo que invalida el enlace anterior.',
        'totalOpenings': 'Total de aperturas: {count}',
        'guestMessageDetails': 'Detalles del mensaje o solicitud del invitado',
        'unreadGuestMessage': 'Mensaje o solicitud del invitado sin leer',
        'selectGuest': 'Seleccionar a {guest}',
        'selectAllGuests': 'Seleccionar todos los invitados visibles',
        'bulkActions': 'Acciones masivas',
        'selectedGuests': '{count} seleccionados',
        'clearSelection': 'Limpiar selección',
        'bulkArchive': 'Archivar seleccionados',
        'bulkRevoke': 'Revocar seleccionados',
        'bulkRegenerate': 'Regenerar seleccionados',
        'bulkArchiveTitle': '¿Archivar los invitados seleccionados?',
        'bulkRevokeTitle': '¿Revocar las invitaciones seleccionadas?',
        'bulkRegenerateTitle': '¿Regenerar las invitaciones seleccionadas?',
        'bulkActionDescription': '{eligible} de {selected} invitados seleccionados pueden recibir esta acción. Los invitados no elegibles se omitirán.',
        'editingGuest': 'Editando invitado',
        'originalGuestName': 'Nombre original del invitado',
        'guestStatusSummary': 'Resumen del estado del invitado y la invitación',
    },
}

locale_outputs: dict[Path, str] = {}
for filename, values in translations.items():
    path = Path(filename)
    data = json.loads(path.read_text())
    data.update(values)
    locale_outputs[path] = json.dumps(data, ensure_ascii=False, indent=2) + '\n'


# ---------------------------------------------------------------------------
# Focused test updates
# ---------------------------------------------------------------------------

tests = test_path.read_text()

# No-contact text is now intentionally absent; the alert icon carries the explanation.
tests = tests.replace(
    "    expect(screen.getAllByText('No contact').length).toBeGreaterThan(0);\n",
    "    expect(\n"
    "      screen.getAllByRole('button', {\n"
    "        name: 'No contact · Manual delivery available · Automatic notifications unavailable',\n"
    "      }).length,\n"
    "    ).toBeGreaterThan(0);\n",
    1,
)

# Full filter dropdown is always visible; quick filters are optional.
tests = tests.replace(
    "screen.getByRole('combobox', { name: 'More filters' })",
    "screen.getByLabelText('Filter guests')",
)
tests = tests.replace("screen.getByLabelText('More filters')", "screen.getByLabelText('Filter guests')")

# RSVP details now open from the unread message/request icon in the status column.
rsvp_start = tests.find("  it('filters RSVP state and opens the host-only current response detail'")
rsvp_end = tests.find('\n  it(', rsvp_start + 5)
if rsvp_start < 0 or rsvp_end < 0:
    raise SystemExit('RSVP test range was not found')
rsvp_block = tests[rsvp_start:rsvp_end]
button_start = rsvp_block.find('    await userEvent.click(\n      screen.getAllByRole(\'button\', {')
button_end = rsvp_block.find('    expect(await screen.findByRole(\'dialog\'', button_start)
if button_start < 0 or button_end < 0:
    raise SystemExit('RSVP action block was not found')
rsvp_click = '''    expect(screen.getAllByText('Accepted').length).toBeGreaterThan(0);
    const unreadMessage = screen.getAllByRole('button', {
      name: 'Unread guest message or request',
    })[0]!;
    await userEvent.click(unreadMessage);
    expect(
      screen.getAllByRole('button', {
        name: 'Guest message and request details',
      }).length,
    ).toBeGreaterThan(0);
'''
rsvp_block = rsvp_block[:button_start] + rsvp_click + rsvp_block[button_end:]
tests = tests[:rsvp_start] + rsvp_block + tests[rsvp_end:]

# Email send moved from More actions to the email channel button and styled confirmation.
email_test_start = tests.find("  it('previews real email HTML, sends, and shares the generated invitation'")
email_test_end = tests.find('\n  it(', email_test_start + 5)
if email_test_end < 0:
    email_test_end = tests.rfind('\n});')
if email_test_start < 0 or email_test_end < 0:
    raise SystemExit('Email test range was not found')
email_block = tests[email_test_start:email_test_end]
old_send_start = email_block.find('    const guestTable = screen.getByRole(\'table\');')
old_send_end = email_block.find('    const sendRequest = fetchMock.mock.calls.find', old_send_start)
if old_send_start < 0 or old_send_end < 0:
    raise SystemExit('Old email action test block was not found')
new_send = '''    const guestTable = screen.getByRole('table');
    await userEvent.click(
      within(guestTable).getByRole('button', {
        name: /Email notification:/i,
      }),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Send email',
      }),
    );
'''
email_block = email_block[:old_send_start] + new_send + email_block[old_send_end:]
tests = tests[:email_test_start] + email_block + tests[email_test_end:]

# Opening activity is now eye + count with tooltip/help text, not an expandable panel.
activity_start = tests.find("  it('shows opening details only when opening timestamps exist'")
if activity_start >= 0:
    activity_end = tests.find('\n  it(', activity_start + 5)
    if activity_end < 0:
        raise SystemExit('Activity test end was not found')
    activity_block = tests[activity_start:activity_end]
    render_pos = activity_block.find('    mockRequests(openedGuest);')
    if render_pos < 0:
        raise SystemExit('Activity test body was not recognized')
    prefix = activity_block[:render_pos]
    replacement_body = '''    mockRequests(openedGuest);
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    expect(
      screen.getAllByLabelText('Total openings: 1').length,
    ).toBeGreaterThan(0);
'''
    activity_block = prefix + replacement_body + '  });\n'
    tests = tests[:activity_start] + activity_block + tests[activity_end:]

# Add a small bulk-selection coverage test.
bulk_title = 'shows bulk actions after selecting a guest'
if bulk_title not in tests:
    marker = "  it('uses a themed confirmation before revoking an invitation', async () => {\n"
    if marker not in tests:
        raise SystemExit('Bulk test insertion point was not found')
    bulk_test = '''  it('shows bulk actions after selecting a guest', async () => {
    mockRequests();
    render(<HostGuestPanel eventIdentifier="raymundo-6" />);

    await screen.findByRole('heading', { name: 'Family Sample' });

    await userEvent.click(
      screen.getAllByRole('checkbox', {
        name: 'Select Family Sample',
      })[0]!,
    );

    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

'''
    tests = tests.replace(marker, bulk_test + marker, 1)

# Basic stale-code assertions before leaving the repository to TypeScript/tests.
for stale in [
    'canSendInitialEmail',
    'onEmailSend:',
    'rsvpActionLabel(',
    'rsvpIndicatorClass(',
    'indicatorClassName=',
]:
    if stale in component:
        raise SystemExit(f'Stale implementation remains: {stale}')

# Transactional write: no repository file is changed until all markers and
# transformations above have succeeded.
component_path.write_text(component)
test_path.write_text(tests)
for path, output in locale_outputs.items():
    path.write_text(output)

print(f'Updated: {component_path}')
print(f'Updated: {test_path}')
for path in locale_outputs:
    print(f'Updated: {path}')
