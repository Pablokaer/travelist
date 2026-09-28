# Decisions log

Non-trivial choices made while building Wayfarer. Format: context → decision → alternatives considered. Fixed decisions from the brief (Section 2) are not repeated here unless we had to interpret them.

---

## D-001 — Working name and identifiers

- **Context:** The brief used a `{{APP_NAME}}` placeholder.
- **Decision:** Working name **Wayfarer**. Package scope `@wayfarer/*`, Expo slug `wayfarer`, URL scheme `wayfarer`, bundle id / Android package `com.finperiti.wayfarer` (placeholder until the store listings are created).
- **Alternatives:** none; renaming touches `app.json`, package names and this file only.

## D-002 — Expo SDK 57 with the default template as a base

- **Context:** "Latest SDK" at scaffold time (2026-09-26) is SDK 57 (React Native 0.86, React 19.2, TypeScript 6.0).
- **Decision:** Generate `apps/mobile` with `create-expo-app` (default template) so dependency versions match the SDK, then strip the demo UI. Always add dependencies with `npx expo install` inside `apps/mobile`.
- **Alternatives:** hand-written package.json (risk of incompatible versions).

## D-003 — pnpm with `nodeLinker: hoisted`

- **Context:** Expo supports pnpm isolated installs since SDK 54, but the Expo docs warn some React Native libraries still break with isolated layouts. We depend on native libraries (MapLibre, Reanimated, MMKV).
- **Decision:** Use a hoisted layout (`pnpm-workspace.yaml → nodeLinker: hoisted`). Metro's monorepo support is automatic (no custom `watchFolders`).
- **Alternatives:** isolated installs (stricter, but more native build risk); npm/yarn workspaces (brief fixes pnpm).

## D-004 — Test runners: Vitest for pure TS, Jest (jest-expo) for React Native components

- **Context:** The brief lists Vitest for unit tests and React Native Testing Library for components. RNTL relies on the React Native Jest preset (module mocks, Babel transforms, platform resolution); running it under Vitest is unsupported and brittle.
- **Decision:** Vitest for `packages/shared` (and any other pure TS). `jest-expo` + RNTL for `apps/mobile` component tests. Both run through `pnpm test` / Turborepo, so CI sees a single command.
- **Alternatives:** Vitest + community RN shims (fragile across SDK upgrades).

## D-005 — `@wayfarer/shared` ships TypeScript source (no build step), with explicit `.ts` import extensions

- **Context:** The shared package is consumed by Metro (app) and Deno (Edge Functions). Deno requires explicit file extensions on relative imports.
- **Decision:** `packages/shared` exports its `src/` directly. Relative imports inside it use `.ts` extensions (`allowImportingTsExtensions`), which Metro, Vitest and Deno all resolve. The package must stay free of React/RN/Node APIs. External deps are limited to `zod`.
- **Alternatives:** a tsup/tsc build step (extra watch process, stale-build bugs); duplicating schemas in `supabase/functions/_shared` (drift).
- **Follow-up (resolved 2026-09-27):** the edge runtime cannot load files outside `supabase/functions` (verified: "Module not found" for `../../packages/shared`). `scripts/sync-shared.mjs` copies `packages/shared/src` (minus tests) into `supabase/functions/_shared/wayfarer`, which is committed and mapped as `@wayfarer/shared` in `deno.json`. `pnpm check` and CI fail when the copy is stale. The copy is excluded from `deno lint`/`deno fmt`.

## D-006 — ESLint 9 flat config

- **Context:** ESLint 10 is out, but `eslint-config-expo` depends on plugins (react, import) whose peer ranges still target ESLint ≤ 9.
- **Decision:** ESLint 9 with flat config. The app extends `eslint-config-expo/flat`; `packages/shared` uses `typescript-eslint` recommended rules. Prettier runs separately (no eslint-plugin-prettier).
- **Alternatives:** ESLint 10 with peer-dependency overrides.

## D-007 — Tabs implementation

- **Context:** The template ships `NativeTabs` (native iOS/Android tab bars, still under `unstable-` import) plus a separate hand-rolled web tab bar.
- **Decision:** Use the stable JS `Tabs` from `expo-router` for all platforms in the MVP; one implementation, predictable on web, easy to test. On wide web screens we switch to a side-panel layout in M5.
- **Alternatives:** `NativeTabs` (nicer native feel; revisit post-MVP once stable).

## D-008 — Default map style: OpenFreeMap

- **Context:** Tiles must be configurable and must not need hard-coded keys.
- **Decision:** `.env.example` defaults `EXPO_PUBLIC_MAP_STYLE_URL` to OpenFreeMap's "liberty" style (free, no key). MapTiler can be used by swapping the URL (its key is a public, domain-restricted key).
- **Alternatives:** MapTiler as default (needs an account before first run).

## D-009 — Python tooling for the pipeline

