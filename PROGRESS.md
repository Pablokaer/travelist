# Progress

Milestones from the MVP brief. Each milestone ends with lint, typecheck and all tests green, an update here, and a Conventional Commit.

| Milestone                    | Scope                                                                                                           | Status               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| **M0 – Scaffold**            | Monorepo, Expo app on iOS/Android/Web, local Supabase, CI, `.env.example`                                       | ✅ Done (2026-09-26) |
| M1 – Auth and profile        | Email/password, magic link, Apple, Google; onboarding; profile CRUD; RLS + tests                                | ⏭ Next               |
| M2 – Data and map            | Migrations, ingestion (Lisbon first, then 12 cities), country seed, map + filters + detail sheet, city switcher | Planned              |
| M3 – Checklist drawer        | Visa, power, weather, money, safety, practical; edge functions + caching                                        | Planned              |
| M4 – Route builder and trips | `route-optimize`, route UI, save/list trips, navigation deep links                                              | Planned              |
| M5 – Polish and QA           | i18n completeness, accessibility, empty/error states, E2E, README                                               | Planned              |

## M0 — Done

- pnpm workspaces + Turborepo (`lint`, `typecheck`, `test`, `build:web`), Prettier, EditorConfig, Node 22.
- `apps/mobile`: Expo SDK 57, Expo Router, typed routes, React Compiler; tabs (Explore / My Trips / Profile) + About (data sources) + 404; light/dark theme tokens; EN/PT via i18next with device-locale detection and a working language switch; zod-validated public env; TanStack Query provider; observability facade (no-op without keys).
- `packages/shared`: constants (categories, default visit minutes, visa enum, route limits), base zod schemas, EN/PT resources with key-parity tests.
- `supabase/`: CLI config (redirect URLs for web + `wayfarer://`), migration enabling PostGIS + `set_updated_at()`, pgTAP smoke tests (incl. "RLS enabled on every public table"), `health` Edge Function with Deno tests.
- `data-pipeline/`: Python package, validated `cities.yaml` with all 12 launch cities (ids/centres/bboxes from Wikidata + Nominatim), CLI (`validate-config`, `ingest` stub), pytest + ruff.
- CI: app (format, lint, typecheck, unit, web export, Playwright), database (migrations, pgTAP, `db lint`), functions (deno lint/fmt/test), pipeline (ruff, pytest).
- Docs: README, ARCHITECTURE, DECISIONS (D-001…D-010), DATA_SOURCES.

**Verified locally (cloud dev container):** `pnpm check` green (Jest 5 tests, Vitest 6 tests), `expo export -p web` OK, Playwright 4/4 (desktop + mobile viewport), `supabase start` + `supabase test db` 4/4, `health` function responds via the local gateway, `supabase db lint` clean, pytest 8/8, deno test 2/2.

**Not verified here:** iOS simulator and Android emulator runs (need macOS/Android tooling) — run `pnpm dev` and press `i` / `a`.

## Next (M1)

1. Migrations: `profiles`, `profile_nationalities` (+ RLS, cascade from `auth.users`), account-deletion RPC.
2. Supabase client with `expo-secure-store` session storage (native) and auth state provider.
3. Auth screens: email/password, magic link (deep link `wayfarer://auth/callback`), Apple, Google.
4. 3-step onboarding + profile screen with shared zod schemas (≥ 1 nationality, optional passport expiry).
5. pgTAP RLS tests for both user tables; component tests for onboarding validation.

## Known issues / open questions

- **Credentials needed for M1:** Apple Developer (Sign in with Apple service id + key) and Google Cloud OAuth client ids (iOS, Android, Web). Flows will be built with placeholders until provided.
- **Bundle id** `com.finperiti.wayfarer` is a placeholder (D-001).
- **Shared code in Edge Functions on deploy** needs confirming in M3 (D-005).
- Expo Go cannot load MapLibre; a development build is required from M2.
