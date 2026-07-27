# Architecture

## Modular monolith

MateMyParty starts as a modular monolith: one web application, one API process, and one PostgreSQL database. This keeps deployment and local development fast while preserving explicit module boundaries. Features that need no independent scaling or lifecycle do not become services prematurely.

## Hosts and event resolution

`matemyparty.domoforge.com` is the generic product surface. Other hosts, beginning with `raymundo6th.domoforge.com`, are data-driven aliases stored in `event_domains`. Next proxy logic rewrites an event host to an internal route, and the server component asks the same API used by `/events/:slug`. Individual `/i/:token` and verified `/invitation` routes bypass hostname rewriting. There are not two applications or two data models.

The initial birthday is an ordinary `Event` owned by a `User`, with a replaceable template key. As the platform grows it remains queryable, and revisions retain its historical snapshots.

Host-facing routes identify events by their normalized public slug and fall back to an 8-character cryptographically random public code. UUIDs remain primary and foreign keys inside the API and database, but are not part of host navigation. PostgreSQL enforces code uniqueness; API allocation retries the negligible collision case.

## Boundaries

- `apps/web` renders public experiences and talks only to HTTP contracts.
- `apps/api` is the data authority and contains modular controllers, services, and repositories.
- `packages/contracts` defines runtime-safe public DTOs with Zod.
- `packages/database` owns the Drizzle schema, migrations, connection, and seed.

The web app never imports the database package. Repositories are the only current location for event queries; controllers do not contain SQL. Public responses are parsed through shared Zod contracts both when the API presents them and when the web application consumes them.

## Internationalization

Locales are event data, independent from domains and users. `en-US` and `es-MX` dictionaries are separate JSON resources split into namespaces. UI components consume dictionaries, not visible-text locale conditionals. Public pages choose the manual language cookie first, then invitation locale, browser `Accept-Language`, event default, and finally `en-US`. Dates are stored in UTC and formatted with the event's IANA time zone.

Editable invitation content lives in `event_localizations`, one row per event and supported locale. The canonical columns on `events` mirror the selected default locale for compatibility with the existing public API. Host updates require both supported locales and update the canonical view and localized rows in one transaction.

## Revisions

`EventRevision` records a monotonic revision number and JSONB snapshot. The seed creates revision 1. Host event updates lock the event row, update event and localization data, and create the next `HOST_EVENT_UPDATE` revision in the same transaction. This is an audit/history foundation, not yet a restore engine.

## Host event management

`/host/access` is the temporary server-rendered entry point. Its POST is rewritten to a server-only handler, which creates the derived HttpOnly session and redirects to `/host/events` using the forwarded public HTTPS hostname. The dashboard and editor use protected Next route handlers; those handlers validate the cookie and attach the bearer token only on the server.

The API remains authoritative for dashboard statistics, event reads, validation, updates, and revision creation. Controllers contain no SQL. `/api/host/events/:identifier` resolves either a slug or public code internally, and guest routes use the same identifier resolution.

Event media is referenced rather than uploaded in this milestone. See [event-media.md](event-media.md) for the protected path contract and deployment permissions.

## Guests and invitations

`Guest` describes a person, family, or group and contains host-private contact and planning data. `Invitation` is a separate lifecycle record with a public credential, open counters, and revocation state. This separation permits a guest to survive historical invitation replacements and permits revoked links to remain auditable. Archiving is a timestamped soft delete and never removes invitations or activity.

Guest party size is explicit. `TOTAL_ONLY` stores one non-negative total and no adult/child values. `ADULTS_AND_CHILDREN` stores both non-negative components and a database-checked derived total. The API repeats these rules in the shared Zod contract so browser, service, and PostgreSQL semantics agree. Notification eligibility is derived from the preferred channel and normalized contact fields; no delivery attempt is stored until a delivery provider exists.

A partial unique index on `guest_id WHERE revoked_at IS NULL` permits only one active invitation per guest. Regeneration revokes rather than overwrites the previous row, then inserts a new invitation in the same transaction.

