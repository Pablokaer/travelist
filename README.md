# Wayfarer

Cross-platform travel companion (iOS · Android · Web) built with Expo + Supabase.

- **Before you go:** a checklist personalised to your passports (visa, passport validity, power, weather, money, safety, practical info).
- **Explore:** a map of attractions across European cities — full list, counts and data quality per city in [docs/CITIES.md](./docs/CITIES.md).
- **Walk:** an optimised walking route between the places you pick, saved as a trip and opened in Google / Apple Maps.

Status and roadmap: [PROGRESS.md](./PROGRESS.md) · Architecture: [Stack and architecture](#stack-and-architecture) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](./docs/DECISIONS.md) · Data: [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) · Launch: [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md) · Cities: [docs/CITIES.md](./docs/CITIES.md) · Changes: [CHANGELOG.md](./CHANGELOG.md)

> **Every change is recorded and documented.** The [Features](#features) section is the reference for what the app does; [CHANGELOG.md](./CHANGELOG.md) records every change; [docs/CITIES.md](./docs/CITIES.md) lists every covered city (generated). Any change must update them in the same commit — see [Maintaining this README](#maintaining-this-readme). CI enforces the changelog and the city list.

## Contents

- [Features](#features)
  - [Account and sign-in](#1-account-and-sign-in)
  - [Onboarding and profile](#2-onboarding-and-profile)
  - [Explore: Home and city pages](#3-explore-home-and-city-pages)
  - [Attraction detail](#4-attraction-detail)
  - [Pre-trip checklist](#5-pre-trip-checklist)
  - [Route builder](#6-route-builder)
  - [My Trips](#7-my-trips)
  - [Language, units, theme and accessibility](#8-language-units-theme-and-accessibility)
  - [About / data sources](#9-about--data-sources)
- [Screens and routes](#screens-and-routes)
- [Backend reference](#backend-reference) (Edge Functions, RPCs, tables)
- [Limits and rules](#limits-and-rules)
- [Covered cities](#covered-cities)
- [Known limitations](#known-limitations)
- [Stack and architecture](#stack-and-architecture) (technologies, repository layout, app, shared package, backend, pipeline, flows, testing and CI)
- [Development](#prerequisites) (setup, deploy, scripts, pipeline)

---

## Features

### 1. Account and sign-in

Everything except the About page requires a signed-in user. Routes are protected in `apps/mobile/src/app/_layout.tsx` with three guards: signed out → auth screens; signed in but not onboarded → onboarding; signed in and onboarded → the app.

| Method                        | How it works                                                                                                                                                              | Code                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Email + password**          | Sign up with name, email and password (min 8 characters). If email confirmation is enabled in Supabase, a "check your inbox" screen appears; locally confirmation is off. | `(auth)/sign-up.tsx`, `(auth)/sign-in.tsx` |
| **Magic link + 6-digit code** | Enter your email; the email contains a link **and** a 6-digit code, so you can sign in even if the link opens on another device. Code valid for 1 hour.                   | `(auth)/magic-link.tsx`                    |
| **Google**                    | Supabase-hosted OAuth with PKCE: full redirect on web, in-app browser session on native. Code exchanged on `/auth/callback`.                                              | `features/auth/api.ts` (`signInWithOAuth`) |
| **Apple**                     | Native Sign in with Apple on iOS (`expo-apple-authentication` + `signInWithIdToken`); OAuth + PKCE on web and Android.                                                    | `features/auth/api.ts`                     |
| **Auth callback**             | Landing page for magic links, email confirmation and OAuth redirects. Shows an error with "Back to sign in" if the exchange fails.                                        | `auth/callback.tsx`                        |
| **Sign out**                  | Profile tab → Sign out.                                                                                                                                                   | `features/auth/api.ts` (`signOut`)         |
| **Delete account**            | Profile tab → Delete account → confirm. Calls the `delete_account` RPC, which deletes the auth user; profile, nationalities, trips and stops cascade. Irreversible.       | `features/auth/api.ts` (`deleteAccount`)   |

- Google / Apple buttons are shown only for providers listed in `EXPO_PUBLIC_AUTH_PROVIDERS` (e.g. `google,apple`) (D-016).
- Sessions are stored in the Keychain / Keystore via SecureStore, split into 1.8 KB chunks; web uses localStorage (D-017).
- A profile row is created automatically on sign-up (`handle_new_user` trigger), with the language chosen at sign-up.
- The sign-in and sign-up screens have an EN/PT language switch and a link to About.

### 2. Onboarding and profile

**Onboarding** (`onboarding.tsx`) runs once, right after the first sign-in, in 3 steps. Each step is validated before moving on:

1. **Name and preferences** — display name, language (EN/PT), units (metric/imperial).
2. **Nationalities and home country** — 1 to 5 nationalities (no duplicates) and the home country. Nationalities drive the visa and passport checks; the home country drives power (plugs/voltage) and currency comparison.
3. **Passport** — optional passport expiry date (`YYYY-MM-DD`). Only the date is stored — never passport numbers or scans.

Finishing sets `onboarded_at`, which unlocks the main app.

**Profile tab** (`(tabs)/profile.tsx`):

- Shows name, email, nationalities, home country and passport expiry.
- **Edit profile** (`edit-profile.tsx`) — the same fields as onboarding on one screen.
- **Language**, **Units** and **Theme** (Light / Dark) switches — applied instantly and saved to the profile.
- Links to **About**, **Sign out** and **Delete account** (with confirmation).

Nationalities are saved with the `set_nationalities` RPC (replaces the whole set atomically). The country picker (`features/profile/country-picker.tsx`) lists all 250 countries with names in the current language.

### 3. Explore: Home and city pages

The **Explore** tab is a stack (`(tabs)/(explore)/`, D-026): the **Home** (`/`) lists the destinations; a city card opens the **city page** (`/city/[slug]`) with its attractions. After sign-in (and onboarding) the app opens on the Home.

**Home** (`(tabs)/(explore)/index.tsx`)

- **Header** — the Wayfarer logo and a **Search cities** field, in one row (the search centred, max 640 px); on phones the logo mark sits next to the search. No category tabs: they belong to city pages.
- **"Where to next?"** and the number of destinations shown, then a responsive grid of **city cards** (same grid as the attractions: as many ≥ 240 px columns as fit).
- **City card** (`features/destinations/city-card.tsx`) — cover photo, city name, flag + country and number of places; the whole card opens the city. The cover is the photo of the city's most popular attraction that has one, shown with its **author + licence** (Commons credit). Only active cities with data are listed (`city_list`), A–Z in the UI language.
- **Search cities** — filters the grid as you type: city names in English and Portuguese, then countries ("ital" → Italian cities), accents ignored (`searchCities`). "No cities match your search." when nothing does.

**City page** (`(tabs)/(explore)/city/[slug].tsx`) — the city comes from the URL, so any city page can be linked directly; an unknown slug shows "City not found" with **See all destinations**.

- **Back to the Home:** the **logo** in the header (a link on every browse page), the **Explore** tab (pressing it on a city page returns to the Home; from another tab it returns to where you left), or the back button / browser back.
- **Header** (`features/destinations/browse-header.tsx` + `city-header.tsx`, D-024) — the Wayfarer logo, the city pill + search group and the checklist button. When the page is wide enough (desktop windows from about 1110 px) they share one row, with the city + search group centred (max 640 px); narrower tablets/desktops show logo + checklist on top and the group below; phones show the logo mark, city pill and checklist icon in one row and the search below. The category tabs follow. Header and grid share one container (max 1440 px + gutter).

- **City switcher** — search-style pill (flag + city name) that opens a searchable city picker ([docs/CITIES.md](./docs/CITIES.md)) with each city's flag and place count; picking a city switches the page (and its URL) to it.
- **Search** — a search bar beside the city pill (below it on phones) ("Search places in {city}"). While typing, up to 8 **autocomplete** suggestions from the city's attractions appear (accents ignored, English and Portuguese names; names starting with the text first, then a word starting with it, then any match, most popular first). Picking a suggestion adds the place to the route or removes it, like the card checkbox, and it stays in the list with its stop number; the arrow opens the attraction. On web, ↑/↓ move through suggestions, Enter picks, Escape closes. The grid and the map show every match; clearing the search or changing city shows everything again.
- **Category filters** — multi-select icon tabs (underlined when active): museum, monument, church, castle, viewpoint, landmark, park, palace, other; **All** resets. No selection = all categories. Centred when they fit; otherwise the row scrolls horizontally, edge to edge.
- **Map / List switch** — floating pill at the bottom of the screen.
  - **Map** — MapLibre (`maplibre-gl` on web, MapLibre React Native on iOS/Android), fitted to the city's bounding box. Points are coloured by category; points already in the route tray are highlighted with their stop number. Tap a point to open the attraction.
  - **List** — responsive grid of image cards, sorted by popularity: as many columns of ≥ 240 px cards as the grid's width fits (1 on phones, 2 on tablets, 3–5 on desktop; `gridColumns`, `theme/grid.ts`), with photo, UNESCO badge, name, category and visit time. A place with reviews shows its average beside the name, quietly, as "3.5 ★" (one decimal; nothing without reviews); screen readers hear "Rated 3.5 out of 5 from 2 reviews". The averages of the whole city come in one request (`attraction_rating_summary` filtered by city, D-028). A round **checkbox** on each photo adds the place to the route (or removes it) without opening it; when checked it shows the stop number. The same route rules apply as in the attraction detail (max 12 stops, one city per route), and their notices appear in the route tray.
- **Places count** — "N places" for the current filters (announced to screen readers).
- **Route tray** — when at least one stop is selected, a floating card shows "N stops in your route", the latest route notice (route full / new route started in this city) and a **Build route** button.
- **Checklist** button (**Before you go**; icon-only on phones) — opens the pre-trip checklist for the current city.

Data comes from the `attractions_in_view` RPC (bbox + categories, most popular first, up to 500 per city), cached by TanStack Query for 1 hour. Map style is `EXPO_PUBLIC_MAP_STYLE_URL` (OpenFreeMap "liberty" by default, D-008).

### 4. Attraction detail

`attraction/[id].tsx`, opened as a modal from the map, the list, a route or a trip.

- Hero photo from Wikimedia Commons with **author + licence credit** and a link to the image source page.
- A sticky bottom bar shows the typical visit time and the **Add to route** button.
- Localised name and description (PT falls back to EN and vice versa), category and a **UNESCO** badge when applicable.
- **Average rating** under the name: "4.6 ★ · 128 reviews" (average of every review, one decimal; "No reviews yet" when there are none).
- **Add to route / Remove from route**:
  - max 12 stops — shows "route is full" beyond that;
  - a route belongs to one city — adding a place from another city **starts a new route** (with a notice).
- **Good to know:** average visit time (minutes, per category default or per place) and entry fee (yes / no / free text) as tiles; opening hours (OSM, when available) on their own row.
- **Reviews** (D-028):
  - **Rate this place:** five clickable gold stars (a whole rating from 1 to 5, required) and an optional comment (up to 1000 characters); **Publish review**. Without a rating the form says "Choose from 1 to 5 stars".
  - One review per user and place: once published, the form shows **Your review** filled in, with **Update review** and **Delete** (asks "Delete your review of this place?" first).
  - Every review, newest first (up to 50): avatar with initials, the author's display name ("Traveller" when they have none), a **Your review** badge on your own, stars, publication date ("· edited" when changed later) and the comment. Other people's reviews have no edit or delete controls.
- **Learn more** links (in-app browser): official website, Wikipedia (PT article when the app is in PT and it exists, otherwise EN), image source.
- Data credit (Wikidata / OpenStreetMap).

### 5. Pre-trip checklist

`checklist/[city].tsx`, backed by the `checklist` Edge Function. Requires at least one nationality in the profile (otherwise shows a prompt to edit the profile).

- **Dates:** arrival (defaults to today) and optional departure, typed as `YYYY-MM-DD`; **Update** re-runs the checklist. Departure must not be before arrival.
- Every section is computed independently: if one provider fails, only that section shows "unavailable" and the others still load.
- Each section is a card with a status pill (**All good**, **Needs attention**, **Action required**, **Information**); two columns on tablets and desktop.

| Section               | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                        | Source / logic                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Visa**              | The best option among **all** your passports (citizen of the destination → no visa). Ranking: freedom of movement → visa-free → visa on arrival → ETA → e-visa → visa required → no admission; ties broken by the longest allowed stay. Shows max stay, advice text, and the options for each passport.                                                                                                                              | passport-index dataset, `bestVisaOption` (`packages/shared/src/domain/visa.ts`) |
| **Passport validity** | The date your passport must be valid until, and a status: **ok**, **warning** (less than 1 month of margin), **problem** (expires too early) or **unknown** (no expiry in the profile). Rules: EU/EEA/CH citizens inside the free-movement area → valid for the stay; Schengen → 3 months after departure; UK → whole stay; Türkiye → 150 days after arrival; others → 6 months after arrival. Missing departure = arrival + 7 days. | `checkPassportValidity` (`domain/passport.ts`)                                  |
| **Weather**           | Arrival within the next 15 days → **daily forecast** (up to 7 days: min/max temperature, precipitation, rain probability, conditions). Further out → **climate averages** for the travel month over the last 5 years (avg high/low, rain per day, rainy days).                                                                                                                                                                       | Open-Meteo forecast / archive                                                   |
| **Power**             | Destination plug types (each with an illustration of the plug face), voltage and frequency; your home plugs; whether you need an **adapter** (plug compatibility, e.g. Europlug C fits E/F sockets) and whether the **voltage differs** (100–127 V vs 220–240 V).                                                                                                                                                                    | Country data (Wikidata + overrides), `checkPower` (`domain/power.ts`)           |
| **Money**             | Local currency and an indicative rate from your home currency (date and provider shown). Same currency → rate 1. If no rate is available, the currency is still shown.                                                                                                                                                                                                                                                               | Frankfurter (ECB), fallback open.er-api.com (D-013)                             |
| **Safety**            | Advisory level 0–3 (normal precautions → avoid all travel), whether there are regional advisories, a summary and publication date, links to Government of Canada and GOV.UK travel advice.                                                                                                                                                                                                                                           | Global Affairs Canada open data (D-012)                                         |
| **Practical**         | Emergency numbers (general, police, ambulance, fire), driving side, calling code, languages, time zone.                                                                                                                                                                                                                                                                                                                              | Country data                                                                    |

A disclaimer at the bottom reminds the user to confirm requirements with official sources.

### 6. Route builder

`route.tsx`, opened from the route tray on Explore.

- **Automatic order:** places can be picked in any order. The first pick is the starting point; every new pick is slotted into the walk and the route is re-ordered for the shortest total walk (exact shortest path on straight-line distance, `orderFromStart` in `packages/shared/src/domain/route-plan.ts`, D-025) — not simply sorted by distance from the start. A notice says the order is automatic (D-022).
- Map of the selected stops, numbered per route and coloured per route, and, after optimising, each route's walking line. On desktop the map sits beside the stop list.
- Stop list in walking order with the estimated walk between consecutive stops (straight line × 1.3) and **drag grip / move up / move down / remove** controls.
  - **Drag and drop:** press the grip (⋮⋮) and drag the stop to its new place within the route; the other stops slide to make room and the page doesn't scroll while dragging (web: mouse or touch; iOS/Android: touch). A stop can't be dragged into another route of a split — use **Split here** / **Join into one route** for that (D-027).
  - Moving a stop (buttons or drag) switches to **manual order**: the notice changes and new picks are inserted where they add the least walking, without re-sorting. **Reorder automatically** goes back to the shortest walk.
- **Split into several routes** (from 5 stops, `ROUTE_SPLIT_MIN_STOPS`): each route keeps ≥ 2 stops and is independent.
  - **Split here** between two stops cuts the route at that point.
  - **Suggest a split** into 2–6 routes (as many as 2-stop routes allow) makes **balanced** routes, each meant for a day or a part of the trip (D-023): it weighs short walks (nearby places stay together) against routes of similar length in time — visits plus walking. It starts from the best cuts of the walking order, then moves and swaps stops between routes while that improves the score `walking minutes + 0.5 × Σ |route time − average route time|` (`splitRoute`, `splitCost`). Neighbourhoods far apart are never merged just to even out the count. The first route keeps the starting point; the others start where their walk is shortest.
  - **Join into one route** merges them again. A new pick joins the route it is closest to; removing a stop that leaves a route with one stop folds it into the nearest route.
- **Optimise** (every route needs 2–12 stops) calls the `route-optimize` Edge Function once per route, keeping each route's first stop as its start, and reorders each route. Only routes without a result for their current order are sent (a changed route of a split leaves the others' answers in place); when every route is already optimised, all are sent again and answered from the server cache.
  - With `ORS_API_KEY`: one OpenRouteService optimisation (VROOM) request on the foot-walking network, which returns the order, each leg's street distance and time, and the walking line (D-025).
  - Without a key or on any ORS error: the exact shortest straight-line order with legs × 1.3 at 4.5 km/h. The UI flags this as an **estimate** (D-014).
  - A result only applies to the exact stops and order it was computed for; any change shows "–" again until you optimise.
- **Totals** per route: tiles for walking distance (km or mi), walking time, visit time and total time, plus attribution.
- **Save as trip:** name (default "Walk in {city}", max 80 characters) and optional date. Saving works with or without an optimisation result and clears the tray. One route → one trip, opened right after saving. Split routes → **one trip per route**, named "{name} · Route {n}", then My Trips opens.
- **Clear route** empties the tray.

The tray itself (`features/route/store.ts`, Zustand) is in-memory client state: it is lost when the app is closed.

### 7. My Trips

- **List** (`(tabs)/trips.tsx`) — grid of trip cards, newest first: city (with flag) and date, name, number of stops, distance and walking time. Pull to refresh. Empty state links back to Explore.
- **Detail** (`trip/[id].tsx`) — map with numbered stops and the saved route line (beside the details on desktop), totals, stop list (tap to open the attraction).
- **Navigate:**
  - **Open in Google Maps** — one walking route through all stops (Google allows up to 9 waypoints; longer routes are truncated, with a note).
  - **Leg by leg** — per-leg walking links for Google Maps and Apple Maps.
- **Delete trip** (with confirmation).

Trips are saved with the `save_trip` RPC (trip + ordered stops in one transaction; every stop must belong to the trip's city).

### 8. Language, units, theme and accessibility

- **Languages:** English and Portuguese. Order: profile language → device language → English. All strings live in `packages/shared/src/i18n/{en,pt}.json` (a test enforces key parity). Attraction and city names are shown in PT when available, otherwise EN.
- **Units:** metric (km, °C, mm) or imperial (mi, °F, in) for distances, temperatures and precipitation.
- **Theme:** light by default; users can switch to dark in Profile → Preferences (saved on the profile, `profiles.theme`). The system dark-mode setting is not followed (D-021). Design tokens (colours, spacing, radii, shadows, breakpoints) live in `apps/mobile/src/theme`; shared components in `apps/mobile/src/components` (D-020).
- **Layout:** phones (< 600 px) get a bottom tab bar and single-column content; tablets (≥ 600 px) get card grids, centred dialogs and two-column sections; desktop (≥ 1024 px) gets a side navigation rail and map-beside-list layouts. Content is capped at 440 px (forms), 760 px (reading) or 1200 px (grids).
- **Accessibility:** roles and labels on interactive elements, ≥ 44 pt touch targets, live regions for counts and notices, a list alternative to the map, text scales with the system font size, visible focus rings for keyboard users on web, decorative icons hidden from screen readers.
- **States:** every data screen has loading, empty and error (with retry) states.

### 9. About / data sources

`about.tsx` (reachable from Profile and from the sign-in / sign-up footer) lists the data sources and licences — OpenStreetMap, Wikidata, Wikimedia Commons, Wikipedia pageviews, OpenFreeMap, openrouteservice, Open-Meteo, passport-index, Government of Canada, FX providers — and the app version. Details in [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md).

---

## Screens and routes

Expo Router, files in `apps/mobile/src/app`.

Every screen stacked above the tabs (attraction, checklist, route, trip, edit profile, about) has an **app menu** at the right of its header: the Wayfarer logo with a menu icon. It opens a menu with **Explore**, **My Trips**, **Profile** and **About**, so a page opened from a link (e.g. `/trip/…`) is never a dead end. It is shown only to signed-in, onboarded users.

| Route               | File                               | Access                   | Purpose                                     |
| ------------------- | ---------------------------------- | ------------------------ | ------------------------------------------- |
| `/sign-in`          | `(auth)/sign-in.tsx`               | signed out               | Email + password, links to magic link/OAuth |
| `/sign-up`          | `(auth)/sign-up.tsx`               | signed out               | Create account                              |
| `/magic-link`       | `(auth)/magic-link.tsx`            | signed out               | Magic link + 6-digit code                   |
| `/auth/callback`    | `auth/callback.tsx`                | always                   | OAuth / magic link / confirmation landing   |
| `/onboarding`       | `onboarding.tsx`                   | signed in, not onboarded | 3-step profile setup                        |
| `/` (Explore tab)   | `(tabs)/(explore)/index.tsx`       | onboarded                | Home: searchable grid of destinations       |
| `/city/[slug]`      | `(tabs)/(explore)/city/[slug].tsx` | onboarded                | City page: map/list, filters, search, tray  |
| `/trips`            | `(tabs)/trips.tsx`                 | onboarded                | Saved trips                                 |
| `/profile`          | `(tabs)/profile.tsx`               | onboarded                | Profile, documents, preferences, account    |
| `/attraction/[id]`  | `attraction/[id].tsx`              | onboarded (modal)        | Attraction detail, add to route, reviews    |
| `/checklist/[city]` | `checklist/[city].tsx`             | onboarded (modal)        | Pre-trip checklist                          |
| `/route`            | `route.tsx`                        | onboarded                | Route builder and save                      |
| `/trip/[id]`        | `trip/[id].tsx`                    | onboarded                | Trip detail, navigation, delete             |
| `/edit-profile`     | `edit-profile.tsx`                 | onboarded                | Edit profile                                |
| `/about`            | `about.tsx`                        | always                   | Data sources and version                    |

Deep link scheme: `wayfarer://` (e.g. `wayfarer://auth/callback`).

## Backend reference

### Edge Functions (`supabase/functions`)

| Function         | Method | Auth                   | Input → output                                                                                                                                                                        | Cache (`api_cache`)                                                                                               |
| ---------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `checklist`      | POST   | signed-in user (D-015) | `checklistRequestSchema` (city, 1–5 nationalities, home country, arrival, departure, passport expiry, language) → `checklistResponseSchema` (7 sections, each `ok` or `unavailable`)  | weather forecast 3 h, climate 30 days, FX 24 h, advisories 24 h                                                   |
| `route-optimize` | POST   | signed-in user (D-015) | `routeRequestSchema` (2–12 unique stops with lat/lng/visit minutes, `keepFirst`) → order, legs, GeoJSON line, distance, walking time, visit time, `isFallback`, provider, attribution | ORS results 30 days, keyed by the start + the set of other stops (any order); fallback 1 h (only when no ORS key) |
| `health`         | GET    | none                   | → `{ ok, service, time }`                                                                                                                                                             | —                                                                                                                 |

Request/response schemas live in `packages/shared/src/schemas` and are copied into `supabase/functions/_shared/wayfarer` by `pnpm sync:shared` (D-005).

### Database RPCs and views

| Name                        | Kind     | Who          | What it does                                                                                                                                                                |
| --------------------------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attractions_in_view`       | function | anon, authed | Attractions inside a bbox, optional category filter, most popular first (max 1000)                                                                                          |
| `attraction_details`        | view     | anon, authed | One attraction with lat/lng, image credits, links, hours, fee                                                                                                               |
| `city_list`                 | view     | anon, authed | Active cities with centre, bbox, time zone, attraction count, country names (EN/PT) and a cover photo (most popular photographed attraction, with author + licence)         |
| `set_nationalities`         | function | authed       | Replaces the caller's nationalities                                                                                                                                         |
| `save_trip`                 | function | authed       | Creates a trip + ordered stops (2–12, same city); returns the trip id                                                                                                       |
| `delete_account`            | function | authed       | Deletes the caller's auth user; owned rows cascade                                                                                                                          |
| `save_review`               | function | authed       | Creates the caller's review of an attraction (rating 1–5, optional comment, blank → none) or updates it if there is one; returns the review id                              |
| `list_attraction_reviews`   | function | authed       | An attraction's reviews, newest first (limit 1–100, default 50, offset): rating, comment, dates, author display name, `is_own`; security definer only to read display names |
| `attraction_rating_summary` | view     | authed       | Per attraction: `review_count`, `rating_avg` (2 decimals, null without reviews) and `city_slug` (city pages filter on it)                                                   |

### Tables

- **Reference (read-only for clients, written by the pipeline seeds):** `countries`, `cities`, `attractions` (PostGIS `geography`), `visa_requirements`, `api_cache` (service role only).
- **User data (RLS: owner only):** `profiles`, `profile_nationalities`, `trips`, `trip_stops`.
- **Reviews:** `attraction_reviews` (user → review → attraction, unique per user and attraction; both sides cascade). RLS: every signed-in user reads all; only the author inserts, updates or deletes; no access for anon. Deleting a review is a plain `delete` filtered by id.

Migrations: `supabase/migrations`. RLS and RPC tests: `supabase/tests` (pgTAP).

## Limits and rules

Defined in `packages/shared/src/constants/index.ts` unless noted.

| Rule                         | Value                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Stops per route / trip       | 2 – 12 (`ROUTE_MIN_STOPS`, `ROUTE_MAX_STOPS`; also enforced in `save_trip`)                           |
| Cities per route             | 1                                                                                                     |
| Split routes                 | offered from 5 stops (`ROUTE_SPLIT_MIN_STOPS`); ≥ 2 stops per route, so at most 6 routes              |
| Nationalities per profile    | 1 – 5 (`MAX_NATIONALITIES`)                                                                           |
| Display name / trip name     | 1 – 80 characters                                                                                     |
| Password                     | ≥ 8 characters                                                                                        |
| Magic-link code              | 6 digits, valid 1 h (`supabase/config.toml`)                                                          |
| Walking model (fallback)     | 4.5 km/h, straight line × 1.3                                                                         |
| Default visit time (minutes) | museum 90, castle 90, palace 75, park 45, church 30, other 30, monument 20, landmark 20, viewpoint 15 |
| Weather forecast window      | arrival within 15 days; up to 7 days shown                                                            |
| Google Maps multi-stop link  | origin + up to 9 waypoints + destination                                                              |
| Dates                        | typed as `YYYY-MM-DD` (D-019)                                                                         |
| Review rating                | whole number 1 – 5, required (`REVIEW_RATING_MIN`, `REVIEW_RATING_MAX`; DB check)                     |
| Review comment               | optional, ≤ 1000 characters (`REVIEW_COMMENT_MAX`; DB check); blank is saved as no comment            |
| Reviews per user             | 1 per attraction (unique in the DB); saving again edits it                                            |

## Covered cities

The complete, always-current list is **[docs/CITIES.md](./docs/CITIES.md)**: every city with its country, slug, number of attractions, share with images / Portuguese names / opening hours, UNESCO sites, retrieval date and status. It is generated from [`data-pipeline/cities.yaml`](./data-pipeline/cities.yaml) and `data-pipeline/data/attractions/` — never edit it by hand.

- The first 12 launch cities were London, Paris, Istanbul, Rome, Prague, Amsterdam, Barcelona, Milan, Vienna, Madrid, Lisbon and Porto; later additions are listed by name in [CHANGELOG.md](./CHANGELOG.md) under **Data**.
- Adding a city needs no code change (see [Adding a new city](#adding-a-new-city)). Inactive cities are ingested but hidden from the map.

## Known limitations

- Without `ORS_API_KEY`, routes are straight-line estimates (labelled in the UI).
- The route tray is not persisted; offline cache (MMKV) is not implemented yet.
- Portuguese attraction names exist for only ~15–55% of places outside Portugal/Rome (English shown as fallback); opening hours cover ~15–30% of places.
- Expo Go cannot load MapLibre: iOS/Android need a development build.
- Sentry / PostHog are not wired yet (no-op facade).
- Dark theme: sign-in and sign-up screens are always light (the choice lives on the profile), and the map keeps its light style.
- Route stops are dragged only within their route (not between split routes), and there is no auto-scroll when dragging past the edge of the screen. Drag and drop is verified on web (mouse and touch emulation); iOS/Android untested on this machine (D-027).
- Reviews: the attraction page shows the 50 newest reviews (no "load more" yet; the RPC already pages), and there is no reporting or moderation of reviews. Reviews need a signed-in user, like the rest of the app (D-028).
- No native date pickers. Explore has no map-beside-list layout on desktop yet (route and trip detail do).
- The redesign was verified on web (desktop and phone widths); iOS/Android rendering is untested on this machine. Several category icons on iOS are approximations (SF Symbols has no church, castle or palace glyph).

## Maintaining this README

**Always:** add a line to [CHANGELOG.md](./CHANGELOG.md) under _Unreleased_ for every change to code, data or config (CI fails the pull request otherwise; run `node scripts/check-docs.mjs` locally).

This README is the functional reference of the app. Update it in the same commit when you:

- add, remove or change a screen, button, flow or user-visible message → [Features](#features) and [Screens and routes](#screens-and-routes);
- add or change an Edge Function, RPC, view or table → [Backend reference](#backend-reference);
- change a constant, validation rule or limit → [Limits and rules](#limits-and-rules);
- add, remove, deactivate or re-ingest a city → run the pipeline (regenerates [docs/CITIES.md](./docs/CITIES.md)), name the city in CHANGELOG under **Data**, and update any counts quoted here or in `PROGRESS.md`;
- fix or discover a limitation → [Known limitations](#known-limitations) (and `PROGRESS.md`);
- add, remove or upgrade a library, provider or tool, add a folder or module, or change how a layer works → [Stack and architecture](#stack-and-architecture) (and `docs/DECISIONS.md` for the reason);
- change setup, scripts or env variables → the development sections below.

Non-trivial choices go to [docs/DECISIONS.md](./docs/DECISIONS.md); milestone status to [PROGRESS.md](./PROGRESS.md).

## Stack and architecture

How Wayfarer is built: the technologies in each layer, how the code is organised, and how a request travels from a screen to the database or a third-party API. Why each choice was made is in [docs/DECISIONS.md](./docs/DECISIONS.md) (referenced as `D-0xx`).

### Overview

Wayfarer is a **pnpm + Turborepo monorepo** with four deployable parts:

| Part              | What it is                                                                                              | Runs on                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/mobile`     | The app: one Expo / React Native codebase for iOS, Android and Web                                      | devices (EAS builds), any static web host (web export) |
| `packages/shared` | Pure TypeScript shared by the app and the Edge Functions: schemas, types, constants, i18n, domain logic | bundled into the app; copied into the Edge Functions   |
| `supabase/`       | Backend: Postgres + PostGIS (schema, RLS, RPCs), Auth, and Deno Edge Functions                          | Supabase (local Docker stack or hosted project)        |
| `data-pipeline/`  | Offline Python ingestion that builds the reference data (countries, cities, visa rules, attractions)    | a developer machine; output is committed as SQL seeds  |

```
┌──────────────── apps/mobile (Expo SDK 57, Expo Router) — iOS · Android · Web ────────────────┐
│ Screens (src/app) → feature folders (src/features/*) → components / theme                    │
│ TanStack Query (server state) · Zustand (client state) · react-hook-form + zod (forms)       │
│ i18next (EN/PT) · MapView: maplibre-gl (web) / MapLibre React Native (iOS, Android)          │
└────────┬─────────────────────────────┬─────────────────────────────┬─────────────────────────┘
         │ supabase-js: tables, views, │ supabase.functions.invoke   │ map style + tiles
         │ RPCs (anon key + user JWT)  │ (user JWT)                  │ (public URL)
         ▼                             ▼                             ▼
┌──────────── Supabase ─────────────────────────────────────┐   ┌───────────────────────────┐
│ Auth: email + password, magic link / 6-digit code, OAuth  │   │ OpenFreeMap (default) or  │
│ Postgres 17 + PostGIS — RLS on every table                │   │ any MapLibre style URL    │
│   reference data (read-only) · user data (owner only)     │   └───────────────────────────┘
│   reviews (signed-in read, author write) · api_cache      │
│ Edge Functions (Deno): checklist · route-optimize · health│──► Open-Meteo, Frankfurter / ER-API,
│   verify user → validate (zod) → cache → provider → reply │    Global Affairs Canada, OpenRouteService
└──────────────────────────▲────────────────────────────────┘
                           │ committed SQL seeds (supabase/seed/*.sql), loaded by db reset / db push
┌──────────────────────────┴─── data-pipeline (Python 3.11+) ──────────────────────────────────┐
│ cities.yaml → Wikidata SPARQL + Overpass + Wikipedia pageviews + Commons → dedupe → score    │
│ → data/attractions/<slug>.json → supabase/seed/40_attractions.sql + docs/CITIES.md           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Technology stack

**App (`apps/mobile`)**

| Concern            | Technology                                                                                      | Notes                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Framework          | Expo SDK 57, React Native 0.86, React 19.2, `react-native-web` 0.21                             | one codebase for iOS, Android and Web (D-002); React Compiler and typed routes enabled in `app.json` |
| Language           | TypeScript 6 (`strict`, `noUncheckedIndexedAccess`)                                             | path alias `@/*` → `src/*`                                                                           |
| Routing            | Expo Router 57 (file-based, `src/app`)                                                          | `Stack.Protected` guards; JS `Tabs` on every platform (D-007); deep links `wayfarer://`              |
| Server state       | TanStack Query 5                                                                                | `staleTime` 60 s, 2 retries, no refetch on focus (`src/lib/query-client.ts`)                         |
| Client state       | Zustand 5                                                                                       | route tray, Explore filters and view mode; never holds server data                                   |
| Forms / validation | react-hook-form 7 + `@hookform/resolvers` + zod 4                                               | schemas from `@wayfarer/shared`, the same ones the backend validates with                            |
| Backend client     | `@supabase/supabase-js` 2                                                                       | typed with the generated `src/lib/database.types.ts` (`pnpm db:types`)                               |
| Maps               | `maplibre-gl` 6 (web), `@maplibre/maplibre-react-native` 11 (iOS/Android)                       | style: OpenFreeMap "liberty" by default (D-008); native needs a development build (not Expo Go)      |
| i18n               | i18next 26 + react-i18next 17, `expo-localization`                                              | resources in `packages/shared/src/i18n/{en,pt}.json`                                                 |
| Auth helpers       | `expo-secure-store`, `expo-web-browser`, `expo-linking`, `expo-apple-authentication`            | sessions in SecureStore, chunked (D-017); OAuth via Supabase-hosted PKCE flows (D-016)               |
| UI                 | `expo-image`, `expo-symbols`, Inter (`@expo-google-fonts/inter`), Reanimated 4, Gesture Handler | own design system in `src/components` + `src/theme` (D-020)                                          |
| Observability      | facade in `src/lib/observability.ts`                                                            | Sentry / PostHog not wired yet: no-op                                                                |

**Backend (`supabase/`)**

| Concern        | Technology                                                                      | Notes                                                                                                        |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Database       | Postgres 17 + PostGIS (`geography(Point, 4326)`, GiST index)                    | schema, RLS and RPCs in `supabase/migrations`                                                                |
| Auth           | Supabase Auth                                                                   | email + password, magic link with 6-digit code, Google / Apple (optional); templates in `supabase/templates` |
| API            | PostgREST (tables, views, RPCs) exposed on the `public` schema, `max_rows` 1000 | called directly from the app with the anon key + the user's JWT                                              |
| Edge Functions | Deno 2 (Supabase edge runtime), `zod`, `supabase-js` from npm                   | `supabase/functions/deno.json`; formatted with `deno fmt`                                                    |
| Local stack    | Supabase CLI (dev dependency) on Docker                                         | API 54321, DB 54322, Studio 54323, Mailpit 54324                                                             |

**Data pipeline (`data-pipeline/`)**: Python ≥ 3.11, `requests`, `pydantic` 2, `PyYAML`; `ruff` (lint + format) and `pytest` (D-009).

**Tooling**: Node 22 (`.nvmrc`), pnpm 10 with `nodeLinker: hoisted` (D-003), Turborepo 2 (`lint`, `typecheck`, `test`, `build:web` across workspaces), Prettier 3, ESLint 9 flat config (`eslint-config-expo` in the app, `typescript-eslint` in shared; D-006), GitHub Actions, EAS Build / Submit (`apps/mobile/eas.json`: `development`, `preview`, `production` profiles).

**Tests**: Jest 29 + `jest-expo` + React Native Testing Library (app), Vitest 4 (shared), Deno test (Edge Functions), pgTAP (database), pytest (pipeline), Playwright (web E2E, desktop and Pixel 7 Chromium) — see [Testing and CI](#testing-and-ci).

### Repository layout

```
.
├── apps/mobile/                   Expo app (@wayfarer/mobile)
│   ├── app.json · eas.json        Expo config (scheme, bundle ids, plugins) · EAS build profiles
│   ├── src/app/                   routes (Expo Router) — see "Screens and routes"
│   ├── src/features/<feature>/    code per feature: api.ts (queries/mutations), components, stores
│   ├── src/components/            design-system primitives (button, card, chip, sheet, text…)
│   ├── src/theme/                 colour tokens (light/dark), fonts, grid maths, navigation theme
│   ├── src/lib/                   cross-cutting: env, supabase client, i18n, query client, format…
│   ├── src/testing/               test helpers (fake Supabase query builder, session, fixtures)
│   ├── src/__tests__/             Jest + React Native Testing Library tests
│   ├── e2e/                       Playwright specs (smoke + full journey)
│   ├── public/maplibre/           maplibre-gl worker for web (copied by scripts/, D-018)
│   └── AGENTS.md                  Expo-specific notes for coding agents
├── packages/shared/               @wayfarer/shared — TypeScript source, no build step (D-005)
│   └── src/{constants,domain,schemas,i18n}
├── supabase/
│   ├── config.toml                local stack configuration (ports, auth, seeds)
│   ├── migrations/                ordered SQL: schema, PostGIS, RLS policies, views, RPCs
│   ├── seed/                      generated reference data (00…40_*.sql) — never edit by hand
│   ├── tests/                     pgTAP tests (RLS, RPCs, views)
│   ├── templates/                 auth email templates (confirmation, magic link)
│   └── functions/                 Deno Edge Functions
│       ├── _shared/               auth, cache, CORS, env, HTTP and Supabase helpers
│       ├── _shared/wayfarer/      generated copy of packages/shared/src (pnpm sync:shared)
│       ├── checklist/             index.ts (wiring) · handler.ts · providers.ts · db.ts · types.ts
│       ├── route-optimize/        index.ts · handler.ts · routing.ts (ORS + fallback) · polyline.ts
│       └── health/
├── data-pipeline/
│   ├── cities.yaml                source of truth for covered cities (D-010)
│   ├── data/                      committed inputs/outputs: attractions/<slug>.json, countries, visa
│   ├── wayfarer_pipeline/         CLI, config, HTTP client, SQL/seed writers, coverage doc
│   │   └── attractions/           wikidata, overpass, pageviews, commons, categories, pipeline
│   └── tests/                     pytest (with fixtures)
├── docs/                          ARCHITECTURE, DECISIONS, DATA_SOURCES, LAUNCH_CHECKLIST, CITIES (generated)
├── scripts/                       check-docs.mjs (CHANGELOG gate) · sync-shared.mjs (shared → functions)
├── .github/workflows/ci.yml       CI jobs
├── run-project.sh                 one-command local run
└── package.json · turbo.json · pnpm-workspace.yaml · tsconfig.base.json · .prettierrc.json
```

### App architecture

**Routes and guards.** Every file in `src/app` is a route. `src/app/_layout.tsx` is the root: it loads the Inter fonts (holding the splash screen until they are ready), creates the TanStack Query client and wraps the app in `AuthProvider` and the theme providers. The root `Stack` uses `Stack.Protected` with three guards, so each user only reaches the screens that fit their state:

| State                    | Reachable routes                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------ |
| signed out               | `(auth)`: sign-in, sign-up, magic link                                               |
| signed in, not onboarded | `onboarding`                                                                         |
| signed in and onboarded  | `(tabs)` (Explore, Trips, Profile), attraction, checklist, route, trip, edit profile |
| always                   | `auth/callback`, `about`                                                             |

The tabs (`(tabs)/_layout.tsx`) are a bottom bar on phones and a 96 px side rail on desktop web. Explore is a nested stack (`(tabs)/(explore)`): the Home grid and `city/[slug]` — the city is part of the URL (D-026). Attraction and checklist open as modals.

**Feature folders.** Anything that is not a route lives in `src/features/<feature>/`:

| Feature        | Contents                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `auth`         | `AuthProvider` (session from Supabase Auth), sign-in/up/magic-link/OAuth calls, auth form parts  |
| `profile`      | profile query + mutations (optimistic updates), country picker, profile fields                   |
| `destinations` | cities, attractions in a bbox, attraction detail; Home cards, city header, search, Explore store |
| `map`          | `MapView` with a web and a native implementation and a shared contract (see below)               |
| `checklist`    | calls the `checklist` Edge Function; sections and plug icons                                     |
| `route`        | route tray store, route plan and split, drag and drop of stops, `route-optimize` call            |
| `trips`        | list, detail, save (`save_trip` RPC, one trip per split route) and delete                        |
| `reviews`      | reviews list, star rating, review form, rating summaries (per attraction and per city)           |

Each feature's `api.ts` owns its query keys (e.g. `destinationKeys`, `tripKeys`, `reviewKeys`) and invalidates them after mutations. Cross-cutting code is in `src/lib/`: `env.ts` (zod-validated `EXPO_PUBLIC_*`), `supabase.ts` (the single client plus `unwrap` / `check` helpers that turn Supabase errors into thrown errors for TanStack Query), `secure-storage.ts`, `i18n.ts`, `query-client.ts`, `format.ts` (units, dates), `observability.ts`.

**Data access.** Screens never call Supabase directly; they use the hooks in `features/*/api.ts`:

- **Reads** go straight to PostgREST — views (`city_list`, `attraction_details`, `attraction_rating_summary`), RPCs (`attractions_in_view`, `list_attraction_reviews`) and owner-only tables. RLS decides what each user can see.
- **Writes** that touch several rows use RPCs so they are atomic and validated in SQL (`save_trip`, `set_nationalities`, `save_review`, `delete_account`).
- **Anything with secrets, rate limits or third-party APIs** goes through an Edge Function via `supabase.functions.invoke` (`checklist`, `route-optimize`).

**State.** Server data lives only in TanStack Query. Zustand holds UI state that must survive navigation: `features/route/store.ts` (the route tray — one city, 2–12 stops, split routes, manual order) and `features/destinations/store.ts` (category filters, map/list view). The tray is in memory only (not persisted).

**Maps.** `features/map/map-view.tsx` (web, `maplibre-gl`) and `map-view.native.tsx` (iOS/Android, MapLibre React Native) implement the same `MapViewProps` from `map-view.types.ts`; Metro picks the right file by extension. The contract covers bounds, points (dots or photo markers), route lines, selection and a popup; shared paint styles and helpers (GeoJSON conversion, popup panning) live in the `.types.ts` file so both platforms draw the same map. On web the maplibre worker is served from `public/maplibre` (D-018).

**Auth and session.** One PKCE Supabase client. On iOS/Android the session is stored in the Keychain / Keystore through `expo-secure-store`, split into ~1.8 KB chunks because SecureStore values are limited (D-017), and tokens refresh only while the app is in the foreground. On web the session uses the browser's storage. OAuth and magic links land on `/auth/callback` (`wayfarer://auth/callback` on native).

**Theme and layout.** Tokens (colours for light and dark, spacing, radii, shadows) are in `src/theme/colors.ts`. The app is light by default; dark is a profile preference and the system setting is not followed (D-021). `useTheme()` returns the active tokens and `useBreakpoint()` the layout size (tablet ≥ 600 px, desktop ≥ 1024 px). Card grids take their column count from the width they actually have (`theme/grid.ts`, D-024).

**i18n.** English and Portuguese. Language = profile preference → device locale → English. Resources are in `packages/shared` so Edge Functions can localise too; a test enforces that both languages have the same keys.

### Shared package (`packages/shared`)

Pure TypeScript with no React or platform APIs, imported as `@wayfarer/shared` by the app and by the Edge Functions:

| Folder       | What is there                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants/` | limits and defaults (route stops, nationalities, review rating/comment, visit minutes per category, languages, themes)                                          |
| `schemas/`   | zod request/response schemas (`checklist`, `route`, `profile`, `review`, common types such as ISO dates)                                                        |
| `domain/`    | logic used on both sides: visa best option, passport validity, power plugs, geo distance, route ordering, split and fallback estimates, Google/Apple Maps links |
| `i18n/`      | `en.json`, `pt.json` and the resource index                                                                                                                     |

It ships as source with explicit `.ts` import extensions, so no build step is needed (D-005). The Supabase edge runtime only sees files under `supabase/functions`, so `pnpm sync:shared` copies `src/` (without tests) into `supabase/functions/_shared/wayfarer`; CI fails when the copy is stale.

### Backend architecture

**Database.** Migrations in `supabase/migrations` build the schema in order: extensions and the shared `set_updated_at` trigger → reference data → user data → later features (profile theme, city covers, reviews). Every table has RLS:

| Group          | Tables                                                     | Access                                                                |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Reference data | `countries`, `cities`, `attractions`, `visa_requirements`  | read by everyone (only active cities); written only by seeds          |
| Cache          | `api_cache`                                                | service role only (Edge Functions)                                    |
| User data      | `profiles`, `profile_nationalities`, `trips`, `trip_stops` | owner only (`auth.uid()`); rows cascade when the auth user is deleted |
| Reviews        | `attraction_reviews`                                       | signed-in users read all; only the author writes                      |

A profile row is created by a trigger on `auth.users` insert. Attractions are `geography(Point, 4326)` with a GiST index; `attractions_in_view` returns the places inside the map's bbox, most popular first. See [Backend reference](#backend-reference) for every RPC and view.

**Seeds.** Reference data is committed as SQL in `supabase/seed/` (`10_countries`, `20_cities`, `30_visa`, `40_attractions`), generated by the pipeline (D-011). `pnpm db:reset` (local) or `supabase db push --include-seed` (hosted) loads a complete database without running the pipeline.

**Edge Functions.** Each function has a thin `index.ts` that wires real dependencies (Supabase client, `fetch`, cache, env) into a `createHandler(deps)` in `handler.ts`; tests call the handler with fakes. A request goes through:

1. CORS preflight (`_shared/cors.ts`);
2. **user check** — the `Authorization` token must belong to a real user, asked of Supabase Auth, not just a valid JWT (the anon key is rejected; `_shared/auth.ts`, D-015);
3. **input validation** with the shared zod schema;
4. **cache** lookup in `api_cache` — key = SHA-256 of the normalised input (stable JSON), per-source TTL; cache errors are logged and never fail the request (`_shared/cache.ts`);
5. **providers** — third-party HTTP calls with a User-Agent and an 8 s timeout (`_shared/http.ts`);
6. a typed response; when a provider fails, a degraded but valid answer.

| Function         | Providers                                                                                                                                                                                 | Degraded answer                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `checklist`      | visa rules and country data from the DB; Open-Meteo (forecast, and archive for climate); Frankfurter (ECB) then ExchangeRate-API for FX (D-013); Global Affairs Canada advisories (D-012) | each of the 7 sections is `ok` or `unavailable` independently         |
| `route-optimize` | OpenRouteService optimisation + walking directions when `ORS_API_KEY` is set (D-014, D-025)                                                                                               | exact shortest-path order with straight-line estimates (`isFallback`) |
| `health`         | —                                                                                                                                                                                         | —                                                                     |

Providers sit behind small function types (`RoutingProvider`, the checklist providers), so a provider can be swapped without changing the app.

### Data pipeline internals

`python -m wayfarer_pipeline <command>` (see [Data pipeline](#data-pipeline) for setup):

| Command                          | Output                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `validate-config`                | checks `cities.yaml`                                                                                       |
| `countries`                      | fetches countries (Wikidata + `country_overrides.yaml` + tz zone.tab) → `10_countries.sql`                 |
| `cities`                         | `cities.yaml` → `20_cities.sql`                                                                            |
| `visa`                           | passport-index dataset → `30_visa.sql`                                                                     |
| `ingest --city <slug>` / `--all` | attractions for one or all cities → `data/attractions/<slug>.json`, `40_attractions.sql`, `docs/CITIES.md` |
| `report`                         | per-city quality report                                                                                    |
| `seed`                           | regenerates all seed SQL offline from the committed data                                                   |
| `cities-doc [--check]`           | writes (or checks, in CI) `docs/CITIES.md`                                                                 |

Attraction ingestion per city: **Wikidata SPARQL** in the city's bbox (+ ~200 m margin) and categories → labels EN/PT, coordinates, image, UNESCO, website → **Overpass** (OSM) for opening hours and fees → **Wikipedia pageviews** for a 0–100 popularity score → **deduplicate** (OSM link, or name similarity ≥ 0.85 within 75 m) → **Commons** for image author and licence → default visit time per category. At most 300 places per city. Attraction ids are UUIDv5 of the Wikidata entity, so re-ingesting keeps ids (and therefore trips and reviews) stable. HTTP responses are cached in `data-pipeline/.cache`; requests are rate-limited and identify themselves (`PIPELINE_CONTACT_EMAIL`). Sources and licences: [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md).

### Main flows end to end

- **Opening a city page:** `/city/[slug]` reads the city from `city_list` (cached), then `attractions_in_view` for its bbox and the selected categories, and `attraction_rating_summary` filtered by `city_slug` for the card ratings. The map draws the points; tapping one opens its card; **+** adds it to the Zustand route tray.
- **Building a route:** `/route` reads the tray, orders the stops locally with the shared domain logic, then calls `route-optimize` for each route; the function returns the order, legs, line geometry, distance and times (from cache, ORS, or the fallback). **Save** calls the `save_trip` RPC and invalidates the trips list.
- **Pre-trip checklist:** `/checklist/[city]` sends the city, the profile's nationalities, home country, dates and passport expiry to `checklist`, which reads visa rules and country data from Postgres, fetches weather, FX and advisories in parallel (each cached) and returns seven sections.
- **Reviews:** the attraction page lists reviews with `list_attraction_reviews` and the average from `attraction_rating_summary`; publishing calls `save_review` (insert or update), deleting is a plain `delete` allowed by RLS only for the author.

### Testing and CI

| Layer              | Tool                                              | Where                              | Run                                                                 |
| ------------------ | ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Shared logic       | Vitest                                            | `packages/shared/src/**/*.test.ts` | `pnpm test`                                                         |
| Components/screens | Jest (`jest-expo`) + React Native Testing Library | `apps/mobile/src/__tests__`        | `pnpm test`                                                         |
| Database           | pgTAP                                             | `supabase/tests`                   | `pnpm db:test`                                                      |
| Edge Functions     | `deno test`                                       | `supabase/functions/**/*.test.ts`  | `cd supabase/functions && deno test --allow-net=jsr.io`             |
| Pipeline           | pytest + ruff                                     | `data-pipeline/tests`              | `cd data-pipeline && pytest`                                        |
| Web E2E            | Playwright (desktop + Pixel 7 Chromium)           | `apps/mobile/e2e`                  | `pnpm build:web && pnpm e2e` (`E2E_BACKEND=1` for the full journey) |

External I/O is replaced by named fakes (e.g. the fake Supabase query builder in `src/testing/test-utils.tsx`, injected fetch/cache/verifier in the Edge Function handlers). Work follows TDD: a failing test first, then the code.

CI (`.github/workflows/ci.yml`) runs five jobs on every pull request and on pushes to `main`:

1. **docs** (PRs only) — `scripts/check-docs.mjs`: code, data or config changed without a CHANGELOG entry → fail; user-facing code changed without README → warning.
2. **app** — `format:check`, shared-copy check, lint, typecheck, unit tests, web build, Playwright E2E.
3. **database** — starts Supabase, runs pgTAP and `supabase db lint`.
4. **functions** — `deno lint`, `deno fmt --check`, `deno test`.
5. **pipeline** — `ruff check`, `ruff format --check`, `pytest`, `validate-config`, `cities-doc --check`.

### Conventions

- Formatters: Prettier for TypeScript/JSON/Markdown (`pnpm format`), `deno fmt` for `supabase/functions`, `ruff format` for the pipeline. Generated files (seeds, `docs/CITIES.md`, `database.types.ts`, `_shared/wayfarer`) are regenerated, never edited.
- Small functions and modules, one responsibility each, explicit types, dependencies injected (see [CLAUDE.md](./CLAUDE.md) for the full code style).
- Platform-specific code uses `.native.tsx` / `.web.tsx` (or plain `.tsx` for web) files next to a shared `.types.ts` contract.
- Every change updates CHANGELOG.md (and this README when behaviour changes) in the same commit — see [Maintaining this README](#maintaining-this-readme).

---

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

**One command:** with Docker, Node 22 and pnpm installed, `./run-project.sh` does all of the steps below — starts Docker if needed (macOS), installs dependencies, starts the local Supabase stack (retrying while its containers boot), creates `.env` from `.env.example` and writes the local API URL, anon and service-role keys into it (a `.env` pointing at a hosted project is left as is), links `apps/mobile/.env`, serves the Edge Functions in the background (log: `.turbo/functions-serve.log`) and opens the app on the web at http://localhost:8081. Ctrl+C stops the app and the functions; the Supabase stack keeps running until `./run-project.sh --stop`.

Step by step:

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

- Seeds in `supabase/seed/` contain all reference data (countries, all cities, visa rules, attractions), so `pnpm db:reset` restores a complete database without re-running the pipeline.
- Sign-up emails (confirmation, magic link + 6-digit code) are caught by Mailpit at http://127.0.0.1:54324. Local sign-up doesn't require confirmation.
- Supabase Studio: http://127.0.0.1:54323.
- Without `ORS_API_KEY` the route optimiser uses a built-in exact shortest-path fallback with straight-line estimates (flagged in the UI). With a free key from openrouteservice.org you get real walking directions.
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

| Command                                      | What it does                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `./run-project.sh` / `--stop`                | Run everything locally in one command (see _Quick start_) / stop the Supabase stack                        |
| `pnpm dev`                                   | Start the Expo dev server                                                                                  |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Run across all workspaces via Turborepo                                                                    |
| `pnpm check`                                 | format check + shared-copy check + lint + typecheck + tests                                                |
| `pnpm build:web`                             | Static web export (`apps/mobile/dist`)                                                                     |
| `pnpm e2e`                                   | Playwright web E2E (run `pnpm build:web` first)                                                            |
| `E2E_BACKEND=1 pnpm e2e`                     | Also runs the full journey against the local stack                                                         |
| `pnpm db:start` / `db:stop` / `db:reset`     | Local Supabase stack; `db:reset` re-applies migrations + seeds                                             |
| `pnpm db:test`                               | pgTAP tests in `supabase/tests` (RLS, RPCs)                                                                |
| `pnpm db:types`                              | Regenerate `apps/mobile/src/lib/database.types.ts` from the local DB                                       |
| `pnpm functions:serve`                       | Serve Edge Functions locally with `.env` secrets                                                           |
| `pnpm sync:shared`                           | Copy `packages/shared/src` into `supabase/functions/_shared/wayfarer`                                      |
| `pnpm docs:check`                            | Fail if code/data/config changed vs `origin/main` without a CHANGELOG entry; warn if README wasn't updated |

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
3. `python -m wayfarer_pipeline ingest --city <slug>` and review the quality report. This also regenerates `supabase/seed/40_attractions.sql` and [docs/CITIES.md](./docs/CITIES.md).
4. Record it: name the city under **Data** in [CHANGELOG.md](./CHANGELOG.md) (with the new totals) and update counts quoted in `PROGRESS.md`.
5. Commit `cities.yaml`, the new `data/attractions/<slug>.json`, the seeds, `docs/CITIES.md` and `CHANGELOG.md` together. CI runs `cities-doc --check`.

No code changes are needed.