- **Context:** Python is used only in `data-pipeline`.
- **Decision:** Python ≥ 3.11, standard `pyproject.toml`, `requests` + `PyYAML` + `pydantic` for config validation, `pytest` + `ruff`. A plain venv is enough (`uv` works too, but is not required).
- **Alternatives:** Poetry (extra tool for contributors).

## D-010 — City geometry in `cities.yaml`

- **Context:** Cities need a centre point and an area for ingestion queries.
- **Decision:** Each city stores its Wikidata QID, OSM relation id, centre and bbox. Values were taken from Wikidata (P625 coordinates) and Nominatim (bbox, OSM relation) on 2026-09-26, not typed from memory. Ingestion queries by bbox first; the OSM relation is available for precise area filters.
- **Alternatives:** polygon files per city (heavier, not needed for MVP).

## D-011 — Reference data ships as committed SQL seeds

- **Context:** Ingestion hits Wikidata, Overpass and Wikimedia and takes a while; every `supabase db reset` would otherwise empty the database.
- **Decision:** The pipeline writes normalised snapshots (`data-pipeline/data/`) and deterministic, idempotent SQL seeds (`supabase/seed/10_countries.sql` … `40_attractions.sql`). Local resets and hosted `db push --include-seed` load them directly; `python -m wayfarer_pipeline seed` regenerates SQL offline.
- **Alternatives:** upsert through PostgREST with the service role (needs network + secrets on every reset).

## D-012 — Country data from Wikidata + curated overrides; advisories from Global Affairs Canada

- **Context:** Plugs, voltage, currency, calling codes and emergency numbers are needed for every possible home country, and safety levels for every destination, without paid APIs.
- **Decision:** Countries come from Wikidata SPARQL (P2853 plugs, P2884 voltage, P38 currency, P474, P2852, P1622, P37) with `data-pipeline/data/country_overrides.yaml` fixing known errors (each with a source). Safety uses the Government of Canada open-data feed (one JSON for all countries, advisory level 0–3, Open Government Licence) plus a link to GOV.UK travel advice.
- **Alternatives:** restcountries.com (v3 API was deprecated during development), GOV.UK content API (no machine-readable level).

## D-013 — FX: Frankfurter (ECB) first, ExchangeRate-API open endpoint as fallback

- **Decision:** `api.frankfurter.dev` (no key, ECB reference rates, ~30 currencies) with `open.er-api.com` (no key, attribution required) for currencies the ECB doesn't publish. `EXCHANGE_RATES_BASE_URL` can point at any Frankfurter-compatible host. Cached 24 h.

## D-014 — Route optimisation: ORS when a key exists, deterministic fallback otherwise

- **Decision:** `route-optimize` uses the ORS optimisation (VROOM) + foot-walking directions APIs when `ORS_API_KEY` is set; otherwise, or on any ORS error, it returns a nearest-neighbour + 2-opt order from `@wayfarer/shared` with straight-line legs × 1.3 at 4.5 km/h, flagged `isFallback` in the UI. Only successful ORS results are cached (30 days).

## D-015 — Edge Functions verify the user, not just the JWT

- **Context:** `verify_jwt = true` at the gateway also accepts the public anon key, because it is a validly signed JWT.
- **Decision:** Keep `verify_jwt = true` and additionally call `auth.getUser(token)` inside `checklist` and `route-optimize`; anonymous calls get 401.

## D-016 — OAuth through Supabase-hosted flows (PKCE); native Sign in with Apple on iOS

- **Decision:** Google (all platforms) and Apple (web/Android) use `signInWithOAuth` with PKCE: a full redirect on web, `WebBrowser.openAuthSessionAsync` on native, and the code exchanged on `/auth/callback`. iOS uses `expo-apple-authentication` + `signInWithIdToken`, as App Store guidelines prefer. Buttons appear only for providers listed in `EXPO_PUBLIC_AUTH_PROVIDERS`. Magic-link emails also carry a 6-digit code, so sign-in works even when the link opens on another device.
- **Alternatives:** `@react-native-google-signin` (native SDK, extra config per platform).

## D-017 — Sessions in SecureStore, chunked

- **Context:** SecureStore values are limited to ~2 KB; Supabase sessions are larger.
- **Decision:** `src/lib/secure-storage.ts` splits the session into 1.8 KB chunks in the Keychain / Keystore. Web uses Supabase's default localStorage.

## D-018 — Web: MapLibre worker served from `public/`, trip detail at `/trip/[id]`

- **Context:** maplibre-gl v6 loads its Web Worker from a separate ES module that Metro doesn't bundle, and the static export can't serve both `/trips` (tab) and a `trips/` folder.
- **Decision:** `apps/mobile/scripts/copy-maplibre-worker.mjs` copies the worker into `public/maplibre/` before `start`/`build:web`, and the map calls `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')`. Trip detail lives at `/trip/[id]`.

## D-019 — Dates are typed as ISO text in the MVP

- **Decision:** Passport expiry and travel dates use a validated `YYYY-MM-DD` text field on every platform (no native date picker dependency). A native picker is a post-MVP polish item.
