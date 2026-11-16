#!/usr/bin/env bash
# Installs, or upgrades in place, the self-hosted Supabase that backs travelist.live (D-082): the
# official docker/ setup of github.com/supabase/supabase at UPSTREAM_REF, plus
# deploy/supabase/docker-compose.travelist.yml, in /opt/travelist-supabase on the VPS.
#
# Usage:
#   ./scripts/install-supabase-vps.sh   # idempotent: re-run after changing the pin or the override
#
# Needs: the SSH host alias `travelist-vps` (as deploy-web.sh). The first run generates every
# secret on the VPS (upstream utils/generate-keys.sh) into /opt/travelist-supabase/docker/.env,
# which never leaves the server; later runs keep them. Fill RESEND_API_KEY, EMAIL_FROM and
# ORS_API_KEY in that file, then re-run (README → "Self-hosted Supabase").
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# supabase/supabase master on 2026-11-16 (Postgres 17.6, GoTrue v2.197, Envoy gateway).
UPSTREAM_REF=000320e91451c637548e85a98ed194228d0dbf2c
REMOTE_DIR=/opt/travelist-supabase
PUBLIC_URL=https://travelist.live

log() { printf '\033[1;34m[install-supabase]\033[0m %s\n' "$*"; }

log "Checking out supabase/supabase docker/ at $UPSTREAM_REF..."
ssh travelist-vps "REMOTE_DIR=$REMOTE_DIR UPSTREAM_REF=$UPSTREAM_REF bash -s" <<'REMOTE'
set -euo pipefail
# Only docker/ of the one pinned commit: the full monorepo history is gigabytes.
if [ ! -d "$REMOTE_DIR/.git" ]; then
  git init --quiet "$REMOTE_DIR"
  git -C "$REMOTE_DIR" remote add origin https://github.com/supabase/supabase
  git -C "$REMOTE_DIR" sparse-checkout set docker
fi
git -C "$REMOTE_DIR" fetch --quiet --depth 1 --filter=blob:none origin "$UPSTREAM_REF"
git -C "$REMOTE_DIR" checkout --quiet --force FETCH_HEAD
REMOTE

log "Copying Travelist's override and backup script..."
ssh travelist-vps "cat > $REMOTE_DIR/docker/docker-compose.travelist.yml" \
  <"$ROOT_DIR/deploy/supabase/docker-compose.travelist.yml"
ssh travelist-vps "cat > $REMOTE_DIR/backup.sh && chmod 700 $REMOTE_DIR/backup.sh" \
  <"$ROOT_DIR/deploy/supabase/backup.sh"

log "Writing settings and starting the stack..."
ssh travelist-vps "REMOTE_DIR=$REMOTE_DIR PUBLIC_URL=$PUBLIC_URL bash -s" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR/docker"

# Replaces KEY=… in .env, or appends it.
set_env() {
  local key="$1" value="$2"
  if grep -q "^$key=" .env; then
    sed -i "s|^$key=.*$|$key=$value|" .env
  else
    printf '%s=%s\n' "$key" "$value" >>.env
  fi
}
# Appends KEY=value only when .env has no KEY yet (secrets and owner-filled values survive re-runs).
add_env() { grep -q "^$1=" .env || printf '%s=%s\n' "$1" "$2" >>.env; }

if [ ! -f .env ]; then
  cp .env.example .env
  sh utils/generate-keys.sh --update-env >/dev/null
  rm -f .env.old
fi
chmod 600 .env

set_env COMPOSE_FILE docker-compose.yml:docker-compose.travelist.yml
set_env SUPABASE_PUBLIC_URL "$PUBLIC_URL"
set_env API_EXTERNAL_URL "$PUBLIC_URL/auth/v1"
set_env SITE_URL "$PUBLIC_URL"
set_env ADDITIONAL_REDIRECT_URLS "$PUBLIC_URL/**,wayfarer://**,exp://**"
set_env JWT_EXPIRY 3600
set_env DISABLE_SIGNUP false
set_env ENABLE_EMAIL_SIGNUP true
set_env ENABLE_EMAIL_AUTOCONFIRM true
set_env ENABLE_ANONYMOUS_USERS false
set_env ENABLE_PHONE_SIGNUP false
set_env ENABLE_PHONE_AUTOCONFIRM false
set_env PGRST_DB_EXTRA_SEARCH_PATH public,extensions
set_env FUNCTIONS_VERIFY_JWT false
add_env SEND_EMAIL_HOOK_SECRET "v1,whsec_$(openssl rand -base64 32)"
add_env RESEND_API_KEY ''
add_env EMAIL_FROM ''
add_env ORS_API_KEY ''

docker compose pull --quiet
docker compose up -d --remove-orphans

printf '30 3 * * * root %s/backup.sh\n' "$REMOTE_DIR" >/etc/cron.d/travelist-supabase
REMOTE

log "Done. API on the VPS at http://127.0.0.1:18000 (public: $PUBLIC_URL/rest/v1/ …)."
