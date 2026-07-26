# Architecture

## Modular monolith

MateMyParty starts as a modular monolith: one web application, one API process, and one PostgreSQL database. This keeps deployment and local development fast while preserving explicit module boundaries. Features that need no independent scaling or lifecycle do not become services prematurely.

## Hosts and event resolution

`matemyparty.domoforge.com` is the generic product surface. Other hosts, beginning with `raymundo6th.domoforge.com`, are data-driven aliases stored in `event_domains`. Next proxy logic rewrites an event host to an internal route, and the server component asks the same API used by `/events/:slug`. Individual `/i/:token` routes remain public routes on either hostname. There are not two applications or two data models.

The initial birthday is an ordinary `Event` owned by a `User`, with a replaceable template key. As the platform grows it remains queryable, and revisions retain its historical snapshots.

## Boundaries

- `apps/web` renders public experiences and talks only to HTTP contracts.
- `apps/api` is the data authority and contains modular controllers, services, and repositories.
- `packages/contracts` defines runtime-safe public DTOs with Zod.
- `packages/database` owns the Drizzle schema, migrations, connection, and seed.

The web app never imports the database package. Repositories are the only current location for event queries; controllers do not contain SQL.

## Internationalization

Locales are event data, independent from domains and users. `en-US` and `es-MX` dictionaries are separate JSON resources split into common and event namespaces. UI components consume dictionaries, not locale conditionals. Dates are stored in UTC and formatted with the event's IANA time zone.

## Revisions

`EventRevision` records a monotonic revision number and JSONB snapshot. The seed creates revision 1. This is an audit/history foundation, not yet a restore engine; later write use cases should create revisions in the same database transaction as important changes.

## Guests and invitations

`Guest` describes a person, family, or group and contains host-private contact and planning data. `Invitation` is a separate lifecycle record with a public credential, open counters, and revocation state. This separation permits a guest to survive historical invitation replacements and permits revoked links to remain auditable. Archiving is a timestamped soft delete and never removes invitations or activity.

A partial unique index on `guest_id WHERE revoked_at IS NULL` permits only one active invitation per guest. Regeneration revokes rather than overwrites the previous row, then inserts a new invitation in the same transaction.

## Token strategy and lifecycle

Creation uses 32 cryptographically random bytes encoded as 43 base64url characters. The raw token is returned once. PostgreSQL stores a SHA-256 hash and an eight-character diagnostic prefix; the prefix narrows lookup candidates and a timing-safe comparison confirms the full hash. There is deliberately no token recovery endpoint.

The current lifecycle is `READY` to `OPENED`, with `SENT` reserved for a later delivery milestone. `REVOKED` is terminal. Regeneration creates a distinct `READY` record. Every create, open, revoke, and regeneration produces `InvitationActivity`; it does not replace `EventRevision`.

## Open tracking

Public resolution and tracking are one database transaction. The first open uses `coalesce` to set `first_opened_at` once, every open updates `last_opened_at`, and an atomic SQL expression increments `open_count`. Activity metadata is limited to a shortened user agent, requested supported locale, and referrer hostname. IP addresses are not recorded.

The Next server fetches a public invitation once per render with React request memoization and no persistent fetch cache. The response contract excludes UUIDs, contacts, private notes, hashes, prefixes, and owner data.

## Temporary host protection

Nest host controllers use a reusable timing-safe bearer-token guard. Production startup rejects a missing, short, or known example token. The web access form compares the secret only on the server and stores a derived HMAC value in an HttpOnly, SameSite=Strict cookie. Internal Next routes validate that cookie and add the bearer token server-side, so browser JavaScript never receives `HOST_ADMIN_TOKEN`.

This is intentionally isolated temporary protection. Real authentication will replace the access route and cookie with user sessions, and event-level authorization will verify ownership before host operations. API controllers and services remain reusable when that replacement occurs.

## Future providers

Email, SMS, object storage, calendar integrations, payments, and AI can later sit behind provider interfaces owned by their feature modules. No provider or infrastructure is installed before a use case needs it. RSVP remains the next domain milestone.
