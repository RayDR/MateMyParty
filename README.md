# MateMyParty

MateMyParty is a multilingual foundation for creating and operating digital invitations. The current milestone adds provider-neutral transactional invitation email, responsive localized previews, safe delivery attempts, idempotent retries, and SMTP production configuration while preserving RSVP, maps/calendar flows, and privacy-safe invitation lookup.

## Architecture

The pnpm/Turborepo workspace contains:

- `apps/web`: Next.js App Router application for both the product and event hosts.
- `apps/api`: NestJS modular monolith using Fastify.
- `packages/contracts`: Zod API response contracts and normalization logic.
- `packages/database`: PostgreSQL schema, versioned Drizzle migrations, and seed.
- `packages/i18n`: separate `en-US` and `es-MX` JSON dictionaries.
- `packages/ui`, `config`, and `typescript-config`: deliberately small shared foundations.

See [docs/architecture.md](docs/architecture.md) for boundaries and decisions. Transactional invitation email architecture, protected endpoints, lifecycle, and privacy guarantees are documented in [docs/email-delivery.md](docs/email-delivery.md).

The public platform hostname is `matemyparty.domoforge.com`; the first event remains available through `raymundo6th.domoforge.com` and the local `/events/raymundo-6` route.

Production URLs, after DNS and TLS deployment, are:

- `https://matemyparty.domoforge.com/` for the generic platform landing.
- `https://raymundo6th.domoforge.com/` for Raymundo's birthday event.

## Requirements

- Node.js 22 or newer
- pnpm 11 (Corepack can supply the pinned version)
- Docker with Compose for PostgreSQL, or a PostgreSQL 16-compatible local server

## Install

```bash
cd /forge/matemyparty
corepack enable
pnpm install
cp .env.example .env
```

The example credentials are local-development values only. Every variable is documented in `.env.example`; change them for any shared environment. Generate a private host token before shared or production use, for example with `openssl rand -hex 48`. Next reads `INTERNAL_API_BASE_URL` only on the server, while database access remains API-only. `HOST_ADMIN_TOKEN` must never use a `NEXT_PUBLIC_` prefix.

## Local development

Start only PostgreSQL, run migrations and seed, then start both applications:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000` for the product landing and `http://localhost:3000/events/raymundo-6` for the seeded event. The API is at `http://localhost:3001`; health is `GET /health`.

The public event route exposes promotional content only. Use the lookup form with a registered display name plus the complete email or phone; successful verification stores a 12-minute HttpOnly access grant and continues to `/invitation`. Existing permanent links remain available at `/i/{token}`. Both private experiences can create, update, and cancel RSVP responses, open encoded Google/Apple Maps links, use Google/Outlook calendar links, and download an Apple-compatible ICS file. Neither private route is cached or indexed. If no event end is stored, calendar-provider links use a 120-minute display fallback; ICS and database data do not invent an end time.

The temporary host panel for the seeded event uses its public slug (the random public code also works):

```text
http://localhost:3000/host/events/raymundo-6/guests
```

The protected presentation preview is at `http://localhost:3000/host/events/raymundo-6/preview`. It uses synthetic invitation data and supports public/private, language, viewport, media-disabled, and reduced-motion views without recording opens or permitting RSVP mutations.

Enter `HOST_ADMIN_TOKEN` at the access screen. The server validates it and sets a derived HttpOnly, SameSite=Strict session cookie; browser JavaScript never receives the API secret. This mechanism is provisional and must be replaced by real user authentication and event authorization.

To exercise hostname routing without editing DNS, use:

```bash
curl -H 'Host: raymundo6th.domoforge.com' http://localhost:3000/
curl http://localhost:3001/api/events/by-hostname/raymundo6th.domoforge.com
```

For a browser, add `127.0.0.1 raymundo6th.domoforge.com matemyparty.domoforge.com` to the local hosts file, then include port `3000` in the URL.

## Database workflow

