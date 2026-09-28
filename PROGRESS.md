# Progress

Milestones from the MVP brief. Each milestone ends with lint, typecheck and all tests green, an update here, and a Conventional Commit.

| Milestone                        | Scope                                                                                                           | Status               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| **M0 – Scaffold**                | Monorepo, Expo app on iOS/Android/Web, local Supabase, CI, `.env.example`                                       | ✅ Done (2026-09-26) |
| **M1 – Auth and profile**        | Email/password, magic link, Apple, Google; onboarding; profile CRUD; RLS + tests                                | ✅ Done (2026-09-28) |
| **M2 – Data and map**            | Migrations, ingestion (Lisbon first, then 12 cities), country seed, map + filters + detail sheet, city switcher | ✅ Done (2026-09-28) |
| **M3 – Checklist drawer**        | Visa, power, weather, money, safety, practical; edge functions + caching                                        | ✅ Done (2026-09-28) |
| **M4 – Route builder and trips** | `route-optimize`, route UI, save/list trips, navigation deep links                                              | ✅ Done (2026-09-28) |
| M5 – Polish and QA               | i18n completeness, accessibility, empty/error states, E2E, README                                               | 🟡 Mostly done       |

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

## M1–M4 — Done (2026-09-28)

- **Database:** reference tables (countries, cities, attractions with PostGIS, visa rules, api_cache) and user tables (profiles, nationalities, trips, trip stops) with RLS; RPCs `attractions_in_view`, `set_nationalities`, `save_trip`, `delete_account`; profile created on sign-up; pgTAP: 24 tests.
- **Data:** 250 countries (plugs, voltage, currency, calling code, emergency numbers, languages), 80 cities in 32 countries (12 at launch + 68 added 2026-09-28; list in [docs/CITIES.md](./docs/CITIES.md)), 39,402 visa rules, 14,222 attractions (≤ 300 per city) with images, licences, opening hours and popularity. Committed as SQL seeds (D-011).
- **Edge Functions:** `checklist` (visa, passport validity, power, Open-Meteo weather, FX, Canada advisories, practical info, each degrading independently, cached) and `route-optimize` (ORS + fallback). Both require a signed-in user (D-015). Deno: 40 tests.
- **App:** email/password, magic link + 6-digit code, Google/Apple (PKCE; native Apple on iOS), protected routes, 3-step onboarding, profile edit, language/units, account deletion; Explore with MapLibre map (web + native), city switcher, category filters, accessible list view, attraction detail with image credit; checklist screen; route tray (≤ 12 stops), optimisation, totals, save trip; My Trips list/detail/delete with Google/Apple Maps walking links. Jest: 12 tests. Playwright: smoke + full journey (sign-up → onboarding → checklist → route → saved trip) on desktop and mobile viewports.
- **Verified locally (macOS, 2026-09-28):** `pnpm check`, `pnpm db:test`, `supabase db lint`, Deno lint/fmt/test, pytest (76) + ruff, `pnpm build:web`, `E2E_BACKEND=1 pnpm e2e` 6/6, map rendering on web (screenshots), live checklist for Lisbon with real providers.

## 2026-09-28 — 20 more cities

Berlin, Venice, Florence, Munich, Dublin, Athens, Budapest, Edinburgh, Brussels, Copenhagen, Stockholm, Nice, Seville, Kraków, Warsaw, Naples, Valencia, Zurich, Antalya, Oslo (same limits and filters as the launch cities). Fixes found on the way: YAML `NO` → `false` (quoted + test); GR/PL/SE language overrides; category roots for sculptures, parliament buildings and promenades, and archaeological ruins no longer dropped as "destroyed structures" (Parthenon); class-root cache invalidated when roots change; HTTP client wall-clock deadline (WDQS trickling responses hung ingestion for > 1 h). Cities below the 300 cap have fewer notable places in their area: Nice 64, Antalya 28.

## 2026-09-28 — 20 more cities (batch 3)

Hamburg, Frankfurt, Cologne, Geneva, Salzburg, Bruges, Antwerp, Rotterdam, Helsinki, Reykjavík, Tallinn, Riga, Vilnius, Dubrovnik, Split, Ljubljana, Bratislava, Palma, Málaga, Bologna. Hamburg and Palma use centre-based bboxes (boundaries include a North Sea island / open sea). LT and SI country overrides. Concert halls added as a category root (Elbphilharmonie); all 52 cities re-ingested under the same rules. Most of these cities are smaller: only Helsinki reaches the 300 cap; Dubrovnik has 40. Known gap: Riga's House of the Blackheads is typed only as "building" on Wikidata, too generic to include.

## 2026-09-28 — 8 more cities (batch 4: EU and UK capitals)

Sofia, Zagreb, Nicosia, Luxembourg, Valletta, Bucharest, Cardiff, Belfast — with these, every EU member state's capital and every UK nation capital is covered (asserted by `test_all_eu_and_uk_capitals_are_covered`). Valletta (1 km² municipality) and Cardiff (Nominatim returned a node) use centre-based bboxes. City halls added as a category root; all 60 cities re-ingested (+35 attractions in existing cities). CY override: 1400 is not an emergency line. Smaller cities: Nicosia 47, Belfast 76, Luxembourg 92, Sofia 98.

## 2026-09-28 — 20 more cities (batch 5: secondary cities)

Lyon, Marseille, Bordeaux, Turin, Verona, Pisa, Granada, Bilbao, Córdoba, Manchester, Liverpool, Glasgow, York, Gdańsk, Wrocław, Dresden, Innsbruck, Ghent, Bergen, Gothenburg — no new countries. Córdoba (1,250 km² mostly rural municipality) and Gothenburg (municipality includes the outer archipelago) use centre-based bboxes; Manchester, Liverpool and York OSM relations came from Nominatim (no P402 on Wikidata). Fix: items with a second Wikidata coordinate in another city are seeded where OSM confirms them (Madrid Arena). French communes are small, so counts are low: Bordeaux 58, Marseille 85. Known gaps: Bergen's Bryggen is typed "architectural ensemble" (too broad to include: its subclasses cover hamlets and schools); Marseille's Vieux-Port is a seaport.

## 2026-09-28 — UI redesign (D-020)

Design system (tokens, Inter, shared components with hover/focus/press/loading states) and every screen reworked: Explore card grid with floating Map/List switch and route tray, attraction hero with sticky CTA, desktop map-beside-list for route and trip detail, card grid for trips, grouped profile, two-column checklist, centred auth. Bottom tabs on phones, side rail on desktop. Verified on web at desktop and phone widths (unit tests + full E2E journey); native rendering not yet checked.

## Remaining (M5 and launch)

- Native iOS/Android runs not verified here: this machine has no Xcode/Android SDK. Build with `expo run:ios|android` or EAS (`eas.json` included).
- Offline-lite (persisted query cache with MMKV) is not implemented yet.
- Sentry / PostHog SDKs are not wired (facade ready; needs DSN/keys).
- Native date pickers (D-019) and a map-beside-list layout for Explore on wide screens (D-007) are post-MVP polish; route and trip detail already use it (D-020).
- Owner-only items (accounts, keys, store listings): see [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md).

## Known issues / open questions

- **Without `ORS_API_KEY`** routes are straight-line estimates (clearly labelled in the UI).
- **Bundle id** `com.finperiti.wayfarer` is a placeholder (D-001).
- Portuguese attraction names exist for ~15–55% of places outside Portugal/Rome; the English name is shown as fallback.
- Opening hours come from OSM and cover ~15–30% of places.
- Expo Go cannot load MapLibre; a development build is required.
