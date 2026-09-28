# Wayfarer — notes for coding agents

## Every change is recorded and documented — no exceptions

Each commit that changes code, data or config must, **in the same commit**:

1. **CHANGELOG.md** — add a line under `## Unreleased` (Added / Changed / Fixed / Removed / Data / Docs). CI fails pull requests without it (`scripts/check-docs.mjs`).
2. **README.md** — update the functional reference when behaviour changes: new or changed screen, button, flow or message → _Features_ and _Screens and routes_; Edge Function, RPC, view or table → _Backend reference_; constant, validation or limit → _Limits and rules_; new limitation → _Known limitations_; setup, scripts or env → the development sections. Checklist: README → "Maintaining this README".
3. **Cities** — adding, removing, deactivating or re-ingesting a city:
   - run the pipeline (`ingest --city <slug>` or `seed`), which regenerates `docs/CITIES.md` — never edit that file by hand; `python -m wayfarer_pipeline cities-doc --check` must pass;
   - name the city under **Data** in CHANGELOG.md, with the new totals;
   - update city/attraction counts quoted in README.md and PROGRESS.md.
4. **Decisions** — non-trivial choices (new provider, library, trade-off) → `docs/DECISIONS.md` as the next `D-0xx`; data sources/licences → `docs/DATA_SOURCES.md`.
5. **Status** — milestone progress or remaining work → `PROGRESS.md`.

Before committing, run `node scripts/check-docs.mjs` (compares against `origin/main`, including uncommitted files).

## Other notes

- Expo-specific notes: `apps/mobile/AGENTS.md`.
- After editing `packages/shared`, run `pnpm sync:shared` (D-005).
