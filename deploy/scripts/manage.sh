#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${MATEMYPARTY_APP_DIR:-/forge/matemyparty}"
ENV_FILE="${MATEMYPARTY_ENV_FILE:-/etc/matemyparty/matemyparty.env}"

API_SERVICE="${MATEMYPARTY_API_SERVICE:-matemyparty-api.service}"
WEB_SERVICE="${MATEMYPARTY_WEB_SERVICE:-matemyparty-web.service}"

API_HEALTH_URL="${MATEMYPARTY_API_HEALTH_URL:-http://127.0.0.1:3201/health}"
WEB_HEALTH_URL="${MATEMYPARTY_WEB_HEALTH_URL:-http://127.0.0.1:3200/host/access}"
PUBLIC_HEALTH_URL="${MATEMYPARTY_PUBLIC_HEALTH_URL:-https://matemyparty.domoforge.com/health}"
PUBLIC_WEB_URL="${MATEMYPARTY_PUBLIC_WEB_URL:-https://matemyparty.domoforge.com/host/access}"

API_BUILD_DIR="$APP_DIR/apps/api/dist"
WEB_BUILD_DIR="$APP_DIR/apps/web/.next"

LOCK_FILE="${MATEMYPARTY_LOCK_FILE:-/tmp/matemyparty-manage.lock}"
LOG_DIR="${MATEMYPARTY_LOG_DIR:-$APP_DIR/deploy/logs}"

ACTION="${1:-help}"
shift || true

BRANCH="develop"
SKIP_TESTS=false
SKIP_INSTALL=false
SKIP_MIGRATIONS=false
BACKUP_DIR=""
DEPLOY_IN_PROGRESS=false

RUN_USER="$(id -un)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/manage-$TIMESTAMP.log"

usage() {
  cat <<'USAGE'
Usage:
  ./deploy/scripts/manage.sh start
  ./deploy/scripts/manage.sh stop
  ./deploy/scripts/manage.sh restart
  ./deploy/scripts/manage.sh status
  ./deploy/scripts/manage.sh health
  ./deploy/scripts/manage.sh logs

  ./deploy/scripts/manage.sh build [options]
  ./deploy/scripts/manage.sh rebuild [options]
  ./deploy/scripts/manage.sh deploy [options]

Actions:
  start       Start API, wait for health, then start web.
  stop        Stop web, then API.
  restart     Restart services without installing, migrating, or compiling.
  status      Show systemd status and listening ports.
  health      Check local and public health.
  logs        Show recent API and web logs.

  build       Compile the current checkout and restart services.
              Does not install dependencies or run migrations.

  rebuild     Install dependencies, migrate, validate, compile, and restart.
              Does not pull from Git.

  deploy      Fetch and fast-forward the requested branch, then perform rebuild.

Options:
  --branch NAME       Branch used by deploy. Default: develop
  --skip-tests        Skip test suites. Lint and typecheck still run.
  --skip-install      Skip pnpm install.
  --no-migrate        Skip database migrations.
  -h, --help          Show this help.

Examples:
  ./deploy/scripts/manage.sh restart
  ./deploy/scripts/manage.sh rebuild
  ./deploy/scripts/manage.sh rebuild --skip-tests
  ./deploy/scripts/manage.sh deploy --branch develop
USAGE
}

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

service_is_active() {
  sudo systemctl is-active --quiet "$1"
}

artifact_exists() {
  [[ -r "$API_BUILD_DIR/main.js" && -r "$WEB_BUILD_DIR/BUILD_ID" ]]
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local delay="${4:-1}"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --silent --show-error --fail \
      --connect-timeout 2 \
      --max-time 5 \
      "$url" >/dev/null; then
      log "$label is healthy."
      return 0
    fi

    sleep "$delay"
  done

  log "$label did not become healthy: $url"
  return 1
}

show_recent_logs() {
  sudo journalctl \
    -u "$API_SERVICE" \
    -u "$WEB_SERVICE" \
    --since "15 minutes ago" \
    --no-pager
}

stop_services() {
  log "Stopping web service..."
  sudo systemctl stop "$WEB_SERVICE" || true

  log "Stopping API service..."
  sudo systemctl stop "$API_SERVICE" || true
}

start_services() {
  [[ -r "$API_BUILD_DIR/main.js" ]] ||
    die "API artifact missing: $API_BUILD_DIR/main.js"

  [[ -r "$WEB_BUILD_DIR/BUILD_ID" ]] ||
    die "Web artifact missing: $WEB_BUILD_DIR/BUILD_ID"

  sudo systemctl reset-failed "$API_SERVICE" "$WEB_SERVICE" || true

  log "Starting API service..."
  sudo systemctl start "$API_SERVICE"

  if ! wait_for_url "$API_HEALTH_URL" "API" 30 1; then
    sudo systemctl status "$API_SERVICE" --no-pager --full || true
    sudo journalctl -u "$API_SERVICE" -n 100 --no-pager || true
    return 1
  fi

  log "Starting web service..."
  sudo systemctl start "$WEB_SERVICE"

  if ! wait_for_url "$WEB_HEALTH_URL" "Web" 30 1; then
    sudo systemctl status "$WEB_SERVICE" --no-pager --full || true
    sudo journalctl -u "$WEB_SERVICE" -n 100 --no-pager || true
    return 1
  fi
}

