# Domoforge VPS deployment

This runbook deploys MateMyParty directly from `/forge/matemyparty` on the existing Ubuntu VPS. It uses systemd, the existing Nginx installation, and the existing PostgreSQL 16 cluster. It does not require Docker, PM2, Kubernetes, or a cloud platform.

## Current preflight state

The 2026-07-26 inspection found:

- Ubuntu 24.04.3 LTS, 8 vCPUs, 15 GiB RAM, and 326 GiB available disk.
- Shell Node.js 22.17.0 and pnpm 11.17.0 are provided by the `sysops` NVM installation.
- System Node.js 18.19.1 remains in use by unrelated services. MateMyParty uses an isolated Node.js 22.17.0 and pnpm 11.17.0 runtime under `/opt/matemyparty/runtime`.
- PostgreSQL 16.14, Nginx 1.24.0, systemd 255, Certbot 2.9.0, and UFW are active.
- Port 3000 belongs to an unrelated `/opt/pzwebadmin` service. MateMyParty therefore uses `127.0.0.1:3200` for web and `127.0.0.1:3001` for API.
- PostgreSQL currently listens on all interfaces. Its firewall exposure and remote consumers must be audited before changing `listen_addresses`.
- Both public hostnames now resolve to this VPS at `66.179.210.180`, with no published AAAA records.
- The current operator does not have passwordless sudo. Privileged provisioning commands below require an interactive sudo session.

The direct-repository approach matches the existing `/forge` convention and avoids premature release-directory machinery. Git pins a production deployment to `origin/main` or a release tag. A pre-release deployment may target `origin/develop` or an explicit commit already contained in `origin/develop`; `/var/lib/matemyparty/previous-commit` records the rollback target.

## 1. DNS gate

Complete [dns.md](dns.md) first. Do not request a certificate while either hostname resolves away from `66.179.210.180`, and remove the current AAAA records because this VPS has no reachable global IPv6 address.

## 2. System runtime and service account

Copy the reviewed Node.js 22 runtime into an application-owned system location. This avoids changing `/usr/bin/node`, which unrelated services still use, and avoids making systemd depend on a user's NVM directory:

```bash
sudo install -d -m 0755 -o root -g root /opt/matemyparty
sudo cp -a /home/sysops/.nvm/versions/node/v22.17.0 /opt/matemyparty/runtime
sudo chown -R root:root /opt/matemyparty/runtime
sudo chmod -R go-w /opt/matemyparty/runtime
/opt/matemyparty/runtime/bin/node --version
PATH=/opt/matemyparty/runtime/bin:/usr/bin:/bin \
  /opt/matemyparty/runtime/bin/pnpm --version
```

Create a locked service account and grant read access through the existing `release` group:

```bash
sudo adduser --system --group --home /var/lib/matemyparty matemyparty
sudo usermod --append --groups release matemyparty
sudo install -d -m 0750 -o matemyparty -g matemyparty /var/lib/matemyparty
sudo -u matemyparty test -r /forge/matemyparty/package.json
```

Deployments remain owned and performed by `sysops`; the service account only runs the application.

## 3. PostgreSQL and production environment

Before changing PostgreSQL networking, identify every existing client. Prefer `listen_addresses = 'localhost'` after confirming no unrelated application requires a remote connection. Independently ensure UFW does not allow public TCP 5432.

Generate a hexadecimal database password and host token in a private administrator session. Do not put either value in shell history, command arguments, chat, or logs. Create the role and UTF-8 database through a local `postgres` session:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE matemyparty LOGIN PASSWORD 'PASTE_GENERATED_DATABASE_PASSWORD_HERE';
CREATE DATABASE matemyparty
  OWNER matemyparty
  ENCODING 'UTF8'
  TEMPLATE template0;
\q
```

Create the environment outside Git:

```bash
sudo install -d -m 0700 -o root -g root /etc/matemyparty
sudo install -m 0600 -o root -g root \
  /forge/matemyparty/.env.production.example \
  /etc/matemyparty/matemyparty.env
