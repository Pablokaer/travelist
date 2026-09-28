"""Per-city attraction ingestion: Wikidata → Overpass → pageviews → dedupe → Commons."""

from __future__ import annotations

import datetime as dt
import json
import math
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from ..config import City
from ..http import HttpClient
from ..paths import ATTRACTIONS_DIR, CACHE_DIR, prettier
from . import commons, overpass, pageviews, wikidata
from .categories import AVG_VISIT_MINUTES, CATEGORIES, classify

MAX_PER_CITY = 300
PAGEVIEW_CANDIDATES = 350
DEDUPE_METERS = 75.0
DEDUPE_RATIO = 0.85
# Query margin around the cities.yaml bbox (~200 m): Nominatim bboxes can clip landmarks on the
# edge, e.g. Lisbon's Belém Tower (Q215003) lies 1 m south of the city bbox.
BBOX_MARGIN_DEG = 0.002
CLASS_CACHE = CACHE_DIR / "class_roots.json"

FIELDS = (
    "wikidata_id",
    "osm_id",
    "name_en",
    "name_pt",
    "description_en",
    "description_pt",
    "category",
    "lat",
    "lng",
    "image_url",
    "image_author",
    "image_license",
    "image_license_url",
    "image_page_url",
    "is_unesco",
    "website",
    "wikipedia_en",
    "wikipedia_pt",
    "opening_hours",
    "fee",
    "avg_visit_minutes",
    "popularity",
    "sitelinks",
    "pageviews",
)


# ----------------------------------------------------------------------------------------
# Pure helpers (unit-tested)
# ----------------------------------------------------------------------------------------
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name.casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def similar_names(a: str, b: str, threshold: float = DEDUPE_RATIO) -> bool:
    na, nb = normalize_name(a), normalize_name(b)
    return bool(na) and SequenceMatcher(None, na, nb).ratio() >= threshold


def _rank_key(item: dict[str, Any]) -> tuple:
    return (-item["sitelinks"], int(item["wikidata_id"][1:]))


