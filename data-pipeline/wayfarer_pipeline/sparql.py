"""Wikidata Query Service helpers."""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterable, Iterator
from typing import Any, Protocol

ENDPOINT = "https://query.wikidata.org/sparql"
ENTITY_PREFIX = "http://www.wikidata.org/entity/"
# A query that times out while streaming answers 200 with a truncated body (Data refresh run
# 41299514328), which the HTTP client does not retry; a later try usually completes.
ATTEMPTS = 3
RETRY_WAIT_S = 30.0


class WikidataClient(Protocol):
    """What :func:`run` needs from :class:`~wayfarer_pipeline.http.HttpClient`; tests pass fakes."""

    def request(self, method: str, url: str, **kwargs: Any) -> tuple[int, str]: ...


def run(
    client: WikidataClient, query: str, *, sleep: Callable[[float], None] = time.sleep
) -> list[dict[str, str]]:
    """Run a SELECT query; return bindings flattened to ``{var: value}`` (QIDs shortened).

    Example: ``run(client, "SELECT ?item { VALUES ?item { wd:Q1 } }") == [{"item": "Q1"}]``
    """
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return _parse(_post(client, query))
        except RuntimeError:
            if attempt == ATTEMPTS:
                raise
            sleep(RETRY_WAIT_S * attempt)
    raise AssertionError("unreachable: the last attempt returns or raises")


def _post(client: WikidataClient, query: str) -> str:
    _, text = client.request(
        "POST",
        ENDPOINT,
        namespace="wikidata",
        data={"query": query},
        headers={"Accept": "application/sparql-results+json"},
    )
    return text


def _parse(text: str) -> list[dict[str, str]]:
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as exc:  # WDQS returns a Java stack trace on timeouts
        raise RuntimeError(f"SPARQL query failed: {text[:300]}") from exc
    return [_flatten(b) for b in doc["results"]["bindings"]]


def _flatten(binding: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for var, cell in binding.items():
        value = cell["value"]
        if cell["type"] == "uri" and value.startswith(ENTITY_PREFIX):
            value = value[len(ENTITY_PREFIX) :]
        out[var] = value
    return out


def values(qids: Iterable[str]) -> str:
    return " ".join(f"wd:{q}" for q in qids)


def chunks(items: list[Any], size: int) -> Iterator[list[Any]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def parse_point(wkt: str) -> tuple[float, float] | None:
    """``Point(lng lat)`` → ``(lat, lng)``."""
    if not wkt.startswith("Point("):
        return None
    lng, lat = wkt[len("Point(") : -1].split()
    return float(lat), float(lng)
