"""Polite HTTP client: descriptive User-Agent, per-host rate limits, retries and a disk cache.

Raw responses are cached under ``data-pipeline/.cache/<namespace>/`` keyed by a hash of the
request, so re-running the pipeline during development does not hit the public APIs again.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import requests

from . import __version__
from .paths import CACHE_DIR

DEFAULT_CONTACT = "pablo@finperiti.com"


def user_agent() -> str:
    contact = os.environ.get("PIPELINE_CONTACT_EMAIL") or DEFAULT_CONTACT
    return f"wayfarer-pipeline/{__version__} ({contact})"


@dataclass(frozen=True)
class HostPolicy:
    """Minimum seconds between request starts and max concurrent requests for a host."""

    min_interval: float
    concurrency: int = 1


# Wikidata SPARQL and Overpass: one request at a time. Wikimedia REST ≤ 10 req/s (the
# pageviews API answered 429 at 20 req/s), Commons ≤ 10 req/s.
POLICIES: dict[str, HostPolicy] = {
    "query.wikidata.org": HostPolicy(min_interval=1.0, concurrency=1),
    "overpass-api.de": HostPolicy(min_interval=5.0, concurrency=1),
    "wikimedia.org": HostPolicy(min_interval=0.1, concurrency=4),
    "commons.wikimedia.org": HostPolicy(min_interval=0.1, concurrency=2),
    "raw.githubusercontent.com": HostPolicy(min_interval=0.5, concurrency=1),
    "api.github.com": HostPolicy(min_interval=1.0, concurrency=1),
}
DEFAULT_POLICY = HostPolicy(min_interval=0.5, concurrency=1)


class HttpError(RuntimeError):
    def __init__(self, status: int, url: str, body: str = ""):
        super().__init__(f"HTTP {status} for {url}: {body[:200]}")
        self.status = status


class _HostGate:
    def __init__(self, policy: HostPolicy):
        self.policy = policy
        self.sem = threading.Semaphore(policy.concurrency)
        self.lock = threading.Lock()
        self.next_start = 0.0

    def wait_turn(self) -> None:
        with self.lock:
            now = time.monotonic()
            start = max(now, self.next_start)
            self.next_start = start + self.policy.min_interval
        delay = start - now
        if delay > 0:
            time.sleep(delay)

    def penalise(self, seconds: float) -> None:
        with self.lock:
            self.next_start = max(self.next_start, time.monotonic() + seconds)


def _retry_after(resp: requests.Response) -> float | None:
    value = resp.headers.get("Retry-After")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        try:
            return max(0.0, parsedate_to_datetime(value).timestamp() - time.time())
        except (TypeError, ValueError):
            return None


class HttpClient:
    """Thread-safe client. ``cache_statuses`` are the HTTP statuses stored in the disk cache."""

    def __init__(
        self,
        cache_dir: Path = CACHE_DIR,
        use_cache: bool = True,
        max_retries: int = 6,
        timeout: float = 300.0,
    ):
        self.cache_dir = cache_dir
        self.use_cache = use_cache
        self.max_retries = max_retries
        self.timeout = timeout
        self._local = threading.local()
        self._gates: dict[str, _HostGate] = {}
        self._gates_lock = threading.Lock()
        self.stats = {"network": 0, "cache": 0}

    # -- internals -------------------------------------------------------------------------
    def _session(self) -> requests.Session:
        session = getattr(self._local, "session", None)
        if session is None:
            session = requests.Session()
            session.headers["User-Agent"] = user_agent()
            self._local.session = session
        return session

    def _gate(self, host: str) -> _HostGate:
        with self._gates_lock:
            if host not in self._gates:
                self._gates[host] = _HostGate(POLICIES.get(host, DEFAULT_POLICY))
            return self._gates[host]

    def _cache_path(self, namespace: str, method: str, url: str, payload: Any) -> Path:
        key = json.dumps([method, url, payload], sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return self.cache_dir / namespace / digest[:2] / f"{digest}.json"

    # -- public API ------------------------------------------------------------------------
    def request(
        self,
        method: str,
        url: str,
        *,
        namespace: str,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        cache_statuses: tuple[int, ...] = (200,),
        validate: Callable[[str], bool] | None = None,
    ) -> tuple[int, str]:
        """Return ``(status, text)``. Raises :class:`HttpError` for uncached error statuses."""
        payload = {"params": params, "data": data}
        path = self._cache_path(namespace, method, url, payload)
        if self.use_cache and path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            self.stats["cache"] += 1
            return cached["status"], cached["text"]

        host = urlsplit(url).hostname or ""
        gate = self._gate(host)
        attempt = 0
        while True:
            attempt += 1
            with gate.sem:
                gate.wait_turn()
                try:
                    resp = self._session().request(
                        method,
                        url,
                        params=params,
                        data=data,
                        headers=headers,
                        timeout=self.timeout,
                    )
                    error: Exception | None = None
                except requests.RequestException as exc:
                    resp = None
                    error = exc
            self.stats["network"] += 1

            if resp is not None and (resp.status_code in cache_statuses or resp.status_code < 400):
                status, text = resp.status_code, resp.text
                if validate is not None and status == 200 and not validate(text):
                    raise HttpError(status, url, "response failed validation: " + text[:300])
                if status in cache_statuses:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    tmp = path.with_suffix(".tmp")
                    tmp.write_text(
                        json.dumps(
                            {"url": url, "status": status, "text": text}, ensure_ascii=False
                        ),
                        encoding="utf-8",
                    )
                    tmp.replace(path)
                return status, text

            retryable = resp is None or resp.status_code in (429, 500, 502, 503, 504)
            if resp is not None and "TimeoutException" in resp.text[:5000]:
                retryable = False  # WDQS query timeout: retrying the same query won't help
            # Overpass/Wikidata report query timeouts in 200/400-ish bodies too; callers decide.
            if not retryable or attempt > self.max_retries:
                if resp is None:
                    raise HttpError(0, url, str(error))
                raise HttpError(resp.status_code, url, resp.text)
            wait = (_retry_after(resp) if resp is not None else None) or min(120.0, 2.0**attempt)
            gate.penalise(wait)
            print(
                f"    retry {attempt}/{self.max_retries} for {host} in {wait:.0f}s "
                f"({resp.status_code if resp is not None else error})",
                flush=True,
            )

    def get_json(self, url: str, *, namespace: str, **kwargs: Any) -> Any:
        _, text = self.request("GET", url, namespace=namespace, **kwargs)
        return json.loads(text)