sudoedit /etc/matemyparty/matemyparty.env
sudo chown root:root /etc/matemyparty/matemyparty.env
sudo chmod 0600 /etc/matemyparty/matemyparty.env
```

Replace every placeholder. Use a cryptographically random `HOST_ADMIN_TOKEN` of at least 32 characters. The production file must retain `WEB_HOST=127.0.0.1`, `WEB_PORT=3200`, `API_HOST=127.0.0.1`, `API_PORT=3001`, `INTERNAL_API_BASE_URL=http://127.0.0.1:3001`, `PRIMARY_APP_HOSTNAME=matemyparty.domoforge.com`, and `PUBLIC_APP_PROTOCOL=https`.

`INTERNAL_API_BASE_URL` is server-only and deliberately has no `NEXT_PUBLIC_` prefix. The browser uses relative `/internal/host/*` requests and never receives `HOST_ADMIN_TOKEN`.

The systemd manager reads `EnvironmentFile` before dropping privileges, so the application user does not need direct read access. Root ownership also prevents the service account from injecting commands into the root-run deployment script. Verify without printing the file:

```bash
sudo stat -c '%a %U:%G %n' /etc/matemyparty/matemyparty.env
sudo test -r /etc/matemyparty/matemyparty.env
sudo -u matemyparty test ! -r /etc/matemyparty/matemyparty.env
sudo -u nobody test ! -r /etc/matemyparty/matemyparty.env
```

## 4. Install, validate, migrate, and seed

Run from a clean, reviewed checkout:

```bash
cd /forge/matemyparty
git status --short
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Load the protected environment only in a privileged shell and run migrations. Initial provisioning runs the idempotent seed twice with samples disabled:

```bash
sudo --preserve-env=PATH bash
set -a
. /etc/matemyparty/matemyparty.env
set +a
cd /forge/matemyparty
sudo -u sysops --preserve-env=DATABASE_URL pnpm db:migrate
sudo -u sysops --preserve-env=DATABASE_URL,SEED_SAMPLE_GUESTS pnpm db:seed
sudo -u sysops --preserve-env=DATABASE_URL,SEED_SAMPLE_GUESTS pnpm db:seed
exit
```

Verify that the seed retained `raymundo-6`, `raymundo6th.domoforge.com`, and `2026-08-06T18:00:00.000Z`. That instant is 1:00 p.m. in `America/Chicago` on August 6, 2026. Do not add an invented address or end time.

## 5. Install systemd services and backup timer

```bash
sudo install -m 0644 deploy/systemd/matemyparty-api.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/matemyparty-web.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/matemyparty-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/matemyparty-backup.timer /etc/systemd/system/
sudo install -d -m 0700 -o root -g root /var/backups/matemyparty
sudo systemd-analyze verify \
  /etc/systemd/system/matemyparty-api.service \
  /etc/systemd/system/matemyparty-web.service \
  /etc/systemd/system/matemyparty-backup.service \
  /etc/systemd/system/matemyparty-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now matemyparty-api.service matemyparty-web.service
sudo systemctl enable --now matemyparty-backup.timer
```

Confirm loopback-only listeners and local behavior before touching Nginx:

```bash
sudo ss -lntp '( sport = :3200 or sport = :3001 )'
curl --fail http://127.0.0.1:3001/health
curl --fail --header 'Host: matemyparty.domoforge.com' http://127.0.0.1:3200/
curl --fail --header 'Host: raymundo6th.domoforge.com' http://127.0.0.1:3200/
curl --fail http://127.0.0.1:3200/events/raymundo-6
```

## 6. Firewall review

UFW is active, but its rule list requires sudo. Do not modify SSH or unrelated application rules without a separate impact review. First capture the effective policy:

```bash
sudo ufw status verbose
sudo ufw status numbered
sudo iptables-save
sudo ip6tables-save
```

The safe MateMyParty change plan is:

1. Confirm an existing SSH allow rule and the current remote session before any edit.
2. Ensure TCP 80 and 443 are allowed for Nginx.
3. Do not add public rules for 3001 or 3200.
4. Remove any existing public allow for 5432 only after confirming no unrelated remote PostgreSQL client depends on it.
5. Keep loopback traffic allowed and recheck the SSH session after each change.

This VPS currently exposes unrelated services, including an application on public port 3000. MateMyParty does not own them, and this deployment must not stop or rewrite them. Achieving a VPS-wide policy of only SSH/HTTP/HTTPS requires a separate owner-approved audit.

## 7. Nginx before TLS

Back up any existing target, then install only the MateMyParty bootstrap site:

```bash
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
if sudo test -e /etc/nginx/sites-available/matemyparty; then
  sudo cp -a /etc/nginx/sites-available/matemyparty \
    "/etc/nginx/sites-available/matemyparty.backup.${timestamp}"
