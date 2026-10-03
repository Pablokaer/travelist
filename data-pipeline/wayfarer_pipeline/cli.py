"""Command-line entry point.

python -m wayfarer_pipeline validate-config
python -m wayfarer_pipeline countries          # Wikidata → data/countries.json → 10_countries.sql
python -m wayfarer_pipeline cities             # cities.yaml → 20_cities.sql
python -m wayfarer_pipeline city-summaries     # Wikipedia leads → data/city_summaries.json → 20
python -m wayfarer_pipeline visa               # passport-index → data/visa.csv → 30_visa.sql
python -m wayfarer_pipeline ingest --city lisbon | --all [--jobs 3]  # → data/attractions → 40
python -m wayfarer_pipeline report             # quality report from committed attraction files
python -m wayfarer_pipeline seed               # regenerate every seed file, no network
python -m wayfarer_pipeline cities-doc [--check]   # docs/CITIES.md (ingest/seed/cities rewrite it)
python -m wayfarer_pipeline gate --base origin/main [--fix] [--report r.md] [--changelog]  # D-042
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from . import city_summaries, countries, coverage, seed, visa
from .attractions import pipeline
from .config import DEFAULT_CITIES_FILE, CitiesConfig, load_cities
from .gates.baseline import GitBaseline
from .gates.changelog import add_data_entry, refresh_line
from .gates.run import run_gates
from .http import HttpClient
from .paths import DATA_DIR, REPO_ROOT


def _client(args: argparse.Namespace) -> HttpClient:
    return HttpClient(use_cache=not args.no_cache)


def _coverage(config: CitiesConfig) -> str:
    return coverage.render(config, pipeline.load_all(), countries.load())


def _write_coverage(config: CitiesConfig) -> None:
    print(f"wrote {coverage.write(_coverage(config))}")


def _cmd_validate(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    print(f"OK: {len(config.cities)} cities in {args.config}")
    for c in config.cities:
        flag = "" if c.is_active else " (inactive)"
        print(f"  - {c.slug:<10} {c.name.en:<12} {c.country_code}  {c.wikidata_id}{flag}")
    return 0


def _cmd_countries(args: argparse.Namespace) -> int:
    data = countries.build(_client(args))
    countries.save(data)
    print(countries.summary(data))
    print(f"wrote {seed.write_countries()}")
    return 0


def _cmd_cities(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    known = countries.load()
    missing = sorted({c.country_code for c in config.cities} - set(known))
    if missing:
        print(f"ERROR: city countries missing from countries.json: {missing}", file=sys.stderr)
        return 1
    print(f"wrote {seed.write_cities(config)} ({len(config.cities)} cities)")
    _write_coverage(config)
    return 0


def _cmd_city_summaries(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    summaries = city_summaries.build(_client(args), config)
    city_summaries.save(summaries)
    print(city_summaries.summary_line(summaries))
    print(f"wrote {seed.write_cities(config)}")
    return 0


def _cmd_visa(args: argparse.Namespace) -> int:
    raw, meta = visa.fetch(_client(args))
    rows, skipped = visa.normalize(raw, set(countries.load()))
    visa.save(rows, meta)
    if skipped:
        print(f"skipped codes not in countries: {sorted(skipped)}")
    print(
        f"{len(rows)} visa rows from {meta['source']} @ {meta['commit'][:7]} "
        f"({meta['commit_date']})"
    )
    print(f"wrote {seed.write_visa()}")
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    cities = config.cities if args.all else [config.get(args.city)]
    client = _client(args)
    print(f"== {len(cities)} cities, {args.jobs} at a time", flush=True)
    results = pipeline.ingest_cities(client, cities, jobs=args.jobs)
    for _, written in results:
        print(f"  wrote {written}")
    reports = [pipeline.quality_report(doc) for doc, _ in results]
    path, warnings = seed.write_attractions()
    for w in warnings:
        print(f"WARNING: {w}")
    print(f"wrote {path} (all cities in data/attractions)")
    print(f"http: {client.stats['network']} network requests, {client.stats['cache']} cached")
    _write_coverage(config)
    print("\nQuality report\n" + "\n".join(reports))
    return 0


def _cmd_report(args: argparse.Namespace) -> int:
    for doc in pipeline.load_all().values():
        print(pipeline.quality_report(doc))
    return 0


def _cmd_seed(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    paths = [
        seed.write_readme(),
        seed.write_countries(),
        seed.write_cities(config),
        seed.write_visa(),
    ]
    path, warnings = seed.write_attractions()
    paths.append(path)
    for w in warnings:
        print(f"WARNING: {w}")
    for p in paths:
        print(f"wrote {p}")
    _write_coverage(config)
    return 0


def _cmd_cities_doc(args: argparse.Namespace) -> int:
    content = _coverage(load_cities(args.config))
    if args.check:
        if coverage.is_current(content):
            print(f"OK: {coverage.CITIES_DOC} is up to date")
            return 0
        print(
            f"ERROR: {coverage.CITIES_DOC} is stale; run `python -m wayfarer_pipeline cities-doc`",
            file=sys.stderr,
        )
        return 1
    print(f"wrote {coverage.write(content)}")
    return 0


def _record_refresh(report) -> None:
    changelog = REPO_ROOT / "CHANGELOG.md"
    line = refresh_line(report, datetime.now(UTC).date())
    changelog.write_text(
        add_data_entry(changelog.read_text(encoding="utf-8"), line), encoding="utf-8"
    )
    print(f"wrote {changelog}: {line}")


def _cmd_gate(args: argparse.Namespace) -> int:
    city_slugs = {c.slug for c in load_cities(args.config).cities}
    report = run_gates(DATA_DIR, GitBaseline(args.base), city_slugs, fix=args.fix)
    if args.report:
        args.report.write_text(report.markdown(), encoding="utf-8")
    print(report.markdown())
    if args.changelog and report.changed_datasets and not report.blocked:
        _record_refresh(report)
    return 1 if report.blocked else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="wayfarer-pipeline")
    parser.add_argument("--config", type=Path, default=DEFAULT_CITIES_FILE)
    parser.add_argument(
        "--no-cache", action="store_true", help="ignore the .cache/ directory (re-fetch)"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("validate-config", help="validate cities.yaml").set_defaults(func=_cmd_validate)
    sub.add_parser("countries", help="fetch countries → 10_countries.sql").set_defaults(
        func=_cmd_countries
    )
    sub.add_parser("cities", help="cities.yaml → 20_cities.sql").set_defaults(func=_cmd_cities)
    sub.add_parser(
        "city-summaries", help="fetch Wikipedia city leads → data/city_summaries.json"
    ).set_defaults(func=_cmd_city_summaries)
    sub.add_parser("visa", help="fetch visa rules → 30_visa.sql").set_defaults(func=_cmd_visa)

    ingest = sub.add_parser("ingest", help="ingest attractions for one or all cities")
    target = ingest.add_mutually_exclusive_group(required=True)
    target.add_argument("--city", help="city slug from cities.yaml")
    target.add_argument("--all", action="store_true", help="all cities")
    ingest.add_argument(
        "--jobs",
        type=int,
        default=1,
        help="cities ingested at once (each API keeps its own rate limit; D-060)",
    )
    ingest.set_defaults(func=_cmd_ingest)

    sub.add_parser("report", help="attraction quality report").set_defaults(func=_cmd_report)
    sub.add_parser("seed", help="regenerate all seed SQL offline").set_defaults(func=_cmd_seed)

    gate = sub.add_parser("gate", help="compare data/ with a git ref: restore or block (D-042)")
    gate.add_argument("--base", default="origin/main", help="git ref with the trusted data")
    gate.add_argument("--fix", action="store_true", help="restore values that got worse")
    gate.add_argument("--report", type=Path, help="write the Markdown report to this file")
    gate.add_argument(
        "--changelog", action="store_true", help="record a passing refresh in CHANGELOG.md"
    )
    gate.set_defaults(func=_cmd_gate)

    doc = sub.add_parser("cities-doc", help="write docs/CITIES.md (city coverage)")
    doc.add_argument("--check", action="store_true", help="exit 1 when docs/CITIES.md is stale")
    doc.set_defaults(func=_cmd_cities_doc)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
