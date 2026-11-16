"""WDQS answers 200 with a truncated body when a query hits its timeout while streaming: the
results JSON followed by a Java stack trace (Data refresh, 2026-11-01, run 41299514328). The
HTTP client only retries on status codes, so :func:`sparql.run` retries such answers itself."""

from __future__ import annotations

import json
from typing import Any

import pytest

from wayfarer_pipeline import sparql

GOOD = json.dumps(
    {"results": {"bindings": [{"item": {"type": "uri", "value": sparql.ENTITY_PREFIX + "Q1"}}]}}
)
TRUNCATED = GOOD[:-5] + "\n}\njava.util.concurrent.TimeoutException\n"


class FakeFlakyWdqs:
    """Answers each query with the next body in ``bodies`` (the last one repeats)."""

    def __init__(self, bodies: list[str]):
        self.bodies = bodies
        self.calls = 0

    def request(self, method: str, url: str, **kwargs: Any) -> tuple[int, str]:
        body = self.bodies[min(self.calls, len(self.bodies) - 1)]
        self.calls += 1
        return 200, body


class FakeSleep:
    def __init__(self) -> None:
        self.waits: list[float] = []

    def __call__(self, seconds: float) -> None:
        self.waits.append(seconds)


def test_a_truncated_answer_is_retried_until_one_parses() -> None:
    client, sleep = FakeFlakyWdqs([TRUNCATED, GOOD]), FakeSleep()
    assert sparql.run(client, "SELECT ?item {}", sleep=sleep) == [{"item": "Q1"}]
    assert client.calls == 2
    assert len(sleep.waits) == 1


def test_an_answer_that_never_parses_fails_with_the_body() -> None:
    client, sleep = FakeFlakyWdqs([TRUNCATED]), FakeSleep()
    with pytest.raises(RuntimeError, match="SPARQL query failed"):
        sparql.run(client, "SELECT ?item {}", sleep=sleep)
    assert client.calls == sparql.ATTEMPTS
