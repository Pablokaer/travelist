# data-pipeline

Python ingestion for Wayfarer's reference data: countries, cities, visa rules and attractions.
The pipeline writes **committed snapshots** under [`data/`](./data) and **generated seed SQL**
under [`../supabase/seed`](../supabase/seed), so `supabase db reset` (local) and
`supabase db push --include-seed` (hosted) load everything without running Python.

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

python -m wayfarer_pipeline validate-config        # check cities.yaml
python -m wayfarer_pipeline countries              # Wikidata → data/countries.json → 10_countries.sql
python -m wayfarer_pipeline cities                 # cities.yaml → 20_cities.sql
python -m wayfarer_pipeline city-summaries         # Wikipedia leads (EN/PT) → data/city_summaries.json → 20_cities.sql
python -m wayfarer_pipeline visa                   # passport-index → data/visa.csv → 30_visa.sql
python -m wayfarer_pipeline ingest --city lisbon   # one city → data/attractions/lisbon.json
python -m wayfarer_pipeline ingest --all           # every city (≈ 30–60 min cold, seconds cached)
python -m wayfarer_pipeline report                 # quality report from data/attractions/*.json
python -m wayfarer_pipeline seed                   # regenerate ALL seed SQL offline (no network)
python -m wayfarer_pipeline gate --base origin/main # data gate vs a git ref; --fix restores, see D-042

pytest && ruff check . && ruff format --check .
```

`ingest` always rebuilds `40_attractions.sql` from **every** file in `data/attractions/`, so
re-ingesting one city keeps the others. Run `pnpm db:reset` from the repo root to load the seeds.

## Files

| Path                           | Committed | What                                                            |
| ------------------------------ | --------- | --------------------------------------------------------------- |
| `cities.yaml`                  | yes       | launch cities (single source of truth)                          |
| `data/country_overrides.yaml`  | yes       | curated corrections applied after Wikidata, each with `source`  |
| `data/countries.json`          | yes       | normalised countries snapshot                                   |
| `data/visa.csv`                | yes       | normalised visa rules; `data/visa_source.json` = dataset commit |
| `data/attractions/<slug>.json` | yes       | normalised attractions per city                                 |
| `.cache/`                      | no        | raw HTTP responses (delete a sub-folder to re-fetch a source)   |

## How attractions are built (per city)

1. **Wikidata** — items with coordinates in the city bbox (+ ~200 m margin) via
   `SERVICE wikibase:box`; classes resolved with `wdt:P279*` against the category roots in
   `attractions/categories.py`. Demolished items (P576 / "destroyed building") are excluded.
   Notability: ≥ 3 sitelinks or an en/pt Wikipedia article. Labels/descriptions (en, pt), image
   (P18), UNESCO (P1435 = Q9259 / Q43113623, or P757), website (P856), OSM ids, wiki titles.
2. **Overpass** — `nwr["wikidata"]` with tourism/historic/amenity/leisure/building tags →
   `opening_hours`, `fee`, OSM element, website and `name:pt` fallbacks.
3. **Dedupe** — same OSM element, or < 75 m apart with name similarity ≥ 0.85 (difflib);
   the item with more sitelinks wins.
4. **Pageviews** — last 12 complete months, en + pt, `user` agent, for the top 350 candidates
   by sitelinks; popularity = log-scaled 0–100 within the city (items without views: 0–5).
5. Top 300 by popularity are kept; **Commons** `imageinfo` gives the 800 px thumbnail, author
   and licence (images without a licence are dropped). Missing data stays `null`.

## Politeness

Every request sends `User-Agent: wayfarer-pipeline/<version> (<PIPELINE_CONTACT_EMAIL>)`
(env var: an email address or URL; default the repository URL `https://github.com/Pablokaer/travelist`). Wikidata SPARQL and Overpass run one request at a
time; Wikimedia REST ≤ 10 req/s. 429/5xx are retried with backoff honouring `Retry-After`.
