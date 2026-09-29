# Decisions log

Non-trivial choices made while building Wayfarer. Format: context → decision → alternatives considered. Fixed decisions from the brief (Section 2) are not repeated here unless we had to interpret them.

---

## D-001 — Working name and identifiers

- **Context:** The brief used a `{{APP_NAME}}` placeholder.
- **Decision:** Working name **Wayfarer**. Package scope `@wayfarer/*`, Expo slug `wayfarer`, URL scheme `wayfarer`, bundle id / Android package `com.travelist.app` (placeholder until the store listings are created; renamed 2026-09-29 so no company name appears in the project).
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
- **Performance:** the pointer offset is an `Animated.Value` (set directly, no re-render); the list re-renders only when the hovered slot changes, and the React Compiler keeps unchanged rows memoised. The route lists are keyed by position, not by stop order, so a reorder doesn't rebuild them.
- **Trade-offs:** the drag still runs on the JS thread (no native driver for gesture-driven values), fine for ≤ 12 rows. Stops move only within their route; dragging between split routes is not supported. No auto-scroll when dragging past the visible edge of a long list on a small screen.

## D-028 — Attraction reviews on Postgres + RLS

- **Context:** travellers wanted to rate places and read others' experiences: a 1–5 star rating and a comment per user and attraction, public, editable and deletable only by the author, with the average and count next to the attraction name.
- **Decision:**
  - **Same stack as trips:** a table (`attraction_reviews`) with RLS, a `plpgsql` RPC for the write (`save_review`, like `save_trip`), a `security_invoker` view for the aggregate (`attraction_rating_summary`) and TanStack Query hooks (`features/reviews/api.ts`). No Edge Function: nothing needs a secret or an external call.
  - **One review per user and attraction** is a unique constraint; `save_review` is an upsert on it, so "publish" and "edit" are one path and a second review cannot exist. Update and delete policies check `auth.uid() = user_id`, so a user cannot touch someone else's review, even through the REST API.
  - **Rating** is a `smallint` with a 1–5 check (a fractional JSON value fails the integer cast); **comment** is optional — the project had no rule requiring it — trimmed, blank stored as null, at most 1000 characters. The same limits are in `reviewFormSchema` (`packages/shared`) so the form explains them before the request.
  - **Author names:** profiles are owner-only under RLS, so `list_attraction_reviews` is `security definer` and returns only the display name and `is_own` — not the author's id or anything else of the profile. Authors without a display name are shown as "Traveller".
  - **Aggregate in SQL:** `round(avg(rating), 2)` and `count(*)` over every review, one row per attraction (0 and null without reviews); the UI shows one decimal. Computed on read: cheap with the `(attraction_id, user_id)` index at this scale, and never stale.
  - **UI:** stars are the ★ glyph — same rendering on every platform — in **gold** when filled (`theme.star`: `#E5A50A` light, `#F5C542` dark) and the strong border colour when empty; in "4.6 ★ · 128 reviews" and "3.5 ★" only the star is gold, the number keeps the text colour. The coral accent stays for actions (D-020). Gold on white is 2.3:1, under the 3:1 WCAG asks of graphics (only a dark goldenrod such as `#B8860B` reaches it); accepted because a rating is never shown by colour alone — the number is beside it and every star control has a spoken label ("Rated 4 out of 5", "4 stars", checked). The picker is a radio group (each star "N stars", checked when chosen). The form uses react-hook-form + zod like the other forms, and delete asks for confirmation inline, like trips.
