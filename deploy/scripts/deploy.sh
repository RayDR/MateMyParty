#!/usr/bin/env bash

set -Eeuo pipefail
umask 0027

readonly REPOSITORY_DIRECTORY="/forge/matemyparty"
readonly ENVIRONMENT_FILE="/etc/matemyparty/matemyparty.env"
readonly DEPLOYMENT_STATE_DIRECTORY="/var/lib/matemyparty"
readonly DEPLOY_USER="sysops"

usage() {
  echo "Usage: sudo $0 --ref <main|vX.Y.Z|40-character-commit>" >&2
}

die() {
  echo "Deployment failed: $*" >&2
  exit 1
}

run_as_deployer() {
  runuser --user "${DEPLOY_USER}" -- "$@"
}

if [[ ${EUID} -ne 0 ]]; then
  die "run this script as root"
fi

if [[ $# -ne 2 || $1 != "--ref" ]]; then
  usage
  exit 2
fi

requested_ref="$2"
[[ -d "${REPOSITORY_DIRECTORY}/.git" ]] || die "repository not found"
[[ -r "${ENVIRONMENT_FILE}" ]] || die "production environment file not found"
[[ -x /usr/bin/node ]] || die "system Node.js is not installed"
[[ -x /usr/bin/pnpm ]] || die "system pnpm is not installed"

if [[ -n $(git -C "${REPOSITORY_DIRECTORY}" status --porcelain) ]]; then
  die "repository working tree is not clean"
fi

run_as_deployer git -C "${REPOSITORY_DIRECTORY}" fetch --prune --tags origin

case "${requested_ref}" in
  main)
    target_ref="refs/remotes/origin/main"
    ;;
  v[0-9]*.[0-9]*.[0-9]*)
    target_ref="refs/tags/${requested_ref}"
    ;;
  *)
    if [[ ${requested_ref} =~ ^[0-9a-f]{40}$ ]]; then
      target_ref="${requested_ref}"
    else
      die "ref must be main, a semantic version tag, or a full commit SHA"
    fi
    ;;
esac

target_commit="$(git -C "${REPOSITORY_DIRECTORY}" rev-parse --verify "${target_ref}^{commit}")" ||
  die "requested ref does not resolve to a commit"
git -C "${REPOSITORY_DIRECTORY}" merge-base --is-ancestor \
  "${target_commit}" refs/remotes/origin/main ||
  die "requested commit is not part of origin/main"

previous_commit="$(git -C "${REPOSITORY_DIRECTORY}" rev-parse HEAD)"
install -d -m 0750 -o root -g root "${DEPLOYMENT_STATE_DIRECTORY}"
printf '%s\n' "${previous_commit}" >"${DEPLOYMENT_STATE_DIRECTORY}/previous-commit"

run_as_deployer git -C "${REPOSITORY_DIRECTORY}" switch --detach "${target_commit}"
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" install --frozen-lockfile
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" format:check
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" lint
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" typecheck
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" test
run_as_deployer /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" build

systemctl start matemyparty-backup.service

set -a
# shellcheck disable=SC1090
source "${ENVIRONMENT_FILE}"
set +a
runuser --user "${DEPLOY_USER}" --whitelist-environment=DATABASE_URL -- \
  /usr/bin/pnpm --dir "${REPOSITORY_DIRECTORY}" db:migrate

systemctl restart matemyparty-api.service
for attempt in {1..20}; do
  if curl --fail --silent --show-error --max-time 3 \
    "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
    break
  fi
  if [[ ${attempt} -eq 20 ]]; then
    die "API health check did not recover"
  fi
  sleep 1
done

systemctl restart matemyparty-web.service
for attempt in {1..20}; do
  if curl --fail --silent --show-error --max-time 3 \
    --header 'Host: matemyparty.domoforge.com' "http://127.0.0.1:${WEB_PORT}/" >/dev/null; then
    break
  fi
  if [[ ${attempt} -eq 20 ]]; then
    die "web health check did not recover"
  fi
  sleep 1
done

printf '%s\n' "${target_commit}" >"${DEPLOYMENT_STATE_DIRECTORY}/current-commit"
echo "MateMyParty deployment completed at ${target_commit}."
