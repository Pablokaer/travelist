"""The ``climate``, ``facts`` and ``prices`` commands (D-084): fetch each city's data one at a time.

A run keeps the snapshots it already has (so an interrupted ``--all`` resumes where it stopped;
``--refresh`` fetches again) and reports a city that fails instead of stopping the rest. Ported
from the TravelisHachtoberfest fork without its ``--local`` mode (no local city builder here).
"""

from __future__ import annotations

import argparse
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from . import climate, countries, facts, prices, regions
from .config import CitiesConfig, City, load_cities
from .paths import CLIMATE_DIR, FACTS_DIR, PRICES_DIR, prettier


@dataclass
class RunResult:
    written: list[str] = field(default_factory=list)
    kept: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)

    def line(self, label: str) -> str:
        """``climate: 190 written, 8 kept, 0 failed`` for the CLI."""
        counts = f"{len(self.written)} written, {len(self.kept)} kept, {len(self.failed)} failed"
        return f"{label}: {counts}"


def _describe(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"


def _pending(cities: list[City], directory: Path, refresh: bool, result: RunResult) -> list[City]:
    """The cities to fetch: those without a snapshot (all of them with ``refresh``)."""
    todo = []
    for city in cities:
        if not refresh and (directory / f"{city.slug}.json").exists():
            result.kept.append(city.slug)
        else:
            todo.append(city)
    return todo


QUOTA_USED_UP = "Daily API request limit exceeded"
# The hourly quota (5,000 weighted calls) clears by itself: wait for it, five minutes at a time.
HOURLY_QUOTA = "Hourly API request limit exceeded"
QUOTA_WAIT_SECONDS = 300.0
QUOTA_MAX_WAITS = 13


def _with_quota_waits(work: Callable[[City], Path], city: City, sleep: Callable[[float], None]):
    """``work(city)``, waiting out an hourly quota (up to an hour and five minutes)."""
    for waited in range(QUOTA_MAX_WAITS + 1):
        try:
            return work(city)
        except Exception as exc:
            if HOURLY_QUOTA not in str(exc) or waited == QUOTA_MAX_WAITS:
                raise
            print(f"  hourly quota used up; waiting {QUOTA_WAIT_SECONDS:.0f}s", flush=True)
            sleep(QUOTA_WAIT_SECONDS)


def _each(
    todo: list[City],
    work: Callable[[City], Path],
    result: RunResult,
    label: str,
    sleep: Callable[[float], None] = time.sleep,
) -> list[Path]:
    """Runs ``work`` per city. A used-up daily quota stops the run: the rest would only fail,
    and the kept snapshots let tomorrow's run resume."""
    paths = []
    for city in todo:
        try:
            paths.append(_with_quota_waits(work, city, sleep))
            result.written.append(city.slug)
            print(f"  {label} {city.slug}: ok", flush=True)
        except Exception as exc:  # noqa: BLE001 - one city failing must not stop the others
            result.failed.append((city.slug, _describe(exc)))
            print(f"  {label} {city.slug}: FAILED {_describe(exc)}", flush=True)
            if QUOTA_USED_UP in str(exc):
                print("  daily quota used up; run the command again tomorrow to resume")
                break
    return paths


def run_climate(
    client: Any,
    cities: list[City],
    directory: Path = CLIMATE_DIR,
    refresh: bool = False,
    today: date | None = None,
    format_json: bool = False,
    first_year: int = climate.FIRST_YEAR,
    sleep: Callable[[float], None] = time.sleep,
) -> RunResult:
    """Climate snapshots for ``cities`` in ``directory``."""
    result = RunResult()

    def one(city: City) -> Path:
        doc = climate.fetch_city(client, city, today, first_year=first_year)
        return climate.save(doc, directory, False)

    paths = _each(_pending(cities, directory, refresh, result), one, result, "climate", sleep)
    if format_json and paths:
        prettier(*paths)
    return result


def run_facts(
    wikidata: Any,
    overpass_client: Any,
    cities: list[City],
    directory: Path = FACTS_DIR,
    refresh: bool = False,
    today: date | None = None,
    format_json: bool = False,
) -> RunResult:
    """Facts snapshots for ``cities``: one Wikidata query for the batch, Overpass per city."""
    result = RunResult()
    todo = _pending(cities, directory, refresh, result)
    found = facts.fetch_wikidata(wikidata, [c.wikidata_id for c in todo]) if todo else {}

    def one(city: City) -> Path:
        doc = facts.build_city(overpass_client, city, found[city.wikidata_id], today)
        return facts.save(doc, directory, False)

    paths = _each(todo, one, result, "facts")
    if format_json and paths:
        prettier(*paths)
    return result


def run_prices(
    client: Any,
    cities: list[City],
    directory: Path = PRICES_DIR,
    refresh: bool = False,
    today: date | None = None,
    format_json: bool = False,
) -> RunResult:
    """Price snapshots for ``cities``: the public sources are read once, then each city is
    priced from them (D-084)."""
    result = RunResult()
    todo = _pending(cities, directory, refresh, result)
    if not todo:
        return result
    basket, sources = prices.load_basket(), prices.fetch_sources(client)

    def one(city: City) -> Path:
        return prices.save(prices.build_city(city, basket, sources, today), directory, False)

    paths = _each(todo, one, result, "prices")
    if format_json and paths:
        prettier(*paths)
    return result


def targets(args: argparse.Namespace) -> list[City]:
    """The cities the command was asked for (``--city``, ``--region`` or ``--all``, ``--shard``)."""
    return _selected(args, load_cities(args.config))


def shard(cities: list[City], spec: str | None) -> list[City]:
    """``"2/3"`` → the 2nd of 3 interleaved shares of ``cities`` (every 3rd city), so several
    processes can work at once, each on its own host connection; ``None`` → all of them."""
    if spec is None:
        return cities
    part, _, total = spec.partition("/")
    if not (part.isdigit() and total.isdigit() and 1 <= int(part) <= int(total)):
        raise SystemExit(f"shard {spec!r} is not valid; expected K/N with 1 <= K <= N, like 2/3")
    return cities[int(part) - 1 :: int(total)]


def _selected(args: argparse.Namespace, config: CitiesConfig) -> list[City]:
    picked = regions.select(config, countries.load(), region=args.region, city=args.city)
    return shard(picked, args.shard)


def cmd_climate(args: argparse.Namespace, client: Any) -> int:
    result = run_climate(
        client,
        targets(args),
        CLIMATE_DIR,
        args.refresh,
        format_json=True,
        first_year=args.first_year,
    )
    print(result.line("climate"))
    return 1 if result.failed else 0


def cmd_facts(args: argparse.Namespace, client: Any) -> int:
    result = run_facts(client, client, targets(args), FACTS_DIR, args.refresh, format_json=True)
    print(result.line("facts"))
    return 1 if result.failed else 0


def cmd_prices(args: argparse.Namespace, client: Any) -> int:
    result = run_prices(client, targets(args), PRICES_DIR, args.refresh, format_json=True)
    print(result.line("prices"))
    return 1 if result.failed else 0