## Token strategy and lifecycle

Creation uses 32 cryptographically random bytes encoded as 43 base64url characters. The raw token is returned once. PostgreSQL stores a SHA-256 hash and an eight-character diagnostic prefix; the prefix narrows lookup candidates and a timing-safe comparison confirms the full hash. There is deliberately no token recovery endpoint.

The current lifecycle is `READY` to `OPENED`, with `SENT` reserved for a later delivery milestone. `REVOKED` is terminal. Regeneration creates a distinct `READY` record. Every create, open, revoke, and regeneration produces `InvitationActivity`; it does not replace `EventRevision`.

Token candidate queries join the guest row and require both `invitations.revoked_at IS NULL` and `guests.archived_at IS NULL`. Private-detail resolution repeats those predicates inside the tracking transaction. Restoring an archived guest makes its still-active historical invitation eligible again; regeneration remains the explicit way to issue a different permanent credential.

Protected share-preview data contains only localized event title, generic copy, hostname, and event thumbnail metadata. Public Open Graph metadata is built from the same safe event-only fields. Guest names remain page personalization and are never copied into social metadata.

## Open tracking

Public resolution and tracking are one database transaction. The first open uses `coalesce` to set `first_opened_at` once, every open updates `last_opened_at`, and an atomic SQL expression increments `open_count`. Activity metadata is limited to a shortened user agent, requested supported locale, and referrer hostname. IP addresses are not recorded.

The Next server fetches a private invitation once per render with React request memoization and no persistent fetch cache. The response contract excludes UUIDs, contacts, private notes, hashes, prefixes, and owner data.

## Public invitation experience

The event root consumes `PublicEventLanding`, an allowlisted promotional contract that cannot contain schedule, location, guest, or invitation state. Lookup posts the display name and a complete email or phone to a server-side Next handler. Exact matching creates a 12-minute `InvitationAccessGrant`; only its SHA-256 hash and diagnostic prefix persist. The raw grant is placed directly into an HttpOnly cookie and is never exposed to client JavaScript or substituted for the unrecoverable permanent invitation token.

Both direct `/i/{token}` access and verified `/invitation` access resolve to the same `PrivateInvitation` renderer and open-tracking transaction. Permanent tokens and temporary grants have separate tables, lifetimes, and revocation behavior. Successful lookup alone does not increment analytics.

`ThemedInvitationStage` is configuration-driven. Template keys select one of `NIGHT_DRAGON_FLIGHT`, `ADVENTURE_GATES`, `ENVELOPE_REVEAL`, or `WINTER_SNOW`; visible names come from i18n dictionaries. The stage keeps a static or gradient layer behind optional muted inline video, starts audio only after user interaction, provides playback controls, and removes video/long animation for reduced motion. Container-responsive layouts let the protected preview reproduce mobile, tablet, and desktop widths without Raymundo-specific component branches.

`/host/events/:identifier/preview` requires the host session and fetches synthetic preview data from the bearer-protected API. It can switch public/private experience, locale, viewport, media, and motion settings. The preview presenter does not query a guest or invitation and cannot call open tracking.

## Temporary host protection

Nest host controllers use a reusable timing-safe bearer-token guard. Production startup rejects a missing, short, or known example token. The web access form compares the secret only on the server and stores a derived HMAC value in an HttpOnly, SameSite=Strict cookie. Internal Next routes validate that cookie and add the bearer token server-side, so browser JavaScript never receives `HOST_ADMIN_TOKEN`.

This is intentionally isolated temporary protection. Real authentication will replace the access route and cookie with user sessions, and event-level authorization will verify ownership before host operations. API controllers and services remain reusable when that replacement occurs.

## Future providers

Email, SMS, object storage, calendar integrations, payments, and AI can later sit behind provider interfaces owned by their feature modules. No provider or infrastructure is installed before a use case needs it. RSVP remains the next domain milestone.
