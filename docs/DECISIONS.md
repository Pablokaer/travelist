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

## D-020 — Design system: neutral base, one accent, Inter, soft elevation

- **Context:** the MVP UI was functional but visually plain: bordered grey boxes stacked vertically, system fonts, the same weight for primary and secondary actions.
- **Decision:** a small in-house design system, inspired by the calm, image-led feel of marketplace travel apps (without copying any product's components or brand):
  - **Colour:** white surfaces, near-black text (`#222`), soft greys for secondary text, dividers and muted backgrounds, and one coral accent (`#D7383B`, 4.6:1 on white) used only for primary actions, selection, active states and route markers. Status colours (success, warning, danger, info) appear only in checklist status pills and errors. Dark tokens exist for users who pick the dark theme (D-021).
  - **Type:** Inter (`@expo-google-fonts/inter`, SIL OFL) in four weights, loaded before the splash screen hides; an 8-step scale (display, title, heading, subtitle, body, label, caption, helper). `Text` maps `fontWeight` to the matching Inter family because custom fonts ship one family per weight.
  - **Shape and depth:** radii 8–24 px, hairline borders, `boxShadow` elevation in three levels (card, raised, floating).
  - **Interaction:** a shared `Tappable` (press-in scale via RN `Animated`, hover on web, keyboard-only focus ring), spinner-in-place loading buttons.
  - **Layout:** breakpoints at 600 / 1024 px; bottom tabs on phones, side rail on desktop; modals as page sheets on phones and centred dialogs on larger screens; content widths 440 / 760 / 1200 px.
  - **Icons:** `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/web) behind an `Icon` wrapper with a fixed name map.
- **Trade-offs:** one more dependency (the font package, ~1 MB of font files). No animation library beyond RN `Animated`, to keep Jest setup unchanged. Some SF Symbols are approximations for attraction categories.

## D-021 — Light by default; dark theme as a user preference

- **Context:** D-020 shipped light and dark tokens that followed the system setting. The product direction is a light, image-led look, but users asked to choose a dark theme themselves.
- **Decision:** the theme is a **profile preference** (`profiles.theme`, `light` | `dark`, default `light`), picked in Profile → Preferences next to language and units. The system dark-mode setting is not followed. `ColorSchemeContext` (set in the root layout from the profile) drives `useTheme()`, `useShadows()`, the navigation theme and the status bar; on iOS/Android `Appearance.setColorScheme` makes keyboards and system dialogs match. The change is applied optimistically to the cached profile, so the app switches at once and rolls back if the save fails.
- **Why the profile, not device storage:** it follows the user across devices like language and units, and needs no new storage dependency.
- **Trade-offs:** signed-out screens (sign-in, sign-up, magic link) are always light because there is no profile yet; the map style stays light in dark mode.

## D-022 — Routes are ordered as you pick, and can be split by proximity

- **Context:** the route kept the order in which places were picked until the user pressed Optimise, and a long selection (up to 12 stops) could only become one walk.
- **Decision:**
  - **Order on pick, on the device.** The first pick is the start; each new pick is slotted in and the route re-ordered with the same nearest-neighbour + 2-opt used by the offline fallback (`orderFromStart`, `packages/shared/src/domain/route-plan.ts`), on straight-line distance. Instant and offline; **Optimise** still asks `route-optimize` (ORS) for street distances, per route.
  - **Manual order wins once used.** Moving a stop switches to manual order: new picks go where they add the least walking (cheapest insertion) without re-sorting; "Reorder automatically" returns to the computed order.
  - **Split** from 5 stops (`ROUTE_SPLIT_MIN_STOPS`), ≥ 2 stops per route. "Split here" cuts at a chosen point; the suggestion (`splitRoute`) cuts the optimised walk where it drops the longest legs (best over every contiguous cut), then moves single stops between routes while that shortens the total. The first route keeps the start; the others start where their walk is shortest. Deterministic, ~1 ms for 12 stops.
  - **Saved as separate trips** ("{name} · Route {n}") through the existing `save_trip` RPC: no schema change.
  - **Route colours:** one per route (accent, then the status hues plus purple and teal), per colour scheme, in `features/route/route-colors.ts`.
- **Trade-offs:** reordering uses up/down buttons, not drag and drop (no gesture/animation dependency). The on-device order is straight-line based, so ORS may re-order a route slightly when optimising. Split routes are not linked to each other once saved.

## D-023 — Balanced route splits

- **Context:** D-022's "Suggest a split" minimised total walking only, so it could leave one route with most of the places (e.g. 3 + 9). Users split a selection to spread it over days or parts of a trip, so each route should be a similar amount of time out, while walks stay short.
- **Decision:** `splitRoute` minimises `splitCost = walking minutes + SPLIT_BALANCE_WEIGHT × Σ |route time − average route time|`, where a route's time is its visits (`avgVisitMinutes`, 30 min when unknown) plus straight-line walking at 4.5 km/h, and `SPLIT_BALANCE_WEIGHT = 0.5`. Search: the best contiguous cuts of the walking order (exhaustive, memoised), then hill-climbing over single-stop moves and pairwise swaps between routes. The first route keeps the user's start; every route keeps ≥ 2 stops. Deterministic, under 10 ms for 12 stops.
- **Why time, not just the number of places:** a 3-hour museum and a 15-minute viewpoint are not the same load; balancing time spreads long visits across routes (tested: two 3-hour museums end up in different routes), and with similar visits it also evens out the number of places.
- **Trade-offs:** the weight is a judgement call: at 0.5, evening out an hour of imbalance is worth 30 extra minutes of walking, so far-apart neighbourhoods (10 km) still stay separate. Straight-line walking underestimates real streets; the split is recomputed on demand, not after every pick.

## D-024 — Explore layout: one page container, compact header, width-driven grid

- **Context:** the Explore header stacked three full-width rows (city + checklist, search, category tabs, ~205 px on desktop) with no logo; the search stretched to 1200 px, the tabs were left-aligned with nothing to anchor them, and the card grid picked its columns from the window width, ignoring the 104 px desktop rail (3 wide columns at 1180 px, ~300 px of empty margin at 1920 px).
- **Decision:**
  - **One container** (`layout.page`, 1440 px + gutter) for the header rows and the card grid, so the logo, the "N places" title and the first card share a left edge and the action and the last card share a right edge.
  - **Header composition** (`features/destinations/explore-header.tsx`), chosen from the container's measured width, not the window: `[logo] [city pill + search] [Before you go]` in one row when the content is ≥ `INLINE_HEADER_MIN_WIDTH` (two 168 px side slots + gaps + a 580 px search group); otherwise logo + action on top and the city + search group below; on phones the logo mark, city pill and icon action share a row with the search below. The city + search group is centred and capped at 640 px.
  - **Category tabs** form one centred group when they fit and scroll edge to edge (starting at the gutter) when they don't.
  - **Grid columns** follow the grid's own width: as many ≥ 240 px cards as fit (`gridColumns`, `theme/grid.ts`), 24 px column gap, 32 px row gap — 1 column on phones, 2 on tablets, 3–5 on desktop.
- **Trade-offs:** the single-row decision needs one layout pass, so a desktop first frame can show the stacked header. Only Explore uses the 1440 px container; the other grid screens keep `layout.wide`.

## D-025 — Exact route ordering and a single ORS call

- **Context:** on-device ordering (D-022), split routes (D-023) and the offline fallback (D-014) used nearest neighbour + 2-opt. Measured on 300 random routes in central Amsterdam, it missed the shortest walk on 13% of 6-stop, 29% of 9-stop and 46% of 12-stop routes, by 4.7% on average and up to 21%. `route-optimize` made two ORS requests per route (VROOM optimisation, then foot-walking directions for legs and geometry). Its cache key used the stops in request order, so "Optimise" again after the app applied the optimised order missed the cache, and the route screen re-sent every route of a split when one changed.
- **Decision:**
  - **Exact ordering** (`optimizeOrder`, `optimizeOrderAnyStart` in `packages/shared/src/domain/route.ts`): Held-Karp dynamic programming over subsets on the straight-line distance matrix, O(2ⁿ·n²): at most 0.4 ms (fixed start) / 0.9 ms (any start) for 12 stops, and `splitRoute` at 12 stops in under 1 ms. A free start is one pass instead of one optimisation per candidate start. Ties are broken deterministically; with a free start, a path and its reverse tie, and the one starting from the earlier-listed stop wins.
  - **One ORS request:** `/optimization` with `options.g` returns the route geometry (encoded polyline, decoded in `route-optimize/polyline.ts`) and cumulative distance/duration per step, from which the legs are derived. Checked live on 12 Amsterdam stops: 6758 m / 4864 s against 6756.6 m / 4864.5 s from the directions call; the directions request is dropped.
  - **Canonical requests:** `normalizeRouteInput` keeps the start (when `keepFirst`) and sorts the other stops by id, for the cache key and the provider call, so the same set of places hits the cache in any order and gets the same answer.
  - **Client:** `routesToOptimize` sends only the routes without a result for their current order.
- **Kept:** VROOM for the street-network order. On the measured Amsterdam set it matched the exact optimum on the ORS walking-time matrix, so replacing it with a matrix call + local exact search would add a request without improving the result.
- **Trade-offs:** Held-Karp is exponential; fine up to `ROUTE_MAX_STOPS` (12), not beyond ~16. Without the directions call, stops are snapped with VROOM's default radius instead of `radiuses: -1`; a stop VROOM cannot snap already failed the optimisation before, so no route that worked is lost. Cached ORS entries written under the old key shape are simply not reused.

## D-026 — Home of destinations; city pages by URL

- **Context:** after sign-in the app opened straight on one city's attractions — the first city of `city_list` A–Z (Amsterdam), or the route tray's city — kept in the Explore store. There was no place to discover the cities, and a city could not be linked.
- **Decision:**
  - **Routes:** the Explore tab becomes a stack, `(tabs)/(explore)/`: `index` is the **Home** (`/`, the covered cities) and `city/[slug]` the **city page** (`/city/amsterdam`), which is the former Explore screen (moved with its history) reading the city from the URL instead of the store. Keeping both inside the tab keeps the tab bar / side rail on city pages. The store keeps only filters and view mode; switching city in the pill sets the URL param.
  - **Back to the Home** reuses what is there: the header logo becomes a link to `/`, pressing the already active Explore tab returns to the Home, and back / browser back work through the stack. No extra button.
  - **City data:** `city_list` gains `country_name_en/pt` (join with `countries`) and a **cover photo**: the image of the city's most popular attraction that has one, with its author and licence (a lateral subquery on `attractions_city_popularity_idx`). No new source or integration; every Commons image keeps its credit, shown on the card. Only rows the view returns are shown, so inactive cities (RLS) never appear and no city is added by hand.
  - **Search:** two contexts, two functions over already loaded data — `searchCities` on the Home (city names EN/PT, then countries), `searchAttractions` on the city page — sharing the matching rules and a `SearchField` component.
  - **Shared pieces:** `BrowseHeader` (logo, optional lead, search, optional action, content below) serves both pages, `CardGrid` both grids (D-024 rules), `CityCard` reuses the attraction card's image treatment (`Thumbnail`).
- **Trade-offs:** a city's cover is whatever its most popular photographed attraction looks like (e.g. an aerial photo of the Anne Frank House for Amsterdam), not a curated skyline; curating covers would need new data. The Home lists cities A–Z; no ranking or featured cities yet.

## D-027 — Drag and drop for route stops with PanResponder

- **Context:** the route builder only reordered stops with move up / move down, one place per tap; moving the last of 12 stops to the start took 11 taps.
- **Decision:**
  - A **grip** on each stop row (next to the arrows, which stay for accessibility and precise moves) starts a drag; the row follows the pointer, the rows it passes slide by its height, and the drop calls the store's new `moveTo(id, to)` (`move` is now built on it).
  - The drop position is pure maths over the rows' measured boxes (`dropIndex`, `rowShift` in `features/route/stop-drag.tsx`): the number of other rows whose centre is above the dragged row's centre.
  - Built on React Native's core **PanResponder**, not `react-native-gesture-handler` + Reanimated: it works on web, iOS and Android without adding a `GestureHandlerRootView` at the app root, and a list of at most 12 rows doesn't need UI-thread animation. The page's `ScrollView` is paused (`Screen scrollEnabled`) while a drag is active so the gesture isn't taken over by scrolling; on web the grip sets `touch-action: none`.
- **Trade-offs:** the drag runs on the JS thread (one re-render per move), fine for ≤ 12 rows. Stops move only within their route; dragging between split routes is not supported. No auto-scroll when dragging past the visible edge of a long list on a small screen.
