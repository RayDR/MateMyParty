'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { HostGuest } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';

type Filter = 'all' | 'without' | 'notOpened' | 'opened' | 'archived';
type InvitationResult = { invitation: NonNullable<HostGuest['invitation']>; publicUrl: string };

export function HostGuestPanel({ eventId }: { eventId: string }) {
  const [locale, setLocale] = useState<Locale>('en-US');
  const [guests, setGuests] = useState<HostGuest[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<HostGuest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const dictionary = getDictionary(locale);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/internal/host/events/${eventId}/guests?includeArchived=true`, {
      cache: 'no-store',
    });
    if (response.ok) {
      setGuests((await response.json()) as HostGuest[]);
      setError(false);
    } else setError(true);
    setLoading(false);
  }, [eventId]);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      guests.filter((guest) => {
        if (filter === 'without') return !guest.archivedAt && !guest.invitation;
        if (filter === 'notOpened')
          return (
            !guest.archivedAt && Boolean(guest.invitation) && guest.invitation!.openCount === 0
          );
        if (filter === 'opened') return !guest.archivedAt && (guest.invitation?.openCount ?? 0) > 0;
        if (filter === 'archived') return Boolean(guest.archivedAt);
        return !guest.archivedAt;
      }),
    [filter, guests],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const number = (name: string) => (value(name) ? Number(value(name)) : null);
    const preferredChannel = value('preferredChannel');
    const payload = {
      displayName: value('displayName'),
      contactName: value('contactName') || null,
      email: preferredChannel === 'MANUAL' ? null : value('email') || null,
      phone: preferredChannel === 'MANUAL' ? null : value('phone') || null,
      preferredChannel,
      locale: value('locale'),
      adultsPlanned: number('adultsPlanned'),
      childrenPlanned: number('childrenPlanned'),
      privateNotes: value('privateNotes') || null,
      ...(!editing ? { createInvitation: form.get('createInvitation') === 'on' } : {}),
    };
    const response = await fetch(
      editing ? `/internal/host/guests/${editing.id}` : `/internal/host/events/${eventId}/guests`,
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
    const result = (await response.json()) as HostGuest | (InvitationResult & { guest: HostGuest });
    if ('publicUrl' in result)
      setLinks((current) => ({ ...current, [result.invitation.id]: result.publicUrl }));
    setEditing(null);
    event.currentTarget.reset();
    await load();
  }

  async function action(path: string, confirmation?: string): Promise<InvitationResult | null> {
    if (confirmation && !window.confirm(confirmation)) return null;
    const response = await fetch(path, { method: 'POST' });
    if (!response.ok) {
      setError(true);
      return null;
    }
    const result = (await response.json()) as InvitationResult;
    if (result.publicUrl)
      setLinks((current) => ({ ...current, [result.invitation.id]: result.publicUrl }));
    await load();
    return result;
  }

  async function copy(id: string) {
    const link = links[id];
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(id);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">{dictionary.host.title}</h1>
            <p className="mt-2 text-xs text-amber-200">{dictionary.host.provisionalWarning}</p>
          </div>
          <label className="text-sm">
            {dictionary.host.language}
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="ml-3 rounded-lg bg-slate-800 p-2"
            >
              <option value="en-US">{dictionary.common.english}</option>
              <option value="es-MX">{dictionary.common.spanish}</option>
            </select>
          </label>
        </header>
        {error ? (
          <p className="mb-4 rounded-xl bg-red-500/15 p-3 text-red-200">
            {dictionary.host.actionError}
          </p>
        ) : null}
        <Card>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
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
            <Field
              name="email"
              label={dictionary.host.email}
              type="email"
              defaultValue={editing?.email}
            />
            <Field name="phone" label={dictionary.host.phone} defaultValue={editing?.phone} />
            <Select
              name="preferredChannel"
              label={dictionary.host.preferredChannel}
              defaultValue={editing?.preferredChannel ?? 'MANUAL'}
              options={[
                ['MANUAL', dictionary.host.manual],
                ['EMAIL', dictionary.host.email],
                ['SMS', dictionary.host.phone],
                ['BOTH', dictionary.host.both],
              ]}
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
            <Field
              name="adultsPlanned"
              label={dictionary.host.adultsPlanned}
              type="number"
              defaultValue={editing?.adultsPlanned}
            />
            <Field
              name="childrenPlanned"
              label={dictionary.host.childrenPlanned}
              type="number"
              defaultValue={editing?.childrenPlanned}
            />
            <Field
              name="privateNotes"
              label={dictionary.host.privateNotes}
              defaultValue={editing?.privateNotes}
            />
            {!editing ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="createInvitation" />
                {dictionary.host.includeInvitation}
              </label>
            ) : null}
            <div className="flex gap-2 md:col-span-3">
              <button className="rounded-xl bg-violet-500 px-4 py-2 font-bold">
                {editing ? dictionary.host.save : dictionary.host.createGuest}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl bg-slate-700 px-4 py-2"
                >
                  {dictionary.host.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </Card>
        <div className="my-6">
          <label className="text-sm">
            {dictionary.host.filter}
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="ml-3 rounded-lg bg-slate-800 p-2"
            >
              <option value="all">{dictionary.host.filterAll}</option>
              <option value="without">{dictionary.host.filterWithoutInvitation}</option>
              <option value="notOpened">{dictionary.host.filterNotOpened}</option>
              <option value="opened">{dictionary.host.filterOpened}</option>
              <option value="archived">{dictionary.host.filterArchived}</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p>{dictionary.host.loading}</p>
        ) : filtered.length === 0 ? (
          <p>{dictionary.host.noGuests}</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((guest) => (
              <Card key={guest.id}>
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{guest.displayName}</h2>
                    <p className="text-sm text-slate-300">
                      {guest.invitation?.status ?? dictionary.host.noInvitation}
                    </p>
                    {guest.invitation ? (
                      <p className="mt-2 text-sm">
                        {dictionary.host.openCount}: {guest.invitation.openCount} ·{' '}
                        {dictionary.host.firstOpened}:{' '}
                        {formatDate(guest.invitation.firstOpenedAt, locale, dictionary.host.never)}{' '}
                        · {dictionary.host.lastOpened}:{' '}
                        {formatDate(guest.invitation.lastOpenedAt, locale, dictionary.host.never)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!guest.archivedAt ? (
                      <>
                        <button
                          onClick={() => setEditing(guest)}
                          className="rounded-lg bg-slate-700 px-3 py-2"
                        >
                          {dictionary.host.edit}
                        </button>
                        <button
                          onClick={() => void action(`/internal/host/guests/${guest.id}/archive`)}
                          className="rounded-lg bg-slate-700 px-3 py-2"
                        >
                          {dictionary.host.archive}
                        </button>
                      </>
                    ) : null}
                    {!guest.archivedAt && !guest.invitation ? (
                      <button
                        onClick={() => void action(`/internal/host/guests/${guest.id}/invitations`)}
                        className="rounded-lg bg-violet-600 px-3 py-2"
                      >
                        {dictionary.host.createInvitation}
                      </button>
                    ) : null}
                    {guest.invitation && links[guest.invitation.id] ? (
                      <button
                        onClick={() => void copy(guest.invitation!.id)}
                        className="rounded-lg bg-cyan-700 px-3 py-2"
                      >
                        {copied === guest.invitation.id
                          ? dictionary.host.copied
                          : dictionary.host.copyLink}
                      </button>
                    ) : null}
                    {guest.invitation && !guest.invitation.revokedAt ? (
                      <>
                        <button
                          onClick={() =>
                            void action(
                              `/internal/host/invitations/${guest.invitation!.id}/revoke`,
                              dictionary.host.confirmRevoke,
                            )
                          }
                          className="rounded-lg bg-red-800 px-3 py-2"
                        >
                          {dictionary.host.revoke}
                        </button>
                        <button
                          onClick={() =>
                            void action(
                              `/internal/host/invitations/${guest.invitation!.id}/regenerate`,
                              dictionary.host.confirmRegenerate,
                            )
                          }
                          className="rounded-lg bg-amber-700 px-3 py-2"
                        >
                          {dictionary.host.regenerate}
                        </button>
                      </>
                    ) : guest.invitation && !guest.archivedAt ? (
                      <button
                        onClick={() =>
                          void action(
                            `/internal/host/invitations/${guest.invitation!.id}/regenerate`,
                            dictionary.host.confirmRegenerate,
                          )
                        }
                        className="rounded-lg bg-amber-700 px-3 py-2"
                      >
                        {dictionary.host.regenerate}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
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
        key={String(defaultValue)}
        name={name}
        type={type}
        min={type === 'number' ? 0 : undefined}
        required={required}
        defaultValue={defaultValue ?? ''}
        className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-2"
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
        key={defaultValue}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-2"
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
function formatDate(value: string | null, locale: Locale, fallback: string) {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    : fallback;
}
