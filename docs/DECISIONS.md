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
- **Follow-up (M3):** confirm the Supabase CLI bundles files outside `supabase/functions` via the function's `deno.json` import map on deploy; if not, sync `packages/shared/src` into `supabase/functions/_shared/shared` with a script.

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