fi
sudo install -m 0644 deploy/nginx/matemyparty-bootstrap.conf \
  /etc/nginx/sites-available/matemyparty
sudo ln -sfn /etc/nginx/sites-available/matemyparty \
  /etc/nginx/sites-enabled/matemyparty
sudo nginx -t
sudo systemctl reload nginx
```

Use local resolution while public DNS remains blocked:

```bash
curl --fail --resolve matemyparty.domoforge.com:80:127.0.0.1 \
  http://matemyparty.domoforge.com/
curl --fail --resolve raymundo6th.domoforge.com:80:127.0.0.1 \
  http://raymundo6th.domoforge.com/
```

Both Nginx files suppress access-log entries whose path begins with `/i/`; error logging remains enabled. The TLS configuration also sends `no-store` for invitation and host routes. `/api/*` and `/health` go to Nest, `/internal/*` stays on Next, and `/ws/*` is reserved without claiming a websocket implementation.

## 8. TLS after DNS is correct

Confirm both A records from at least two public resolvers before running Certbot:

```bash
dig +short A matemyparty.domoforge.com @1.1.1.1
dig +short A raymundo6th.domoforge.com @8.8.8.8
```

Then use the VPS's existing Certbot workflow:

```bash
sudo certbot certonly --webroot -w /var/www/html \
  --cert-name matemyparty.domoforge.com \
  -d matemyparty.domoforge.com \
  -d raymundo6th.domoforge.com
sudo install -m 0644 deploy/nginx/matemyparty.conf \
  /etc/nginx/sites-available/matemyparty
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certificates
systemctl status certbot.timer
sudo certbot renew --dry-run
```

If Certbot requires an email and no existing account supplies one, stop and obtain the operator's real email. Keep HSTS disabled until both HTTPS hostnames and automatic renewal have remained stable.

## 9. Production checks and future deployments

Run the checks in [operations.md](operations.md), [backup-and-restore.md](backup-and-restore.md), and the acceptance checklist below. Future production deployments must target code already merged into `main`:

```bash
sudo /forge/matemyparty/deploy/scripts/deploy.sh --ref main
```

An explicitly authorized pre-release deployment can instead use the current `develop` tip without merging it to `main`:

```bash
sudo /forge/matemyparty/deploy/scripts/deploy.sh --ref develop
```

The script fetches safely, rejects a dirty tree or a commit outside the selected upstream, validates, builds, creates a pre-migration backup, migrates, restarts both services, and checks loopback health. It does not merge, push, run down migrations, or seed guests.

## Acceptance checklist

1. DNS resolves both names only to the intended VPS addresses.
2. UFW permits SSH, HTTP, and HTTPS but not 3001, 3200, or 5432.
3. PostgreSQL remote exposure has been eliminated without breaking unrelated clients.
4. The environment is mode `0600`, owned by root, and unreadable by service or other users.
5. Migrations and two seeds succeed; event data is unchanged.
6. All repository validation passes and both units are active.
7. Nginx syntax passes and only the MateMyParty site is changed.
8. Both certificate names are present, renewal is enabled, and dry-run succeeds.
9. Generic, event hostname, slug fallback, API, invitation, host session, and both locales work over HTTPS.
10. No `/i/<token>` value appears in the MateMyParty access log.
11. The backup timer is enabled and a non-empty custom-format backup has been created.

Do not claim completion for a check that has not been executed on the live service.
