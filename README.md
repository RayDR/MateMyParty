# MateMyParty

MateMyParty is a multilingual foundation for creating and operating digital invitations. The current milestone preserves Raymundo's sixth birthday as a generic event and adds guest management, secure individual invitation links, a temporary host panel, and initial open tracking.

## Architecture

The pnpm/Turborepo workspace contains:

- `apps/web`: Next.js App Router application for both the product and event hosts.
- `apps/api`: NestJS modular monolith using Fastify.
- `packages/contracts`: Zod API response contracts and normalization logic.
- `packages/database`: PostgreSQL schema, versioned Drizzle migrations, and seed.
- `packages/i18n`: separate `en-US` and `es-MX` JSON dictionaries.
- `packages/ui`, `config`, and `typescript-config`: deliberately small shared foundations.

See [docs/architecture.md](docs/architecture.md) for boundaries and decisions.

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

The temporary host panel for the seeded event uses its public slug (the random public code also works):

```text
http://localhost:3000/host/events/raymundo-6/guests
```

Enter `HOST_ADMIN_TOKEN` at the access screen. The server validates it and sets a derived HttpOnly, SameSite=Strict session cookie; browser JavaScript never receives the API secret. This mechanism is provisional and must be replaced by real user authentication and event authorization.

To exercise hostname routing without editing DNS, use:

```bash
curl -H 'Host: raymundo6th.domoforge.com' http://localhost:3000/
curl http://localhost:3001/api/events/by-hostname/raymundo6th.domoforge.com
```

For a browser, add `127.0.0.1 raymundo6th.domoforge.com matemyparty.domoforge.com` to the local hosts file, then include port `3000` in the URL.

## Database workflow

`pnpm db:generate` creates a reviewed, versioned SQL migration from schema changes. `pnpm db:migrate` applies pending migrations, including `0001_real_stingray.sql` for the original guest/invitation lifecycle and `0003_regular_the_order.sql` for explicit total-only or adult/child invitation counts. `pnpm db:seed` is idempotent and creates the placeholder owner, generic event, hostname mapping, and revision 1. Timestamps are UTC; the event stores `America/Chicago` separately for presentation.

Optional non-personal sample guests are inserted only when explicitly requested:

```bash
SEED_SAMPLE_GUESTS=true pnpm db:seed
```

Address fields and `endsAt` are nullable because those facts are not yet known. No fabricated values are seeded.

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

Contracts and frontend components use Vitest. The Nest API uses Jest. Run all suites with `pnpm test`; coverage includes guest semantics, token generation and hashing, host protection, invitation opening/regeneration/revocation, public DTO privacy, translation parity, personalized invitation rendering, and the host panel in addition to the original foundation.

See [docs/security.md](docs/security.md) before exposing any environment publicly.

## Development workflow and deployment

Feature work branches from `develop` into `feature/*`, merges back through review, and reaches `main` only as a stable release. Hotfixes branch from `main`. See [docs/git-workflow.md](docs/git-workflow.md).

The initial production target is one Ubuntu VPS with PostgreSQL, two systemd application services, a backup timer, and Nginx handling both public hostnames, TLS, API routing, and future websocket upgrades. See [deployment](docs/deployment.md), [operations](docs/operations.md), [DNS](docs/dns.md), and [backup and restore](docs/backup-and-restore.md), plus the examples under `deploy/`.

## License

MateMyParty uses the [MIT License](LICENSE). MIT is recommended at this stage because it is short, widely understood, permissive for future commercial or community use, and still preserves copyright and warranty disclaimers.
