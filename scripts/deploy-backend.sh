#!/usr/bin/env bash
# Publishes the backend to the self-hosted Supabase on the VPS (D-082; before that, Supabase
# Cloud, D-073/D-074): migrations, reference data (seeds) and every Edge Function. Run by
# .github/workflows/deploy.yml for each promoted commit, and by hand from a machine that has the
# credentials. The stack itself is installed by scripts/install-supabase-vps.sh.
#
# Usage:
#   ./scripts/deploy-backend.sh            # db push --include-seed, then publish the functions
#   ./scripts/deploy-backend.sh --dry-run  # show the migrations and seeds that would run; no deploy
#
# Needs: the SSH host alias `travelist-vps` (as deploy-web.sh) and SUPABASE_DB_PASSWORD, the
# POSTGRES_PASSWORD of /opt/travelist-supabase/docker/.env on the VPS. Locally it is read from
# .env.production when unset.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/supabase/functions"
ENV_FILE="$ROOT_DIR/.env.production"
STACK_DIR=/opt/travelist-supabase/docker
# The database listens on 127.0.0.1:15432 on the VPS; the tunnel brings it to this local port.
TUNNEL_PORT="${TUNNEL_PORT:-15432}"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

log() { printf '\033[1;34m[deploy-backend]\033[0m %s\n' "$*"; }
fail() {
  printf '\033[1;31m[deploy-backend] %s\033[0m\n' "$*" >&2
  exit 1
}

# Every folder with an index.ts is a function; _shared is imported by them, never deployed alone.
function_names() {
  local entry
  for entry in "$FUNCTIONS_DIR"/[!_]*/index.ts; do
    if [ -f "$entry" ]; then basename "$(dirname "$entry")"; fi
  done
}

# Opens the SSH tunnel to the VPS database and waits until it accepts connections.
open_tunnel() {
  ssh -N -o ExitOnForwardFailure=yes -L "$TUNNEL_PORT:127.0.0.1:15432" travelist-vps &
  TUNNEL_PID=$!
  trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT
  local attempt
  for attempt in $(seq 1 20); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$TUNNEL_PORT") 2>/dev/null; then return 0; fi
    sleep 1
  done
  fail "No tunnel to the VPS database after 20 s (expected 127.0.0.1:$TUNNEL_PORT -> travelist-vps:15432)."
}

# The functions without their tests, as a gzipped tar on stdout. deno.json becomes deno.jsonc,
# the import map upstream's main router hands every function.
functions_archive() {
  local staging
  staging="$(mktemp -d)"
  tar -C "$FUNCTIONS_DIR" --exclude='*.test.ts' --exclude='fake-*.ts' --exclude='test-fakes.ts' \
    --exclude='deno.lock' -cf - . | tar -C "$staging" -xf -
  mv "$staging/deno.json" "$staging/deno.jsonc"
  tar -C "$staging" -czf - .
  rm -rf "$staging"
}

# Replaces the functions in the stack's volume, keeping upstream's main/ router, and restarts the
# runtime. In place, not by swapping the folder: the container bind-mounts that exact folder.
publish_functions() {
  functions_archive | ssh travelist-vps "set -e
    cd $STACK_DIR/volumes/functions
    find . -mindepth 1 -maxdepth 1 ! -name main -exec rm -rf {} +
    tar -xzf -
    cd $STACK_DIR && docker compose restart functions >/dev/null 2>&1"
}

if [ -z "${SUPABASE_DB_PASSWORD:-}" ] && [ -f "$ENV_FILE" ]; then
  SUPABASE_DB_PASSWORD="$(sed -n 's/^SUPABASE_DB_PASSWORD=//p' "$ENV_FILE")"
fi
[ -n "${SUPABASE_DB_PASSWORD:-}" ] ||
  fail "SUPABASE_DB_PASSWORD is empty (expected POSTGRES_PASSWORD from $STACK_DIR/.env on the VPS)."

# supabase/config.toml's Send Email Hook (D-066) needs a well-formed secret for the CLI to load it;
# this is the local-only value from .env.example. The real one lives in the VPS's .env.
export SEND_EMAIL_HOOK_SECRET="${SEND_EMAIL_HOOK_SECRET:-v1,whsec_dHJhdmVsaXN0LWxvY2FsLW9ubHktaG9vay1zZWNyZXQ=}"

cd "$ROOT_DIR"
log "Opening a tunnel to the database on travelist-vps..."
open_tunnel
# Plain TCP inside the SSH tunnel: the database has no TLS of its own.
DB_URL="postgresql://postgres:$SUPABASE_DB_PASSWORD@127.0.0.1:$TUNNEL_PORT/postgres?sslmode=disable"

if $DRY_RUN; then
  pnpm exec supabase db push --db-url "$DB_URL" --include-seed --dry-run
  log "Dry run: would publish the functions $(function_names | tr '\n' ' ')"
  exit 0
fi

# Seeds are upserts (on conflict … do update), and the CLI re-runs only seed files whose hash changed.
log "Pushing migrations and reference data..."
pnpm exec supabase db push --db-url "$DB_URL" --include-seed

log "Publishing Edge Functions: $(function_names | tr '\n' ' ')"
publish_functions
log "Done: https://travelist.live/functions/v1/health"
