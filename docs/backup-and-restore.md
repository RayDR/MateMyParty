# PostgreSQL backup and restore

MateMyParty uses a daily systemd timer and PostgreSQL custom-format dumps. The backup service runs locally as root, switches to the `postgres` account through peer authentication, and stores no database password.

## Automated backup

`matemyparty-backup.timer` runs daily around 03:15 UTC with a randomized delay. Backups are written atomically under `/var/backups/matemyparty`, mode `0600`, using pg_dump compression level 9. Files older than seven daily retention windows are removed.

```bash
sudo systemctl enable --now matemyparty-backup.timer
sudo systemctl list-timers matemyparty-backup.timer
sudo systemctl status matemyparty-backup.timer
```

The local retention protects against short-term operational mistakes; it is not disaster recovery. Add encrypted off-host copies before storing irreplaceable production data.

## Manual backup and validation

```bash
sudo systemctl start matemyparty-backup.service
sudo journalctl -u matemyparty-backup.service -n 20
sudo find /var/backups/matemyparty -maxdepth 1 -type f \
  -name 'matemyparty-*.dump' -size +0 -printf '%TY-%Tm-%Td %TH:%TM %m %u:%g %p\n'
sudo pg_restore --list \
  "$(sudo find /var/backups/matemyparty -maxdepth 1 -type f \
    -name 'matemyparty-*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)" \
  >/dev/null
```

The last command validates the dump catalog without modifying a database.

## Restore test in a separate database

Never test restoration against production. Create a disposable local database with no application traffic:

```bash
backup_file="$(sudo find /var/backups/matemyparty -maxdepth 1 -type f \
  -name 'matemyparty-*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
restore_database="matemyparty_restore_test_$(date -u +%Y%m%d)"
set -o pipefail
sudo -u postgres createdb --encoding=UTF8 --template=template0 "${restore_database}"
sudo cat "${backup_file}" | sudo -u postgres pg_restore \
  --exit-on-error --no-owner --no-privileges --dbname="${restore_database}"
sudo -u postgres psql --dbname="${restore_database}" \
  --command='SELECT count(*) FROM events;'
```

After recording a successful test, explicitly remove only the disposable database:

```bash
sudo -u postgres dropdb "${restore_database}"
```

Confirm the variable begins with `matemyparty_restore_test_` before running the drop command.

## Production recovery limits

- Capture a fresh dump and preserve the suspected bad database before recovery.
- Stop API and web writes before swapping databases.
- Restore into a new database, validate schema and event data, then change `DATABASE_URL` during a controlled maintenance window.
- A custom-format dump is logical, not point-in-time recovery. Point-in-time recovery requires PostgreSQL base backups and WAL archiving, which are not yet configured.
- Seven local daily dumps do not protect against total VPS loss; encrypted off-host backup is a remaining production requirement.
