#!/usr/bin/env bash

set -Eeuo pipefail
umask 0027

readonly REPOSITORY_DIRECTORY="/forge/matemyparty"
readonly ENVIRONMENT_FILE="/etc/matemyparty/matemyparty.env"
readonly DEPLOYMENT_STATE_DIRECTORY="/var/lib/matemyparty"
readonly DEPLOY_USER="sysops"
readonly RUNTIME_DIRECTORY="/opt/matemyparty/runtime"
readonly NODE_BINARY="${RUNTIME_DIRECTORY}/bin/node"
readonly PNPM_BINARY="${RUNTIME_DIRECTORY}/bin/pnpm"

usage() {
  echo "Usage: sudo $0 --ref <main|develop|feature/raymundo-dragon-invitation|vX.Y.Z|40-character-commit>" >&2
}

die() {
  echo "Deployment failed: $*" >&2
  exit 1
}

run_as_deployer() {
  runuser --user "${DEPLOY_USER}" -- "$@"
}

run_git() {
  run_as_deployer git -C "${REPOSITORY_DIRECTORY}" "$@"
}

run_pnpm() {
  run_as_deployer /usr/bin/env \
    "PATH=${RUNTIME_DIRECTORY}/bin:/usr/local/bin:/usr/bin:/bin" \
    "${PNPM_BINARY}" --dir "${REPOSITORY_DIRECTORY}" "$@"
}

assert_loopback_listener() {
  local service_name="$1"
  local port="$2"
  local expected_address="127.0.0.1:${port}"
  local listeners

  listeners="$(ss -H -ltn "sport = :${port}")"
  awk -v expected="${expected_address}" '$4 == expected { found = 1 } END { exit !found }' \
    <<<"${listeners}" || die "${service_name} listener is missing from ${expected_address}"
  if awk -v expected="${expected_address}" '$4 != expected { found = 1 } END { exit !found }' \
    <<<"${listeners}"; then
    die "${service_name} port ${port} is listening beyond IPv4 loopback"
  fi
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
[[ -x "${NODE_BINARY}" ]] || die "isolated Node.js runtime is not installed"
[[ -x "${PNPM_BINARY}" ]] || die "isolated pnpm runtime is not installed"

if [[ -n $(run_git status --porcelain) ]]; then
  die "repository working tree is not clean"
fi

run_git fetch --prune --tags origin

case "${requested_ref}" in
  main)
    target_ref="refs/remotes/origin/main"
    allowed_upstream="refs/remotes/origin/main"
    ;;
  develop)
    target_ref="refs/remotes/origin/develop"
    allowed_upstream="refs/remotes/origin/develop"
    ;;
  feature/raymundo-dragon-invitation)
    target_ref="refs/remotes/origin/feature/raymundo-dragon-invitation"
    allowed_upstream="refs/remotes/origin/feature/raymundo-dragon-invitation"
    ;;
  v[0-9]*.[0-9]*.[0-9]*)
    target_ref="refs/tags/${requested_ref}"
    allowed_upstream="refs/remotes/origin/main"
    ;;
  *)
    if [[ ${requested_ref} =~ ^[0-9a-f]{40}$ ]]; then
      target_ref="${requested_ref}"
      allowed_upstream="refs/remotes/origin/feature/raymundo-dragon-invitation"
    else
      die "ref must be main, develop, feature/raymundo-dragon-invitation, a semantic version tag, or a full commit SHA"
    fi
    ;;
esac

target_commit="$(run_git rev-parse --verify "${target_ref}^{commit}")" ||
  die "requested ref does not resolve to a commit"
run_git merge-base --is-ancestor \
  "${target_commit}" "${allowed_upstream}" ||
  die "requested commit is not part of ${allowed_upstream}"

install -d -m 0750 -o root -g root "${DEPLOYMENT_STATE_DIRECTORY}"
if [[ -s ${DEPLOYMENT_STATE_DIRECTORY}/current-commit ]]; then
  read -r previous_commit <"${DEPLOYMENT_STATE_DIRECTORY}/current-commit"
  [[ ${previous_commit} =~ ^[0-9a-f]{40}$ ]] || die "current deployment state is invalid"
  run_git cat-file -e "${previous_commit}^{commit}" || die "current deployed commit is unavailable"
else
  previous_commit="$(run_git rev-parse HEAD)"
fi
printf '%s\n' "${previous_commit}" >"${DEPLOYMENT_STATE_DIRECTORY}/previous-commit"

run_git switch --detach "${target_commit}"
run_pnpm install --frozen-lockfile
run_pnpm format:check
run_pnpm lint
run_pnpm typecheck
run_pnpm test
run_pnpm build

systemctl start matemyparty-backup.service

set -a
# shellcheck disable=SC1090
source "${ENVIRONMENT_FILE}"
set +a
if ! run_git diff --quiet "${previous_commit}" "${target_commit}" -- \
  packages/database/migrations; then
  runuser --user "${DEPLOY_USER}" --whitelist-environment=DATABASE_URL -- \
    /usr/bin/env "PATH=${RUNTIME_DIRECTORY}/bin:/usr/local/bin:/usr/bin:/bin" \
    "${PNPM_BINARY}" --dir "${REPOSITORY_DIRECTORY}" db:migrate
else
  echo "No database migration changes detected; migration skipped."
fi
unset DATABASE_URL HOST_ADMIN_TOKEN

systemctl restart matemyparty-api.service
for attempt in {1..20}; do
  if curl --fail --silent --max-time 3 \
    "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
    break
  fi
  if [[ ${attempt} -eq 20 ]]; then
    die "API health check did not recover"
  fi
  sleep 1
done
assert_loopback_listener "API" "${API_PORT}"

systemctl restart matemyparty-web.service
for attempt in {1..20}; do
  if curl --fail --silent --max-time 3 \
    --header 'Host: matemyparty.domoforge.com' "http://127.0.0.1:${WEB_PORT}/" >/dev/null; then
    break
  fi
  if [[ ${attempt} -eq 20 ]]; then
    die "web health check did not recover"
  fi
  sleep 1
done
assert_loopback_listener "web" "${WEB_PORT}"

printf '%s\n' "${target_commit}" >"${DEPLOYMENT_STATE_DIRECTORY}/current-commit"
echo "MateMyParty deployment completed at ${target_commit}."