backup_artifacts() {
  BACKUP_DIR="$APP_DIR/.deploy-backup-$TIMESTAMP-$$"

  log "Backing up active build artifacts to $BACKUP_DIR"

  sudo mkdir -p "$BACKUP_DIR"

  if [[ -d "$API_BUILD_DIR" ]]; then
    sudo mv "$API_BUILD_DIR" "$BACKUP_DIR/api-dist"
  fi

  if [[ -d "$WEB_BUILD_DIR" ]]; then
    sudo mv "$WEB_BUILD_DIR" "$BACKUP_DIR/web-next"
  fi

  sudo chown -R "$RUN_USER" "$BACKUP_DIR"
}

remove_backup() {
  if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    log "Removing previous build backup."
    sudo rm -rf "$BACKUP_DIR"
  fi

  BACKUP_DIR=""
}

restore_backup() {
  [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || return 0

  log "Restoring previous build artifacts..."

  sudo rm -rf "$API_BUILD_DIR" "$WEB_BUILD_DIR"

  if [[ -d "$BACKUP_DIR/api-dist" ]]; then
    sudo mv "$BACKUP_DIR/api-dist" "$API_BUILD_DIR"
  fi

  if [[ -d "$BACKUP_DIR/web-next" ]]; then
    sudo mv "$BACKUP_DIR/web-next" "$WEB_BUILD_DIR"
  fi

  sudo rm -rf "$BACKUP_DIR"
  BACKUP_DIR=""
}

rollback() {
  local original_status="$1"

  trap - ERR

  log "Deployment operation failed with status $original_status."

  if [[ "$DEPLOY_IN_PROGRESS" == true ]]; then
    stop_services
    restore_backup

    if artifact_exists; then
      log "Attempting to restart the previous build..."

      if start_services; then
        log "Previous build restored successfully."
      else
        log "Previous build was restored, but services did not recover."
        show_recent_logs || true
      fi
    else
      log "No complete previous build was available for automatic recovery."
    fi
  fi

  exit "$original_status"
}

on_error() {
  local exit_code=$?
  local line_number="${BASH_LINENO[0]:-unknown}"
  local command="${BASH_COMMAND:-unknown}"

  log "Command failed at line $line_number: $command"
  rollback "$exit_code"
}

run_pnpm_install() {
  if [[ "$SKIP_INSTALL" == true ]]; then
    log "Skipping dependency installation."
    return
  fi

  log "Installing frozen dependencies..."
  pnpm install --frozen-lockfile
}

run_migrations() {
  if [[ "$SKIP_MIGRATIONS" == true ]]; then
    log "Skipping database migrations."
    return
  fi

  [[ -r "$ENV_FILE" ]] ||
    sudo test -r "$ENV_FILE" ||
    die "Environment file is not readable: $ENV_FILE"

  local pnpm_bin
  pnpm_bin="$(command -v pnpm)"

  log "Running database migrations..."

  sudo bash -c "
    set -Eeuo pipefail
    set -a
    source '$ENV_FILE'
    set +a

    exec runuser \
      --user '$RUN_USER' \
      --whitelist-environment=DATABASE_URL \
      -- \
      /usr/bin/env \
      PATH='$(dirname "$pnpm_bin"):/opt/matemyparty/runtime/bin:/usr/local/bin:/usr/bin:/bin' \
      '$pnpm_bin' \
      --dir '$APP_DIR' \
      --filter @matemyparty/database \
      db:migrate
  "
}

run_validation() {
  log "Running formatting check..."
  pnpm format:check

  log "Running lint..."
  pnpm lint

  log "Running typecheck..."
  pnpm typecheck

  if [[ "$SKIP_TESTS" == false ]]; then
    log "Running tests..."
    pnpm test
  else
    log "Skipping tests by explicit request."
  fi

  log "Checking Git whitespace errors..."
  git diff --check
}

compile_artifacts() {
  log "Building API..."
  pnpm --filter @matemyparty/api build

  [[ -r "$API_BUILD_DIR/main.js" ]] ||
    die "API build completed without producing dist/main.js"

  log "Building web..."
  pnpm --filter @matemyparty/web build

  [[ -r "$WEB_BUILD_DIR/BUILD_ID" ]] ||
    die "Web build completed without producing .next/BUILD_ID"

  log "API artifact: $API_BUILD_DIR/main.js"
  log "Web BUILD_ID: $(cat "$WEB_BUILD_DIR/BUILD_ID")"
}

verify_rate_limiters() {
  local invitation_file="$APP_DIR/apps/api/src/invitations/invitation-lookup-rate-limiter.ts"
  local rsvp_file="$APP_DIR/apps/api/src/rsvp/rsvp-rate-limiter.ts"

  [[ -f "$invitation_file" ]] || die "Rate limiter file missing: $invitation_file"
  [[ -f "$rsvp_file" ]] || die "Rate limiter file missing: $rsvp_file"

  if grep -Eq 'constructor[[:space:]]*\([^)]*(maximumAttempts|windowMilliseconds|now)' \
    "$invitation_file" "$rsvp_file"; then
    die "Unsafe NestJS rate-limiter constructor parameters were detected."
  fi

  log "Rate-limiter constructor check passed."
}

verify_public_endpoints() {
  log "Checking public API health..."
  wait_for_url "$PUBLIC_HEALTH_URL" "Public API" 15 1

  log "Checking public web..."
  wait_for_url "$PUBLIC_WEB_URL" "Public web" 15 1
}

show_status() {
  sudo systemctl status \
    "$API_SERVICE" \
    "$WEB_SERVICE" \
    --no-pager \
    --full || true

  echo
  log "Listening ports:"
  ss -ltnp | grep -E ':(3200|3201)[[:space:]]' || true
}

show_health() {
  local failed=false

  if wait_for_url "$API_HEALTH_URL" "Local API" 1 0; then
    curl --silent --show-error "$API_HEALTH_URL"
    echo
  else
    failed=true
  fi

  if ! wait_for_url "$WEB_HEALTH_URL" "Local web" 1 0; then
    failed=true
  fi

  if wait_for_url "$PUBLIC_HEALTH_URL" "Public API" 1 0; then
    curl --silent --show-error "$PUBLIC_HEALTH_URL"
    echo
  else
    failed=true
  fi

  if ! wait_for_url "$PUBLIC_WEB_URL" "Public web" 1 0; then
    failed=true
  fi

  [[ "$failed" == false ]]
}

git_prepare_deploy() {
  local current_branch

  git fetch --prune origin

  current_branch="$(git branch --show-current)"

  if [[ "$current_branch" != "$BRANCH" ]]; then
    log "Switching from $current_branch to $BRANCH..."
    git switch "$BRANCH"
  fi

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short
    die "Working tree must be clean before deploy."
  fi

  log "Fast-forwarding $BRANCH from origin/$BRANCH..."
  git pull --ff-only origin "$BRANCH"

  log "Deploying commit: $(git rev-parse HEAD)"
  git log -1 --oneline
}

perform_build() {
  local install="$1"
  local migrate="$2"
  local validate="$3"

  DEPLOY_IN_PROGRESS=true

  stop_services
  backup_artifacts

  if [[ "$install" == true ]]; then
    run_pnpm_install
  fi

  if [[ "$migrate" == true ]]; then
    run_migrations
  fi

  verify_rate_limiters

  if [[ "$validate" == true ]]; then
    run_validation
  fi

  compile_artifacts
  start_services
  verify_public_endpoints

  remove_backup
  DEPLOY_IN_PROGRESS=false

  log "Operation completed successfully."
  log "Current commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
}

parse_options() {
  while (($#)); do
    case "$1" in
      --branch)
        [[ $# -ge 2 ]] || die "--branch requires a value"
        BRANCH="$2"
        shift 2
        ;;
      --skip-tests)
        SKIP_TESTS=true
        shift
        ;;
      --skip-install)
        SKIP_INSTALL=true
        shift
        ;;
      --no-migrate)
        SKIP_MIGRATIONS=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done
}

main() {
  [[ "$EUID" -ne 0 ]] ||
    die "Run this script as the deployment user, not as root."

  [[ -d "$APP_DIR/.git" ]] ||
    die "Repository not found at $APP_DIR"

  cd "$APP_DIR"

  mkdir -p "$LOG_DIR"

  exec 9>"$LOCK_FILE"
  flock -n 9 ||
    die "Another MateMyParty management operation is already running."

  exec > >(tee -a "$LOG_FILE") 2>&1

  trap on_error ERR

  require_command curl
  require_command flock
  require_command git
  require_command pnpm
  require_command sudo
  require_command systemctl

  parse_options "$@"

  log "Action: $ACTION"
  log "User: $RUN_USER"
  log "Repository: $APP_DIR"
  log "Log: $LOG_FILE"

  case "$ACTION" in
    start)
      start_services
      verify_public_endpoints
      ;;

    stop)
      stop_services
      ;;

    restart)
      stop_services
      start_services
      verify_public_endpoints
      ;;

    status)
      show_status
      ;;

    health)
      show_health
      ;;

    logs)
      show_recent_logs
      ;;

    build)
      perform_build false false false
      ;;

    rebuild)
      perform_build true true true
      ;;

    deploy)
      git_prepare_deploy
      perform_build true true true
      ;;

    help|-h|--help)
      usage
      ;;

    *)
      usage
      die "Unknown action: $ACTION"
      ;;
  esac
}

main "$@"
