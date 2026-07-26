# VPS deployment

This runbook deploys the complete MateMyParty modular monolith to one Ubuntu VPS with nginx, two systemd services, and PostgreSQL. It intentionally avoids Kubernetes, cloud-specific services, and additional runtime infrastructure.

## Topology

- nginx terminates TLS for `matemyparty.domoforge.com` and `raymundo6th.domoforge.com`.
- Both hostnames proxy page requests to the same Next.js process on `127.0.0.1:3000`; the existing `Host` header keeps event-domain resolution data-driven.
- `/api/*`, `/health`, and the reserved `/ws/*` path proxy to NestJS/Fastify on `127.0.0.1:3001`.
- Browser host-panel requests use `/internal/host/*`, which remains on Next.js so the API bearer token never enters browser JavaScript.
- PostgreSQL listens locally and is the only persistent service.

nginx remains the recommended proxy. It is already mature for TLS, HTTP/2, compression, websocket upgrades, multiple hostnames, static assets, and upstream health isolation. Caddy would simplify certificate issuance, but that benefit does not justify replacing established VPS nginx operations at this stage.

## 1. DNS and firewall

Create `A` records for both hostnames pointing to the VPS. Add `AAAA` only when IPv6 is configured correctly. Confirm propagation before requesting certificates.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do not expose ports 3000, 3001, or 5432 publicly.

## 2. Ubuntu packages and Node.js

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx postgresql postgresql-contrib certbot openssl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
node --version
pnpm --version
```

The project pins pnpm in `package.json`. The systemd units resolve `pnpm` through their explicit restricted `PATH`; confirm that `command -v pnpm` returns `/usr/local/bin/pnpm` or `/usr/bin/pnpm` before enabling them.

## 3. Service account and checkout

```bash
sudo adduser --system --group --home /opt/matemyparty matemyparty
sudo -u matemyparty git clone https://github.com/RayDR/MateMyParty.git /opt/matemyparty
cd /opt/matemyparty
sudo -u matemyparty pnpm install --frozen-lockfile
```

Deploy tags or reviewed `main` commits, not an arbitrary development branch.

## 4. PostgreSQL

Create a distinct role and database. Substitute a generated password and store it only in the production environment file.

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE matemyparty LOGIN PASSWORD 'REPLACE_WITH_A_RANDOM_DATABASE_PASSWORD';
CREATE DATABASE matemyparty OWNER matemyparty;
\q
```

Keep PostgreSQL bound to loopback. Establish automated encrypted backups before collecting real guest data.

## 5. Production environment

```bash
sudo install -d -m 0750 -o root -g matemyparty /etc/matemyparty
sudo install -m 0640 -o root -g matemyparty .env.production.example /etc/matemyparty/matemyparty.env
sudo editor /etc/matemyparty/matemyparty.env
```

Generate the host token with `openssl rand -base64 48`. Replace both placeholders. Never place this file under `/opt/matemyparty`, expose the host token through `NEXT_PUBLIC_*`, or reuse development credentials.

Variable reference:

- `NODE_ENV`: `production` activates production safety checks.
- `WEB_PORT` and `API_PORT`: loopback upstream ports used by nginx.
- `DATABASE_URL`: PostgreSQL connection used only by API/database commands.
- `NEXT_PUBLIC_API_BASE_URL`: server-side API origin for Next.js; use loopback on the VPS.
- `APP_VERSION`: health endpoint and release identifier.
- `DEFAULT_LOCALE` and `SUPPORTED_LOCALES`: locale defaults and allow-list.
- `PRIMARY_APP_HOSTNAME`: generic platform hostname and invitation fallback.
- `HOST_ADMIN_TOKEN`: temporary host bearer secret; minimum 32 strong characters.
- `PUBLIC_APP_PROTOCOL`: `https` for generated production invitation URLs.
- `SEED_SAMPLE_GUESTS`: keep `false` in production.

## 6. Build, migrations, and seed

Back up the database before every migration.