def dedupe(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[tuple[str, str]]]:
    """Drop duplicates, keeping the item with more sitelinks.

    Duplicates are: same wikidata id; same OSM element; or < 75 m apart with similar names.
    Returns the kept items and the ``(dropped, kept)`` pairs."""
    ordered = sorted(items, key=_rank_key)
    kept: list[dict[str, Any]] = []
    dropped: list[tuple[str, str]] = []
    seen_qids: set[str] = set()
    seen_osm: dict[str, str] = {}
    grid: dict[tuple[int, int], list[dict[str, Any]]] = {}
    cell = 0.001  # ~111 m of latitude; neighbours cover 75 m everywhere we operate

    for item in ordered:
        qid = item["wikidata_id"]
        if qid in seen_qids:
            continue
        osm = item.get("osm_id")
        if osm and osm in seen_osm:
            dropped.append((qid, seen_osm[osm]))
            continue
        gx, gy = int(item["lat"] // cell), int(item["lng"] // cell)
        duplicate_of = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other in grid.get((gx + dx, gy + dy), ()):
                    close = (
                        haversine_m(item["lat"], item["lng"], other["lat"], other["lng"])
                        < DEDUPE_METERS
                    )
                    if close and similar_names(item["name_en"], other["name_en"]):
                        duplicate_of = other["wikidata_id"]
                        break
                if duplicate_of:
                    break
            if duplicate_of:
                break
        if duplicate_of:
            dropped.append((qid, duplicate_of))
            continue
        kept.append(item)
        seen_qids.add(qid)
        if osm:
            seen_osm[osm] = qid
        grid.setdefault((gx, gy), []).append(item)
    return kept, dropped


def popularity_scores(items: list[dict[str, Any]]) -> dict[str, int]:
    """Log-scaled 0–100 within a city.

    Items with pageviews: log10(views) mapped linearly so the city's minimum → 5 and maximum →
    100. Items without pageviews: 0–5 by log(sitelinks) relative to the best of them."""
    scores: dict[str, int] = {}
    with_views = [i for i in items if (i.get("pageviews") or 0) > 0]
    without = [i for i in items if (i.get("pageviews") or 0) <= 0]
    if with_views:
        logs = {i["wikidata_id"]: math.log10(i["pageviews"]) for i in with_views}
        lo, hi = min(logs.values()), max(logs.values())
        for qid, value in logs.items():
            frac = 1.0 if hi == lo else (value - lo) / (hi - lo)
            scores[qid] = round(5 + 95 * frac)
    if without:
        top = max(math.log1p(i["sitelinks"]) for i in without)
        for i in without:
            frac = 0.0 if top == 0 else math.log1p(i["sitelinks"]) / top
            scores[i["wikidata_id"]] = min(5, round(5 * frac))
    return scores


def is_notable(item: dict[str, Any]) -> bool:
    return item["sitelinks"] >= 3 or bool(item.get("wikipedia_en") or item.get("wikipedia_pt"))


def valid_name(name: str | None, qid: str) -> bool:
    return bool(name) and name.strip() != qid and not re.fullmatch(r"Q\d+", name.strip())


# ----------------------------------------------------------------------------------------
# Ingestion
# ----------------------------------------------------------------------------------------
def _load_class_cache() -> dict[str, list[str]]:
    try:
        return json.loads(CLASS_CACHE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def ingest_city(client: HttpClient, city: City, today: dt.date | None = None) -> dict[str, Any]:
    today = today or dt.date.today()
    s, w, n, e = city.bbox
    m = BBOX_MARGIN_DEG
    bbox = (round(s - m, 7), round(w - m, 7), round(n + m, 7), round(e + m, 7))
    log = lambda msg: print(f"  [{city.slug}] {msg}", flush=True)  # noqa: E731

    candidates = wikidata.fetch_candidates(client, bbox)
    log(f"wikidata candidates in bbox: {len(candidates)}")

    class_cache = _load_class_cache()
    all_types = set().union(*(c["types"] for c in candidates.values())) if candidates else set()
    type_roots = wikidata.resolve_class_roots(client, all_types, class_cache)
    CLASS_CACHE.parent.mkdir(parents=True, exist_ok=True)
    CLASS_CACHE.write_text(json.dumps(class_cache, sort_keys=True), encoding="utf-8")

    classified = {}
    for qid, c in candidates.items():
        category = classify(c["types"], type_roots)
        if category:
            classified[qid] = {**c, "category": category}
    log(f"in attraction categories: {len(classified)}")

    details = wikidata.fetch_details(client, sorted(classified))
    items: list[dict[str, Any]] = []
    for qid, c in classified.items():
        d = details.get(qid, {})
        item = {
            "wikidata_id": qid,
            "sitelinks": c["sitelinks"],
            "category": c["category"],
            "lat": round(c["lat"], 7),
            "lng": round(c["lng"], 7),
            **{
                k: d.get(k)
                for k in (
                    "name_en",
                    "name_pt",
                    "description_en",
                    "description_pt",
                    "image_file",
                    "website",
                    "osm_id",
                    "wikipedia_en",
                    "wikipedia_pt",
                )
            },
            "is_unesco": bool(d.get("is_unesco")),
        }
        if is_notable(item) and valid_name(item["name_en"], qid):
            items.append(item)
    log(f"notable with a name: {len(items)}")

    osm = overpass.index_by_wikidata(overpass.fetch(client, bbox))
    log(f"overpass elements with wikidata tag: {len(osm)}")
    for item in items:
        o = osm.get(item["wikidata_id"])
        item["opening_hours"] = o["opening_hours"] if o else None
        item["fee"] = o["fee"] if o else None
        if o:
            item["osm_id"] = o["osm_id"]
            item["website"] = item["website"] or o["website"]
            item["name_pt"] = item["name_pt"] or o["name_pt"]

    items, dropped = dedupe(items)
    log(f"after dedupe: {len(items)} (dropped {len(dropped)})")

    start, end = pageviews.month_range(today)
    top = sorted(items, key=_rank_key)[:PAGEVIEW_CANDIDATES]
    articles = {i["wikidata_id"]: (i["wikipedia_en"], i["wikipedia_pt"]) for i in top}
    views = pageviews.total_views(client, articles, start, end)
    for item in items:
        item["pageviews"] = views.get(item["wikidata_id"], 0)
    scores = popularity_scores(items)
    for item in items:
        item["popularity"] = scores[item["wikidata_id"]]
        item["avg_visit_minutes"] = AVG_VISIT_MINUTES[item["category"]]

    items.sort(key=lambda i: (-i["popularity"], -i["pageviews"], *_rank_key(i)))
    items = items[:MAX_PER_CITY]

    images = commons.fetch(client, [i["image_file"] for i in items if i["image_file"]])
    for item in items:
        meta = images.get(item.pop("image_file") or "") or {}
        for key in (
            "image_url",
            "image_author",
            "image_license",
            "image_license_url",
            "image_page_url",
        ):
            item[key] = meta.get(key)

    items.sort(key=lambda i: int(i["wikidata_id"][1:]))
    return {
        "city": city.slug,
        "retrieved": today.isoformat(),
        "pageviews_range": [start[:8], end[:8]],
        "sources": ["wikidata", "openstreetmap", "wikipedia-pageviews", "wikimedia-commons"],
        "attractions": [{k: item.get(k) for k in FIELDS} for item in items],
    }


def city_path(slug: str) -> Path:
    return ATTRACTIONS_DIR / f"{slug}.json"


def save_city(doc: dict[str, Any]) -> Path:
    path = city_path(doc["city"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    prettier(path)
    return path


def load_all(directory: Path = ATTRACTIONS_DIR) -> dict[str, dict[str, Any]]:
    return {
        p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(directory.glob("*.json"))
    }


def quality_report(doc: dict[str, Any]) -> str:
    items = doc["attractions"]
    n = len(items)

    def pct(pred) -> str:
        return f"{(100 * sum(1 for i in items if pred(i)) / n):.0f}%" if n else "-"

    cats = Counter(i["category"] for i in items)
    breakdown = ", ".join(f"{c} {cats[c]}" for c in CATEGORIES if cats[c])
    pops = [i["popularity"] for i in items]
    return (
        f"{doc['city']:<10} {n:>4} attractions | image {pct(lambda i: i['image_url'])}"
        f" | pt name {pct(lambda i: i['name_pt'])}"
        f" | opening hours {pct(lambda i: i['opening_hours'])}"
        f" | UNESCO {sum(1 for i in items if i['is_unesco'])}"
        f" | popularity {min(pops, default=0)}–{max(pops, default=0)}\n"
        f"{'':<10} categories: {breakdown}"
    )