`pnpm db:generate` creates a reviewed, versioned SQL migration from schema changes. `pnpm db:migrate` applies pending migrations, including `0001_real_stingray.sql` for the original guest/invitation lifecycle, `0003_regular_the_order.sql` for explicit party counts, `0004_wooden_silver_sable.sql` for short-lived invitation access grants, `0005_freezing_romulus.sql` for current RSVP state plus immutable history, `0006_smiling_sage.sql` for the current-response update-time index, `0007_cool_gideon.sql` for maps/calendar and separated social thumbnails, and `0008_fancy_yellow_claw.sql` for token-free email delivery attempts and lifecycle constraints. `pnpm db:seed` is idempotent and creates the placeholder owner, generic event, hostname mapping, and revision 1. Timestamps are UTC; the event stores `America/Chicago` separately for presentation.

Optional non-personal sample guests are inserted only when explicitly requested:

```bash
SEED_SAMPLE_GUESTS=true pnpm db:seed
```

Address, coordinates, parking details, social thumbnail, and `endsAt` remain nullable because unknown facts are not invented. No fabricated values are seeded.

## Guest and invitation API flow

Private host endpoints require the bearer token. Create a MANUAL guest:

```bash
export EVENT_IDENTIFIER=raymundo-6
export HOST_ADMIN_TOKEN='replace-with-the-value-from-your-env-file'

curl -X POST "http://localhost:3001/api/host/events/$EVENT_IDENTIFIER/guests" \
  -H "Authorization: Bearer $HOST_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Family Sample","preferredChannel":"MANUAL","locale":"en-US","invitationCountMode":"TOTAL_ONLY","totalInvited":4,"createInvitation":false}'
```

Copy the returned guest `id`, then create its invitation:

```bash
export GUEST_ID='guest-uuid-from-the-previous-response'
curl -X POST "http://localhost:3001/api/host/guests/$GUEST_ID/invitations" \
  -H "Authorization: Bearer $HOST_ADMIN_TOKEN"
```

The creation response is the only time the raw `token` is available. MateMyParty stores SHA-256 only and has no recovery endpoint. Open the returned `publicUrl`, or locally:

```text
http://localhost:3000/i/{token}
```

List guests, including archived records:

```bash
curl "http://localhost:3001/api/host/events/$EVENT_IDENTIFIER/guests?includeArchived=true" \
  -H "Authorization: Bearer $HOST_ADMIN_TOKEN"
```

## Quality and main commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm docker:up
pnpm docker:down
```

`pnpm docker:up` builds and starts PostgreSQL, applies migrations/seed through the API service, and starts API and web with health checks. Data persists in the named `matemyparty_postgres_data` volume.

## Tests

Contracts and frontend components use Vitest. The Nest API uses Jest. Run all suites with `pnpm test`; coverage includes public DTO privacy, RSVP states and attendance bounds, token/grant access, maps URL encoding and fallback, ICS escaping/CRLF/UID/privacy, calendar access, countdown states, safe metadata, SMS previews, locale priority, media fallbacks, presentation modes, and protected preview.

See [docs/security.md](docs/security.md) before exposing any environment publicly.

## Development workflow and deployment

Feature work branches from `develop` into `feature/*`, merges back through review, and reaches `main` only as a stable release. Hotfixes branch from `main`. See [docs/git-workflow.md](docs/git-workflow.md).

The initial production target is one Ubuntu VPS with PostgreSQL, two systemd application services, a backup timer, and Nginx handling both public hostnames, TLS, API routing, and future websocket upgrades. See [deployment](docs/deployment.md), [operations](docs/operations.md), [DNS](docs/dns.md), and [backup and restore](docs/backup-and-restore.md), plus the examples under `deploy/`.

## License

MateMyParty uses the [MIT License](LICENSE). MIT is recommended at this stage because it is short, widely understood, permissive for future commercial or community use, and still preserves copyright and warranty disclaimers.
