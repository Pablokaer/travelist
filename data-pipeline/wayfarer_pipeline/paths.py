"""Well-known locations inside the repository."""

from __future__ import annotations

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = PIPELINE_DIR / "data"
ATTRACTIONS_DIR = DATA_DIR / "attractions"
CACHE_DIR = PIPELINE_DIR / ".cache"
SEED_DIR = REPO_ROOT / "supabase" / "seed"

COUNTRIES_JSON = DATA_DIR / "countries.json"
COUNTRY_OVERRIDES = DATA_DIR / "country_overrides.yaml"
VISA_CSV = DATA_DIR / "visa.csv"
VISA_META = DATA_DIR / "visa_source.json"
CITY_SUMMARIES_JSON = DATA_DIR / "city_summaries.json"
PRETTIER = REPO_ROOT / "node_modules" / ".bin" / "prettier"


def prettier(*paths: Path) -> None:
    """Format committed JSON/YAML snapshots with the repo's prettier (``pnpm format:check``
    covers data-pipeline/data). Skipped with a warning when node_modules is not installed."""
    import subprocess

    if not PRETTIER.exists():
        print(f"WARNING: {PRETTIER} not found; run `pnpm install` then `pnpm format`")
        return
    subprocess.run(
        [str(PRETTIER), "--log-level", "warn", "--write", *map(str, paths)],
        cwd=REPO_ROOT,
        check=True,
    )
