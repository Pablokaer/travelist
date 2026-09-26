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

## Quick start

```bash
corepack enable
pnpm install

# 1. Local backend (Postgres + PostGIS, Auth, Edge Functions)
pnpm db:start                 # = supabase start; prints API URL + keys
cp .env.example .env          # paste the API URL and ANON_KEY into EXPO_PUBLIC_SUPABASE_*
ln -s ../../.env apps/mobile/.env   # Expo reads .env from the app folder

# 2. App
pnpm dev                      # Expo dev server → press w (web), i (iOS), a (Android)
```

The Supabase CLI is installed as a dev dependency, so `pnpm exec supabase <cmd>` works without a global install.

> Expo Go is fine for M0/M1. From M2 (MapLibre) the app needs a development build: `pnpm --filter @wayfarer/mobile exec expo run:ios` (or `run:android`).

## Scripts (root)

| Command                                      | What it does                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                                   | Start the Expo dev server                                      |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Run across all workspaces via Turborepo                        |
| `pnpm check`                                 | format check + lint + typecheck + tests                        |
| `pnpm build:web`                             | Static web export (`apps/mobile/dist`)                         |
| `pnpm e2e`                                   | Playwright web E2E (run `pnpm build:web` first)                |
| `pnpm db:start` / `db:stop` / `db:reset`     | Local Supabase stack; `db:reset` re-applies migrations + seeds |
| `pnpm db:test`                               | pgTAP tests in `supabase/tests` (RLS, RPCs)                    |
| `pnpm functions:serve`                       | Serve Edge Functions locally with `.env` secrets               |

Edge Function checks: `cd supabase/functions && deno lint && deno fmt --check && deno test --allow-net=jsr.io`.

## Environment variables

See [.env.example](./.env.example). Only `EXPO_PUBLIC_*` values reach the app, and they are validated at startup (`apps/mobile/src/lib/env.ts`). Secrets (`ORS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, …) are only for Edge Functions: set them with `supabase secrets set` in hosted projects. Sentry / PostHog are no-ops when their keys are empty.

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
