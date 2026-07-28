# Operations

This runbook assumes the production layout documented in [deployment.md](deployment.md).

## Service status and control

```bash
sudo systemctl status matemyparty-api.service matemyparty-web.service
sudo systemctl restart matemyparty-api.service
sudo systemctl restart matemyparty-web.service
sudo systemctl stop matemyparty-web.service matemyparty-api.service
sudo systemctl start matemyparty-api.service matemyparty-web.service
```

Restart API first and verify health before restarting web. Routine application deployments should use `deploy/scripts/deploy.sh`, not ad hoc Git operations.

## Logs

```bash
sudo journalctl -u matemyparty-api.service --since '30 minutes ago'
sudo journalctl -u matemyparty-web.service --since '30 minutes ago'
sudo tail -n 100 /var/log/nginx/matemyparty.error.log
sudo tail -n 100 /var/log/nginx/matemyparty.access.log
```

Never paste host tokens, database URLs, cookies, or invitation URLs into tickets or chat. Nginx conditionally suppresses `/i/` access entries. Check that no raw invitation path was recorded:

```bash
sudo grep -E '/i/[^ ?]+' /var/log/nginx/matemyparty.access.log
```

The expected result is no output. Do not disable the error log globally.

## Invitation email delivery

The API uses a provider-neutral adapter; production currently selects the SMTP adapter through the protected environment file. A successful SMTP handoff is recorded as `SENT`, not `DELIVERED`: SMTP acceptance cannot prove inbox delivery. `DELIVERED` is reserved for a future authenticated provider event. Failed attempts store only bounded, operator-safe categories; recipient addresses, credentials, raw provider errors, and invitation tokens are excluded.

The host panel can preview responsive HTML without creating a token, send a test template without creating a delivery attempt, and explicitly generate or rotate an invitation when sending. A rotation invalidates the previous raw link. Idempotency keys, a per-guest database lock, an in-progress guard, bounded concurrency, and rate limiting protect repeated and concurrent requests. On API startup, stale `SENDING` attempts older than 15 minutes become retryable failures.

To inspect aggregate state without revealing recipients:

```bash
sudo -u postgres psql -d matemyparty -c \
  "select status, count(*) from email_delivery_attempts group by status order by status"
sudo journalctl -u matemyparty-api.service --since '30 minutes ago' \
  | grep -E 'EMAIL_|SMTP_' || true
```

Never query or paste `recipient_hash`, `provider_message_id`, subjects, or invitation identifiers into tickets. For a provider outage, keep the service running, verify provider status and protected configuration, then retry only from the host panel. A retry deliberately rotates the invitation link. Do not edit attempt rows manually.

## Local health and listeners

```bash
curl --fail http://127.0.0.1:3201/health
curl --fail --header 'Host: matemyparty.domoforge.com' http://127.0.0.1:3200/
curl --fail --header 'Host: raymundo6th.domoforge.com' http://127.0.0.1:3200/
sudo ss -lntp '( sport = :3200 or sport = :3201 or sport = :5432 )'
```

MateMyParty must bind 3200 and 3201 only to `127.0.0.1`. PostgreSQL should be loopback-only after shared-client review. Ports 3000 and 3001 are assigned to unrelated VPS applications and are not MateMyParty listeners.

## Public health

Run only after DNS and TLS are complete:

```bash
curl --fail --show-error https://matemyparty.domoforge.com/health
curl --fail --show-error https://matemyparty.domoforge.com/
curl --fail --show-error https://raymundo6th.domoforge.com/
curl --fail --show-error https://matemyparty.domoforge.com/events/raymundo-6
```

## Nginx and certificates

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
sudo certbot certificates
systemctl status certbot.timer
systemctl list-timers certbot.timer
sudo certbot renew --dry-run
```

Reload Nginx after a successful syntax test; avoid a restart unless the process is unhealthy. HSTS remains disabled until certificate renewal and both hostnames have been stable.

## Database and backups

```bash
systemctl status postgresql
sudo -u postgres pg_isready
sudo systemctl status matemyparty-backup.timer
sudo systemctl list-timers matemyparty-backup.timer
sudo systemctl start matemyparty-backup.service
sudo journalctl -u matemyparty-backup.service -n 50
sudo ls -lh /var/backups/matemyparty
```

See [backup-and-restore.md](backup-and-restore.md) before attempting recovery.

## Common recovery

- **API degraded:** inspect API and PostgreSQL status, validate the protected environment permissions, then restart API and check `/health` before web.
- **Web returns 502:** confirm `127.0.0.1:3200`, inspect the web journal, and ensure `.next/BUILD_ID` exists.
- **Nginx configuration failure:** leave the running configuration untouched, restore the timestamped site backup, run `nginx -t`, then reload.
- **Certificate failure:** keep the HTTP bootstrap site, verify public DNS and port 80, and rerun Certbot only after the DNS gate passes.
- **Failed deployment:** use the rollback procedure below; never invent reverse migrations.

## Application rollback

Read the previous deployed commit and verify it is part of `origin/main`:

```bash
sudo cat /var/lib/matemyparty/previous-commit
cd /forge/matemyparty
git fetch --prune --tags origin
git merge-base --is-ancestor "$(sudo cat /var/lib/matemyparty/previous-commit)" origin/main
sudo /forge/matemyparty/deploy/scripts/deploy.sh \
  --ref "$(sudo cat /var/lib/matemyparty/previous-commit)"
```

Application rollback is safe only while database migrations remain backward compatible. When compatibility is uncertain, stop writes and restore a verified pre-migration backup into a separate database first. There are no automated destructive down migrations.
