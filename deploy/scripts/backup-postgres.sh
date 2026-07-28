#!/usr/bin/env bash

set -Eeuo pipefail
umask 0077

readonly DATABASE_NAME="matemyparty"
readonly BACKUP_DIRECTORY="/var/backups/matemyparty"
readonly RETENTION_DAYS="7"

if [[ ${EUID} -ne 0 ]]; then
  echo "This backup must run as root so it can switch to the postgres account." >&2
  exit 1
fi

install -d -m 0700 -o root -g root "${BACKUP_DIRECTORY}"
exec 9>"${BACKUP_DIRECTORY}/.backup.lock"
if ! flock -n 9; then
  echo "Another MateMyParty backup is already running." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${BACKUP_DIRECTORY}/matemyparty-${timestamp}.dump"
temporary_file="${backup_file}.tmp"

cleanup() {
  if [[ -f ${temporary_file} ]]; then
    rm -f -- "${temporary_file}"
  fi
}
trap cleanup EXIT

runuser --user postgres -- \
  /usr/bin/pg_dump \
  --dbname="${DATABASE_NAME}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges >"${temporary_file}"

chmod 0600 "${temporary_file}"
mv -- "${temporary_file}" "${backup_file}"
find "${BACKUP_DIRECTORY}" -maxdepth 1 -type f -name 'matemyparty-*.dump' \
  -mtime "+$((RETENTION_DAYS - 1))" -delete

echo "Backup created: ${backup_file}"