- **City cards:** the city page reads the ratings of all its places in one request — `attraction_rating_summary` filtered by `city_slug` and `review_count > 0` (the filter reaches the attractions' city index) — instead of adding columns to the public, cached `attractions_in_view` or one request per card. The card shows "3.5 ★" as a caption beside the name, and the rating joins the card's spoken label.
- **Trade-offs:** reviews are visible to signed-in users only (every screen but About needs sign-in). The page shows the 50 newest; no "load more", reporting or moderation yet. Aggregates computed per read would need a cached column or materialized view at much larger volumes.

## D-029 — Photo markers and a card popup on the city map

- **Context:** the city map drew places as category-coloured dots and a tap opened the attraction page straight away, so the map gave no preview of a place and adding it to the route meant switching to the List.
- **Decision:**
  - **Native map annotations, not a GL layer:** `maplibre-gl`'s `Marker` (web) and MapLibre React Native's `Marker` (iOS/Android) hold React content — the web renders it through portals into the marker elements — so a marker is our `PhotoMarker` built on the existing `Thumbnail` (same photo and placeholder as the cards). A symbol layer with runtime images would scale further but needs each photo decoded into a circular sprite and a second rendering path per platform; a city has at most a few hundred places.
  - **Small images:** markers load the Commons 120 px thumbnail (`thumbnailUrl` rewrites the stored 960 px one to that standard width), ~5–10 KB each; all ~290 Lisbon thumbnails loaded with HTTP 200 in the E2E probe.
  - **Popup = the List card:** `AttractionCard` gained `compact` (narrower, own surface, rating on its own line) and is rendered in `maplibre-gl`'s `Popup` (automatic anchor keeps it inside the map; `closeOnClick` off, the page decides) or a native `Marker` anchored above the point. Its **+** is the same `RouteCheckbox`, a sibling of the pressable card so its press never opens the place, wired to the page's existing `toggleWithNotice`; the card's press is the existing `openAttraction`. No route logic or navigation changed.
  - **Selection lives in the city page** (`selectedId`); the map reports marker presses (`onPointPress`) and presses on empty spots (`onMapPress`: a click whose target is not a marker or popup and that hits no dot). A marker click stops propagating so it never reaches the map as an "empty" press.
  - **Floating UI:** the "N places" pill and the Map/List switch + route tray cover parts of the map, which maplibre cannot know; the page passes them as `overlayInsets` (the bottom one measured with `onLayout`) and the map pans an opening popup out of them (`popupPanY`).
  - **Opt-in:** `markers="photo"`; the route and trip maps keep the numbered dots.
- **Trade-offs:** no clustering (none existed): at city zoom dense areas overlap; the selected marker is drawn on top and zooming separates the rest. The native version (and its popup placement near the screen edges) is untested on this machine.

## D-030 — Up to 20 stops per route

- **Context:** a route (tray, `route-optimize`, `save_trip`, `trip_stops`) held at most 12 stops (`ROUTE_MAX_STOPS`). The owner first asked to remove the limit, then settled on 20. The old number also protected the exact ordering (Held-Karp, O(2ⁿ·n²): ~1 ms at 12 stops, ~4 s at 20) and bounded "Suggest a split".
- **Decision:**
  - **Limit 20** (`ROUTE_MAX_STOPS`), counted over the whole tray as before: the store refuses a 21st stop ("Your route already has 20 stops."), `routeRequestSchema` has `.max(20)`, `save_trip` needs 2–20 stops and `trip_stops.position` is 0–19 (migration `20261001000300`).
  - **Ordering:** exact up to `EXACT_ORDER_MAX_STOPS` (12, unchanged results); for 13–20, nearest neighbour + 2-opt — from the fixed start, or with a free start from three candidates (the first stop and the two ends of the longest stretch). Deterministic, ~1 ms.
  - **Split:** still at most 6 routes (`ROUTE_MAX_SPLIT_PARTS`, what 12 stops allowed). Two work caps bound the search: when there are more than 20 000 ways to cut the walking order, each cut is searched only near an even split; the hill climb evaluates at most 1 500 neighbouring splits. Counts, not timers, so results stay deterministic. Measured while there was no limit: ≤ 90 ms at 20 stops, ~1 s at 60, ~2 s at 100 — so raising the limit later is mostly a matter of changing the constant, the schema and `save_trip`.
  - **Unchanged:** the Google Maps link still carries origin + 9 waypoints + destination (trips offer per-leg links), and ORS failures fall back to the labelled straight-line estimate.
- **Trade-offs:** 13–20-stop routes get a near-shortest order, not a guaranteed shortest one.

## D-031 — Walk list visibility: private, public or password

- **Context:** a saved trip (walk list) was visible only to its owner. The owner asked for three states: **public** (anyone with the link), **private** (owner only) and **password** (anyone with the link who knows the password the owner gives them), a share button, and the ability to change the state later.
- **Decision:**
  - **A `visibility` column on `trips`** (`private` default, `public`, `password`; DB check) instead of a separate "shares" table: one state per list, set by its owner, is what was asked. Existing trips become private, as they were.
  - **The tables stay owner-only.** Others read a trip only through `shared_trip(id, password)`, a `security definer` RPC granted to `anon` and `authenticated` that returns `{status}`: `ok` (+ the trip, its stop ids in order and `is_owner`), `not_found`, `password_required` or `wrong_password`. Opening RLS on `trips` to others would have leaked every public trip through the REST API (listing without a link) and could not check a password. Private and missing trips are both `not_found`, so a link never reveals that a private list exists. Trip ids are random UUIDs, so links cannot be guessed.
  - **Passwords are bcrypt hashes** (`pgcrypto`'s `crypt` + `gen_salt('bf')`) in `trip_passwords`: RLS on, no policies, no grants, so no client role (owners included) can read a hash; only the two RPCs use it. 4–72 characters (bcrypt reads 72 bytes), never trimmed. `set_trip_visibility` needs a password the first time, keeps the current one when saved again with none, and a trigger deletes the hash when the list leaves `password` (so a direct `update` by the owner cannot leave a stale password behind).
  - **Null-safe owner check:** signed out, `auth.uid()` is null, so `user_id = auth.uid()` is null and `not is_owner` would skip the private and password checks; `shared_trip` uses `coalesce(…, false)`. Found by the pgTAP test that opens a protected list as `anon`.
  - **Link = `/shared?id=<trip id>`**, a static page open to everyone (outside the sign-in guards), not `/shared/[id]`: the web export is static, and dynamic pages (`shared/[id].html`) need rewrite rules on the host — `expo serve` answers 404 for them when opened directly, which is exactly how a shared link is opened. The link uses `EXPO_PUBLIC_WEB_URL` when set (links shared from phones open in any browser), else `expo-linking`'s URL (web origin, or `wayfarer://`).
  - **Share button:** React Native's `Share` on iOS/Android, `navigator.share` on web when present, else a copy to the clipboard ("Link copied."), behind a small injected interface (`features/trips/share-link.ts`). Shown only when the _saved_ visibility is public or password, so the owner never shares a link that does not open.
  - **Visitors** see the list read-only (map, totals, stops, Google / Apple Maps links) through the same `TripView` as the owner. Signed out, stops are not tappable (attraction pages need an account) and **Plan your own walks** leads to sign-up. The typed password is kept only in the screen's state and sent with each request; nothing is stored on the device.
- **Alternatives:** per-person sharing (invite by email) — more than asked, and needs accounts for visitors; a random share token separate from the trip id — would allow revoking a link without going private, at the cost of another column and flow; hashing in an Edge Function — no benefit over `pgcrypto`, one more hop.
- **Trade-offs:** no limit on password attempts (bcrypt slows each one; a rate limit needs an Edge Function or a failed-attempts table); revoking a link means going private; the native share sheet is untested on this machine.

## D-032 — Filter city pages by minimum rating

- **Context:** with reviews (D-028) and card ratings in place, users asked to see only places rated "3+, 4+ or 5+" stars, keeping the current filter row.
- **Decision:**
  - **Three radio tabs in the category row** (★ 3+, ★ 4+, ★ 5+), after a divider, drawn like the category tabs (`FilterTab`). A minimum ("at least N") rather than exact bands, so one choice is enough; pressing the active tab clears it instead of adding an "Any" tab.
  - **Filtered on the device** with `withMinRating`, over the city's averages that `useCityRatings` already loads for the cards: no new query, and it applies to the map, the grid and the count at once. Search and categories apply first.
  - **Places without reviews are hidden** while a minimum is set: they have no average to compare, and showing them would defeat "only well-rated places".
  - Kept in the explore store beside the categories, so it survives switching cities.
- **Alternatives:** filtering in `attractions_in_view` (a join with the rating view) — a second source of truth for the averages and a refetch per change; a slider or 1–5 options — "1+" and "2+" filter almost nothing.
- **Trade-offs:** "5+" means an average of exactly 5.0, so places with many reviews rarely qualify; with few reviews in a city, 3+ can leave the page nearly empty (the "No places match these filters." state explains it).

## D-033 — City page hub at `/short/[slug]`; attractions stay at `/city/[slug]`

- **Context:** a city card on the Home opened the attractions (Map / List) straight away. The owner asked for a page per city — photo, rating, About, walk lists, Before you go, reviews — with the attractions one button away, without rebuilding the attractions page or breaking its URL.
- **Decision:**
  - **`/short/[slug]`** (the owner's choice) is the hub; **`/city/[slug]`** keeps the unchanged attractions page, so old links still work. Both live in the Explore stack (tab bar, back to the Home). The hub uses the stack header (city name + back), like the attraction page.
  - **Composition, not new features:** the hub places existing pieces — the city's `city_list` cover and credit, `RatingSummaryLine`, `ReviewsSection`, the checklist sections (extracted into `ChecklistSections` + `useCityChecklist`, now shared with `/checklist/[city]`), and the walk list card shared with My Trips.
  - **Before you go inline** assumes a trip starting today; the dates live on the checklist page (**Choose your dates**), so the hub stays one screen and the Edge Function contract is unchanged.
  - **Per-section states:** each section loads, fails (retry) or is empty on its own; nothing hides the page.
- **Alternatives:** hub at `/city/[slug]` and attractions at `/city/[slug]/attractions` — cleaner URLs, but it would change what every existing `/city/…` link shows.
- **Trade-offs:** two URL families for one city; the hub makes ~6 small requests (city about, rating, two walk list previews, reviews, checklist).

## D-034 — One `reviews` table for attractions, cities and walk lists

- **Context:** cities and walk lists needed the same reviews as attractions (1–5 stars, optional comment, one per user, author-only edit/delete, public to signed-in users).
- **Decision:** rename `attraction_reviews` to `reviews` and add nullable `city_slug` and `trip_id` next to `attraction_id`, with a `num_nonnulls(...) = 1` check and a unique (target, user) constraint per column. Every target keeps a real, cascading foreign key. `save_review` and `list_reviews` take the target as one of three parameters; the `rating_summary` view adds reviews per star (`rating_counts`) for the distribution bars. Trips are reviewable only when shared and not the reviewer's own (`trip_open_to_caller` in the insert/update policies). The app's review hooks and `ReviewsSection` take a `ReviewTarget`.
- **Alternatives:** a polymorphic `(target_type, target_id text)` pair — one column but no foreign keys or cascades; a table per target — three copies of the same rules, RPCs and UI wiring.
- **Trade-offs:** one more column per future target type; `list_attraction_reviews` and the old `save_review(uuid, int, text)` signature are dropped (the app is updated in the same change).

## D-035 — Community and official walk lists are public trips; saved lists are references

- **Context:** the city page shows the best public walk lists of travellers and official lists curated by the platform; users save other people's lists and rate them. The app already had trips with `private` / `public` / `password` (D-031) and no roles.
- **Decision:**
  - **One entity:** community lists are `trips` with `visibility = 'public'`; official lists are public trips with `is_official`, set only by **moderators** (`moderators` table managed in SQL, `is_moderator()`, `set_trip_official`). A trigger rejects `is_official` from non-moderators and clears it when a list stops being public, so owners can always make their list private. Official cards say "by Travelist".
  - **Listing:** `list_walklists` (security definer; trips stay owner-only) returns card rows — author, stops, times, average, count, saved/own flags — in one query, filtered by city, official flag, name (ILIKE with the text escaped) or the caller's saved lists, sorted `top` / `lowest` / `most_reviewed` / `newest`, paged by limit/offset. Previews fetch 7 rows to know if there are more without counting.
  - **Saving** is a reference in `saved_trips` (the owner's choice), shown under My Trips → Saved and opened read-only through `/shared?id=…`; lists with a password can be saved (by someone who has the link) but are never listed on city pages.
  - **Rating** happens on the shared list page with the shared `ReviewsSection` (D-034).
- **Alternatives:** copying a list into the saver's trips (no new table, but no link to the original's rating or edits); a role claim in the JWT (needs an auth hook; a table is enough and testable in pgTAP); keyset pagination (offset is enough at this scale).
- **Trade-offs:** no admin screen for moderators; no count of lists; offset paging can repeat or skip a row when lists change between pages.

## D-036 — City "About" text from the Wikipedia lead

- **Context:** the About section needs a short BIO per city, from data, not hardcoded; cities had none.
- **Decision:** the pipeline's `city-summaries` command takes each city's en/pt Wikipedia titles from its Wikidata sitelinks and stores the plain-text `extract` of the Wikipedia REST summary in `cities.summary_en/pt` (with `wikipedia_en/pt`), through the committed `data/city_summaries.json` and `20_cities.sql` like all reference data. The app shows the app-language text (else the other one) with "From Wikipedia · CC BY-SA 4.0" and a link to that same article.
- **Alternatives:** Wikidata descriptions (CC0, but one line — "capital of the Netherlands"); hand-written text in `cities.yaml` (control, but ~160 texts to write and maintain).
- **Trade-offs:** CC BY-SA requires the attribution and link on screen; Portuguese articles mix European and Brazilian spelling; texts change only when the command is re-run.

## D-037 — Demo community data is local-only SQL, one file per city

- **Context:** the city page feed (city rating and comments, place reviews, community and official walk lists) needs realistic multi-user, multi-language data to test, city by city.
- **Decision:** hand-written SQL in `supabase/demo/`: shared `accounts.sql` (six friends plus a moderator editorial account, fixed ids, one known password), then `<city>.sql` and `<city>.check.sql` per city. `pnpm db:demo <city>` (`scripts/seed-demo.mjs`) pipes them into the local `supabase_db_<project_id>` container's `psql`. Rows are inserted as `postgres` with explicit past dates, so feeds have realistic ordering, and the transaction acts as the moderator so the official-list guard still runs. Places are found by Wikidata id, list ids come from `md5(key)` so share links survive re-runs, and the route numbers use the app's own offline fallback model. Each city file first deletes the demo accounts' content in that city, so re-runs are idempotent.
- **Alternatives:** files in `supabase/seed/` (rejected: `db push --include-seed` would put fake accounts in production, and that folder is pipeline-generated); calling the RPCs over HTTP as each user (rejected: every row would be dated "now" and it needs the API up); `supabase db query -f` (rejected: it refuses multi-statement files).
- **Trade-offs:** Docker access to the local container is required; `db:reset` removes the demo data; RLS is bypassed on insert, so the check file (`list_walklists`, `list_reviews`, `rating_summary`, no self-reviews) guards consistency.

## D-038 — Walk list cover: the starting point's photo, chosen in the database

- **Context:** walk list cards had no image, only the city flag, so a grid of lists looked all alike. Each list should be recognisable at a glance.
- **Decision:** the card shows the photo of stop 0 or, when that place has no photo, of the next stop that has one, with its Commons credit. One SQL function, `walklist_cover(trip)` (security invoker, returns `{url, author, license}` or null), is the only rule: `list_walklists` returns it as `cover`, and My Trips reads it as a PostgREST computed column (`trips?select=…,walklist_cover`). The app parses it with `walklistCoverFrom` and reuses the city card's `PhotoCredit`.
- **Alternatives:** picking the photo in the app from the embedded stops (rejected: the same rule twice, in SQL and TypeScript, and more data per card); a stored `trips.cover_*` column (rejected: goes stale when stops change or a city is re-ingested); strictly stop 0 with a placeholder otherwise (rejected: a blank card whenever the start has no photo).
- **Trade-offs:** one extra indexed lookup per listed trip; a list whose first stop has no photo shows a later stop's photo, not literally its starting point.

## D-039 — Profile photos in a public Storage bucket, resized on the device

- **Context:** users want a photo on their profile. Its main value is being seen next to their reviews by other travellers.
- **Decision:** Supabase Storage bucket `avatars`, **public read**, created by a migration with a 2 MiB limit and JPEG / PNG / WebP only. RLS on `storage.objects` lets each user write only under `<user id>/`, and `profiles.avatar_path` must point inside that folder (DB check). The app picks with `expo-image-picker`, cuts the centre square and resizes to 512 px JPEG with `expo-image-manipulator`, behind `lib/photo-picker.ts`. Each upload gets a new file name (`avatar-<ms>.jpg`) and the previous file is deleted, so no cache shows a stale photo. `list_reviews` returns the author's path, and the app builds the public URL without a request.
- **Alternatives:** a private bucket with signed URLs (rejected: one extra request per review author, and the URLs expire in caches); storing the image in `profiles` as base64 (rejected: bloats every profile read); third-party avatars such as Gravatar or OAuth pictures (rejected: not every user has one, and it leaks the email hash); server-side resizing (Image Transformation needs the Pro plan).
- **Trade-offs:** a photo is visible to anyone who has its URL. Files do not cascade with the account, so the app deletes them before `delete_account`, and deletions made outside the app leave orphans. Two new native modules need a new development build.

## D-040 — Access to a walk list does not depend on knowing its URL

- **Context:** the owner set the rule: public lists made by users can be viewed by anyone, even someone who guesses the URL, but only the owner edits them; a guessed URL of a private list must give an error — only the owner views and edits private lists.
- **Decision:**
  - **Editing** stays owner-only in the database whatever the visibility (RLS on `trips` / `trip_stops`, `set_trip_visibility`); proven for public and password lists, visitors who saved a list and signed-out users (`40_trip_visibility.test.sql`).
  - **Viewing** goes through `shared_trip` only: public → the list, password → the prompt, private or missing → `not_found` ("Walk list not available"; the same answer, so a guess never reveals that a private list exists).
  - **The owner's editing page** (`/trip/[id]`) reads `trips` with `maybeSingle`: no row means the list is not the caller's, and the page redirects to `/shared?id=…` instead of an error — so a guessed editing URL of a public list opens it read-only and one of a private list says it is not available.
  - **Reviews of a private list** were still readable by anyone who guessed its id (table, `rating_summary`, `list_reviews`). They are now visible only to the owner (`trip_visible_to_caller` in the select policy and in `list_reviews`).
- **Alternatives:** a 403-style "you are not the owner" message on `/trip/[id]` — it would tell a guesser that the id exists.
- **Trade-offs:** password lists keep their D-031 behaviour (link + password to view); their reviews stay readable by signed-in users with the id.

## D-041 — Walk meetups: a date and time on a walk list, and "I'm going"

- **Context:** the owner wants walk lists to optionally carry a date and time so travellers can walk them together: the city page ranks the next ones with a countdown, and a page lists every meetup of the coming days. Choices made with the owner: people say they are going; the owner can set or change the time after creating the list; only public lists are listed.
- **Decision:**
  - **A moment, shown in the city's time.** `trips.starts_at` is a `timestamptz`. The owner types a wall-clock date and time in the city's time zone (`cities.timezone`), converted with `Intl` (`zonedToUtc`, shared package; on the night the clocks go back the first occurrence is taken, a skipped time is read with the earlier offset). Everyone sees "Sat 4 Oct, 10:00 (Lisbon time)", wherever they are. A trigger keeps `trip_date` as the start's local day, so there is one source of truth.
  - **Same entity and listing:** a meetup is a public trip with a future `starts_at`. `list_walklists` gains `p_upcoming` and the `soonest` sort and returns `starts_at`, `attendee_count` and `is_attending` — no parallel RPC. The city page ranks 5 (6 fetched to know if there are more); `/short/[slug]/meetups` groups them by local day (Today, Tomorrow, dates) and pages with **Load more**.
  - **Going:** `walk_attendees` (trip, user). RLS: users see and delete only their own rows; insert only for public lists with a future start that are not theirs (`meetup_open_to_caller`). Counts come from the security definer RPCs, so nobody sees who else is going. The organiser is not an attendee.
  - **Setting the time:** optional date + start time when saving a route (`save_trip(p_starts_at)`), and later on the list page (`set_trip_schedule`, owner only). Both refuse a start in the past (`22023`); removing the time ends the meetup.
  - **Countdown:** computed on the device from `starts_at`, refreshed every 30 s (minutes precision).
- **Alternatives:** a separate `meetups` table pointing at a trip — a second entity for one optional field; a date plus a local `time` column — needs the zone at every read and breaks on clock changes; showing the viewer's own time — confusing when planning a walk in another city.
- **Trade-offs:** no reminders or notifications; attendees are kept when the owner moves the time; a list that becomes private or loses its time keeps its attendee rows (hidden); no list of who is going (only how many); no end time (a meetup leaves the list at its start).
- **Revised by D-044:** "I'm going" is no longer limited to future meetups: any public list of someone else can be joined (the meetup listings still show only future starts).

## D-042 — Scheduled data refresh through a pull request, behind a data gate

- **Context:** reference data (countries, visa rules, city texts, attractions) only changed when someone ran the pipeline by hand. Automating the refresh must not let a bad day at a source (an outage, a vandalised Wikidata label, a disambiguation page) replace texts and facts that were fine.
- **Decision:**
  - **Monthly GitHub Action** (`data-refresh.yml`): fetch, then `gate --base HEAD --fix`, then `seed`, then a **pull request**. Merging it is the human gate, and CI runs the gate again on the PR.
  - **The gate** compares every snapshot with the committed one. It **restores** what got worse: texts judged by rules in `gates/text.py`, photos as a group with their credit, and country facts that vanished. It lists changed safety-relevant facts **for review**. It **blocks** big losses and too many restores, since a broken source should not quietly ship stale data everywhere.
  - **Visa rules are never restored:** an old rule may be wrong today, so losses and waves of changes block and a human decides.
  - **Weekly live-provider check** (`providers-check.yml` → `checklist/live-check.ts`, the production providers with no cache): opens an issue when a source breaks.
- **Alternatives:**
  - Auto-merge or auto-deploy after the gate (rejected: reference data feeds visa and safety advice);
  - a hard failure on any regression with no repair (rejected: every month would need hand fixes for a handful of Wikidata edits);
  - keeping the old value for every changed field (rejected: it would also freeze legitimate updates);
  - pg_cron inside Supabase (rejected: the pipeline is Python with committed snapshots, and review happens in git).
- **Trade-offs:**
  - Thresholds are guesses tuned on today's data (`gates/limits.py`), and an intended big change needs the `data-gate-override` label.
  - A PR opened with `GITHUB_TOKEN` does not trigger CI, so a `DATA_REFRESH_TOKEN` secret is needed.
  - The visa source is archived, so its refresh is a no-op until it is replaced.

## D-043 — A group chat per walk list, for its organiser and everyone going

- **Context:** saying "I'm going" to a walk list (D-041) should give access to a group chat where everyone going and the organiser exchange instant messages. People who do not want the chat can just save the public list (D-035) instead; saving and rating stay open to every signed-in user.
- **Decision:**
  - **Membership is attendance:** a chat member is the list's organiser, or someone in `walk_attendees` while the list is public (`is_walk_chat_member`). "Not going" leaves the chat; a list made private keeps only its organiser in it. No separate membership table.
  - **Messages:** `walk_messages` (trip, author, body 1–1000 characters stored trimmed, time). RLS: members read and insert as themselves; nobody updates or deletes (privileges revoked). `list_walk_messages` (security definer) adds each author's public name and photo, newest first (up to 200; the app loads 100).
  - **Instant delivery: Supabase Realtime** `postgres_changes` on `walk_messages` (added to the `supabase_realtime` publication), which applies the same select policy to each subscriber, so non-members receive nothing. The app follows one chat while its screen is open and refetches on each insert and once the subscription is confirmed (a message posted between the first read and that moment was missed otherwise — found by the two-browser E2E). The client is behind a small interface (`lib/realtime.ts`) so tests use a fake.
  - **Where:** `/walk-chat?id=…` (a query parameter, like `/shared`, so static hosts need no rewrite), opened from **Open group chat** on the shared list's meetup banner (members) and on the organiser's list page. Non-members see "Only people going can chat".
- **Alternatives:** Realtime _broadcast_ channels without storing messages — no history for late joiners and no RLS; a third-party chat service — another provider, data and account model for a small feature; polling — not instant and more requests.
- **Trade-offs:** no editing, deleting, reporting or moderation of messages yet; no push notifications (messages arrive only while the chat is open); only the newest 100 messages are shown; messages stay after their author leaves the meetup.
- **Revised by D-044:** delivery no longer relies on Realtime events alone, and any public list can be joined.

## D-044 — Participation and group chat as one reliable flow

- **Context:** the owner reported the walk list participation and group chat "not working perfectly" and asked for the whole flow to be audited: "I'm going" on a public walk list makes you a participant; all participants share one chat of that list; messages persist and reach everyone.
- **Findings** (reproduced with three users against the local stack):
  - **Root cause — delivery relied on Realtime events only.** Supabase Realtime delivers `postgres_changes` at most once; after the Realtime service (re)starts, the first subscriber is told `SUBSCRIBED` before changes flow, and messages sent then never reached anyone (reproduced deterministically by restarting the service). The app re-read the chat only on its own sends and on subscribe, so a lost event left the message invisible until someone wrote again or the chat was reopened.
  - Joining was not idempotent: a repeated request failed with a duplicate key (`23505`), and the button showed no error and kept a stale state.
  - "I'm going" existed only on future meetups (D-041): public lists without a time, or whose time had passed, could not be joined, so they had no chat.
  - Members could not see who was in the chat.
  - Checked and correct: one chat per list by construction (the chat is the list, `walk_messages.trip_id`; there is no chat row that two joins could create twice), the same history for every member, isolation between lists, persistence across reloads, and denial for non-participants, participants of other lists and signed-out users (RLS, also through direct API calls). `channel()` reusing an existing topic was checked and does not lose the subscription on remount.
- **Decision:**
  - **Reconcile with the server:** the chat query is always re-read when the chat opens, on focus (on iOS/Android through React Query's focus manager wired to `AppState`, off for other queries) and every 10 s while open (`CHAT_RECONCILE_MS`), on top of Realtime and the re-read on subscribe. Realtime keeps it instant; the re-read guarantees a message shows within ~10 s when an event is lost — verified with Realtime stopped.
  - **`set_walk_attendance(trip, attending)`** (security definer): idempotent join/leave (`on conflict do nothing`; the primary key also guards simultaneous joins), returns the caller's state and the count; `42501` for private, own or missing lists. The app refreshes the list, shared page and listings after success **or** failure, and shows an error on failure, so the screen never claims a participation that did not happen.
  - **Any public list of someone else can be joined** (`walk_open_to_join`), with or without a time, before or after the start; the **Walk together** card (join, count, chat) is on every public list. Meetup listings are unchanged (future starts only).
  - **`list_walk_participants`** (members only) for "3 people: Ana (organiser), You, Cid" in the chat. The chat keeps its field above the keyboard on phones (`KeyboardAvoidingView`).
- **Alternatives:** replacing Realtime with polling alone — slower for everyone; Realtime _broadcast_ with an acknowledgement protocol — more moving parts for the same guarantee; a separate `chats` table with a unique `trip_id` — a second entity for an identity the list already has.
- **Trade-offs:** a lost event shows up to ~10 s late; each open chat makes one small request every 10 s; joining a list whose meetup has ended is allowed (harmless, keeps the chat reachable).

## D-045 — Public traveller profiles, linked from reviews and chat messages

- **Context:** the owner wants the author's name on a review or a chat message to open that person's profile: name, photo, when the account was created and their public walk lists ("playlists" in the request).
- **Decision:**
  - **A public id, not the account id:** `profiles.public_id` (random, unique) is what `list_reviews`, `list_walk_messages` and `list_walklists` return (`author_public_id`) and what `/traveller?id=…` uses, so the account id still never leaves the database (D-028).
  - **`public_profile(public_id)`** (security definer, signed-in users only, like reviews and chats) returns only name, photo path, member since (`profiles.created_at`), number of public walk lists and whether it is the caller; the profiles table stays owner-only (no nationality, passport or email). Unknown ids are `not_found`.
  - **Walk lists on the profile** reuse `list_walklists` with a new `p_author` filter: public lists only (never private or password ones), newest first, with the usual cards (View / Save) and **Load more**.
  - **Links:** one `AuthorName` component — the name as a link (role `link`) on review cards and on other people's chat messages; authors without a public id stay plain text.
- **Alternatives:** exposing the account id (simpler, but reverses D-028 and ties links to auth); a username/handle (users would have to choose one).
- **Trade-offs:** profiles need an account to view; walk list card bylines and the chat's participant list do not link yet; the profile shows no reviews or bio.
