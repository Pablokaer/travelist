# Wayfarer

Cross-platform travel companion (iOS · Android · Web) built with Expo + Supabase.

- **Before you go:** a checklist personalised to your passports (visa, passport validity, power, weather, money, safety, practical info).
- **Explore:** a map of attractions across European cities — full list, counts and data quality per city in [docs/CITIES.md](./docs/CITIES.md).
- **Walk:** an optimised walking route between the places you pick, saved as a trip and opened in Google / Apple Maps.

Status and roadmap: [PROGRESS.md](./PROGRESS.md) · Architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](./docs/DECISIONS.md) · Data: [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) · Launch: [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md) · Cities: [docs/CITIES.md](./docs/CITIES.md) · Changes: [CHANGELOG.md](./CHANGELOG.md)

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
  - **Rate this place:** five clickable stars (a whole rating from 1 to 5, required) and an optional comment (up to 1000 characters); **Publish review**. Without a rating the form says "Choose from 1 to 5 stars".
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
- change setup, scripts or env variables → the development sections below.

Non-trivial choices go to [docs/DECISIONS.md](./docs/DECISIONS.md); milestone status to [PROGRESS.md](./PROGRESS.md).

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

## Repository layout

```
apps/mobile          Expo app (iOS, Android, Web) — Expo Router, src/app = routes
packages/shared      zod schemas, types, constants, i18n resources (EN/PT)
supabase/            config, migrations, seed, pgTAP tests, Edge Functions
data-pipeline/       Python ingestion (Wikidata, OSM, Wikipedia pageviews)
docs/                ARCHITECTURE, DATA_SOURCES, DECISIONS, LAUNCH_CHECKLIST, CITIES (generated)
```
