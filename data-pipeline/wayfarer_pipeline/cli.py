"""Command-line entry point.

python -m wayfarer_pipeline validate-config
python -m wayfarer_pipeline ingest --city lisbon
python -m wayfarer_pipeline ingest --all
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import DEFAULT_CITIES_FILE, load_cities


def _cmd_validate(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    print(f"OK: {len(config.cities)} cities in {args.config}")
    for c in config.cities:
        flag = "" if c.is_active else " (inactive)"
        print(f"  - {c.slug:<10} {c.name.en:<12} {c.country_code}  {c.wikidata_id}{flag}")
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    config = load_cities(args.config)
    cities = config.cities if args.all else [config.get(args.city)]
    print(f"Ingestion is implemented in milestone M2. Selected: {[c.slug for c in cities]}")
    return 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="wayfarer-pipeline")
    parser.add_argument("--config", type=Path, default=DEFAULT_CITIES_FILE)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("validate-config", help="validate cities.yaml").set_defaults(func=_cmd_validate)

    ingest = sub.add_parser("ingest", help="ingest attractions for one or all cities")
    target = ingest.add_mutually_exclusive_group(required=True)
    target.add_argument("--city", help="city slug from cities.yaml")
    target.add_argument("--all", action="store_true", help="all cities")
    ingest.set_defaults(func=_cmd_ingest)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