```bash
cd /opt/matemyparty
set -a
. /etc/matemyparty/matemyparty.env
set +a
sudo -u matemyparty --preserve-env=NODE_ENV,DATABASE_URL,APP_VERSION,DEFAULT_LOCALE,SUPPORTED_LOCALES,PRIMARY_APP_HOSTNAME,HOST_ADMIN_TOKEN,PUBLIC_APP_PROTOCOL,SEED_SAMPLE_GUESTS pnpm build
sudo -u matemyparty --preserve-env=DATABASE_URL pnpm db:migrate
sudo -u matemyparty --preserve-env=DATABASE_URL,SEED_SAMPLE_GUESTS pnpm db:seed
```

The seed is idempotent. It preserves the original birthday event; production must keep `SEED_SAMPLE_GUESTS=false`.

## 7. systemd

```bash
sudo install -m 0644 deploy/systemd/matemyparty-api.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/matemyparty-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now matemyparty-api matemyparty-web
sudo systemctl status matemyparty-api matemyparty-web
```

Both services restart after failures with a five-second delay. Migrations are deliberately not an `ExecStartPre`; deployment runs them once under operator control. Logs go to the journal:

```bash
journalctl -u matemyparty-api -f
journalctl -u matemyparty-web -f
```

Test loopback before enabling nginx:

```bash
curl --fail http://127.0.0.1:3001/health
curl --fail -H 'Host: raymundo6th.domoforge.com' http://127.0.0.1:3000/
```

## 8. nginx and certificates

Use the HTTP bootstrap config first:

```bash
sudo install -m 0644 deploy/nginx/matemyparty-bootstrap.conf /etc/nginx/sites-available/matemyparty
sudo ln -sfn /etc/nginx/sites-available/matemyparty /etc/nginx/sites-enabled/matemyparty
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/html \
  --cert-name matemyparty.domoforge.com \
  -d matemyparty.domoforge.com \
  -d raymundo6th.domoforge.com
```

Install the production configuration after certificate issuance:

```bash
sudo install -m 0644 deploy/nginx/matemyparty.conf /etc/nginx/sites-available/matemyparty
sudo nginx -t
sudo systemctl reload nginx
systemctl status certbot.timer
```

The production config supports HTTP/2, gzip, security headers, API routing, hostname preservation, and future websocket upgrades. HSTS is staged but commented out. Enable it only after both hostnames and certificate renewal have remained stable; HSTS can prevent an easy HTTP rollback, and `includeSubDomains` affects every Domoforge subdomain if applied at a parent domain.

## 9. Deployment checklist

1. CI is green on the exact commit/tag.
2. Database backup completed and restore method verified.
3. `.env.production` placeholders replaced; permissions are `0640 root:matemyparty`.
4. Dependencies installed with the frozen lockfile.
5. `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
6. Drizzle migrations applied once; seed executed with samples disabled.
7. API and web services are active and journal logs contain no secrets or invitation URLs.
8. `nginx -t` passed; certificate includes both hostnames.
9. `/health`, platform page, birthday hostname, event path, one controlled invitation, and host panel verified.
10. External ports 3000, 3001, and 5432 remain closed.

Smoke tests:

```bash
curl --fail https://matemyparty.domoforge.com/health
curl --fail https://matemyparty.domoforge.com/
curl --fail https://raymundo6th.domoforge.com/
curl --fail https://matemyparty.domoforge.com/events/raymundo-6
```

Do not paste real invitation tokens into shell history or shared deployment logs.

## 10. Rollback checklist

1. Stop web traffic or enable a maintenance response if data compatibility is uncertain.
2. Capture API/web journal output and the failing release identifier.
3. Stop both services: `sudo systemctl stop matemyparty-web matemyparty-api`.
4. Check out the prior known-good tag under `/opt/matemyparty` and run `pnpm install --frozen-lockfile && pnpm build`.
5. Drizzle migrations are forward-only in this repository. Do not manually reverse SQL. Restore the pre-deployment PostgreSQL backup when the old application cannot read the new schema.
6. Confirm the prior environment file remains compatible.
7. Start API, verify `/health`, then start web and run hostname smoke tests.
8. Reload nginx only when its configuration changed.
9. Record the incident and follow with a `hotfix/*` branch from `main`.

For the current additive migrations, application rollback is normally safe, but database backup remains mandatory.
