# Wayfarer

Cross-platform travel companion (iOS · Android · Web) built with Expo + Supabase.

- **Before you go:** a checklist personalised to your nationality (visa, power, weather, money, safety, practical info).
- **Explore:** a map of attractions in 12 launch cities.
- **Walk:** an optimised walking route between the places you pick, saved as a trip.

Status and roadmap: [PROGRESS.md](./PROGRESS.md) · Architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](./docs/DECISIONS.md) · Data: [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md)

## Prerequisites

| Tool                   | Version                | Notes                                                 |
| ---------------------- | ---------------------- | ----------------------------------------------------- |
| Node.js                | 22 LTS (see `.nvmrc`)  |                                                       |
| pnpm                   | 10 (`corepack enable`) | version pinned in `package.json`                      |
| Docker                 | Desktop or OrbStack    | required by the local Supabase stack                  |
| Python                 | ≥ 3.11                 | data pipeline only                                    |
| Deno                   | 2.x                    | optional, to run Edge Function tests outside Supabase |
| Xcode / Android Studio | latest                 | for iOS simulator / Android emulator                  |

## Quick start (local, everything on your machine)

```bash
corepack enable
pnpm install

# 1. Backend: Postgres + PostGIS, Auth, Edge Functions (Docker must be running)
pnpm db:start                 # = supabase start; prints API URL + keys, loads migrations + seeds
cp .env.example .env          # paste API URL + ANON_KEY into EXPO_PUBLIC_SUPABASE_*,
                              # SERVICE_ROLE_KEY into SUPABASE_SERVICE_ROLE_KEY
ln -s ../../.env apps/mobile/.env   # Expo reads .env from the app folder
pnpm functions:serve          # keep running: checklist + route-optimize Edge Functions

# 2. App (another terminal)
pnpm dev                      # Expo dev server → w (web), i (iOS), a (Android)
```

- Seeds in `supabase/seed/` contain all reference data (countries, 12 cities, visa rules, attractions), so `pnpm db:reset` restores a complete database without re-running the pipeline.
- Sign-up emails (confirmation, magic link + 6-digit code) are caught by Mailpit at http://127.0.0.1:54324. Local sign-up doesn't require confirmation.
- Supabase Studio: http://127.0.0.1:54323.
- Without `ORS_API_KEY` the route optimiser uses a built-in nearest-neighbour + 2-opt fallback with straight-line estimates (flagged in the UI). With a free key from openrouteservice.org you get real walking directions.
- The map uses MapLibre. It works on web in any browser; on iOS/Android it needs a **development build** (not Expo Go): `pnpm --filter @wayfarer/mobile exec expo run:ios` (or `run:android`), or build in the cloud with EAS (`npx eas-cli build --profile development`).

The Supabase CLI is installed as a dev dependency, so `pnpm exec supabase <cmd>` works without a global install.

## Deploying (hosted)

1. **Supabase project** (supabase.com): `pnpm exec supabase login`, `pnpm exec supabase link --project-ref <ref>`, then
   `pnpm exec supabase db push --include-seed` (schema + reference data) and
   `pnpm exec supabase functions deploy checklist route-optimize health`.
2. **Secrets:** `pnpm exec supabase secrets set ORS_API_KEY=...` (optional `EXCHANGE_RATES_BASE_URL`). `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
3. **Auth:** Dashboard → Authentication → URL configuration: Site URL = your web URL; redirect URLs `https://<web>/auth/callback`, `wayfarer://auth/callback`. Providers → Google / Apple with your client ids. Email templates: paste `supabase/templates/*.html`. Configure a custom SMTP server for production email volume.
4. **Web:** `pnpm build:web` → deploy `apps/mobile/dist` to any static host (EAS Hosting: `npx eas-cli deploy`, Netlify, Vercel, Cloudflare Pages) with `EXPO_PUBLIC_*` set at build time.
5. **iOS / Android:** set `EXPO_PUBLIC_*` as EAS environment variables, then `npx eas-cli build --profile production -p ios|android` and `npx eas-cli submit`.

## Scripts (root)

| Command                                      | What it does                                                          |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                                   | Start the Expo dev server                                             |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Run across all workspaces via Turborepo                               |
| `pnpm check`                                 | format check + shared-copy check + lint + typecheck + tests           |
| `pnpm build:web`                             | Static web export (`apps/mobile/dist`)                                |
| `pnpm e2e`                                   | Playwright web E2E (run `pnpm build:web` first)                       |
| `E2E_BACKEND=1 pnpm e2e`                     | Also runs the full journey against the local stack                    |
| `pnpm db:start` / `db:stop` / `db:reset`     | Local Supabase stack; `db:reset` re-applies migrations + seeds        |
| `pnpm db:test`                               | pgTAP tests in `supabase/tests` (RLS, RPCs)                           |
| `pnpm db:types`                              | Regenerate `apps/mobile/src/lib/database.types.ts` from the local DB  |
| `pnpm functions:serve`                       | Serve Edge Functions locally with `.env` secrets                      |
| `pnpm sync:shared`                           | Copy `packages/shared/src` into `supabase/functions/_shared/wayfarer` |

Edge Function checks: `cd supabase/functions && deno lint && deno fmt --check && deno test --allow-net=jsr.io`.
After editing `packages/shared`, run `pnpm sync:shared` (CI fails when the copy is stale, see D-005).

## Environment variables

See [.env.example](./.env.example). Only `EXPO_PUBLIC_*` values reach the app, and they are validated at startup (`apps/mobile/src/lib/env.ts`). Secrets (`ORS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, OAuth secrets) are only for Edge Functions / Supabase Auth: set them with `supabase secrets set` or in the dashboard for hosted projects. Sentry / PostHog are no-ops when their keys are empty. `EXPO_PUBLIC_AUTH_PROVIDERS=google,apple` shows the OAuth buttons once the providers are enabled in Supabase.

## Data pipeline

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m wayfarer_pipeline validate-config
python -m wayfarer_pipeline ingest --city lisbon   # available from M2
python -m wayfarer_pipeline ingest --all
```

### Adding a new city

1. Add an entry to [`data-pipeline/cities.yaml`](./data-pipeline/cities.yaml) (slug, en/pt names, country code, Wikidata id, OSM relation, centre, bbox).
2. `python -m wayfarer_pipeline validate-config`
3. `python -m wayfarer_pipeline ingest --city <slug>` and review the quality report.

No code changes are needed.

## Repository layout

```
apps/mobile          Expo app (iOS, Android, Web) — Expo Router, src/app = routes
packages/shared      zod schemas, types, constants, i18n resources (EN/PT)
supabase/            config, migrations, seed, pgTAP tests, Edge Functions
data-pipeline/       Python ingestion (Wikidata, OSM, Wikipedia pageviews)
docs/                ARCHITECTURE, DATA_SOURCES, DECISIONS
```
