"""Wikimedia Commons image metadata: 800 px thumbnail URL, author and licence."""

from __future__ import annotations

import html
import json
import re
from typing import Any

from .. import sparql
from ..http import HttpClient

API = "https://commons.wikimedia.org/w/api.php"
BATCH = 50
MAX_AUTHOR_CHARS = 300


def strip_html(value: str | None) -> str | None:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    return text if len(text) <= MAX_AUTHOR_CHARS else text[: MAX_AUTHOR_CHARS - 1] + "…"


def _meta(ext: dict[str, Any], key: str) -> str | None:
    value = (ext.get(key) or {}).get("value")
    return str(value).strip() if value not in (None, "") else None


def parse_response(doc: dict[str, Any]) -> dict[str, dict[str, Any] | None]:
    """Commons ``prop=imageinfo`` response (formatversion=2) → ``{filename: image | None}``.

    Keyed by both the requested and the canonical (normalized) file name, without ``File:``.
    ``None`` marks files that are missing or not freely licensed."""
    query = doc.get("query", {})
    renamed = {n["to"]: n["from"] for n in query.get("normalized", [])}
    out: dict[str, dict[str, Any] | None] = {}
    for page in query.get("pages", []):
        title = page.get("title", "")
        names = {title.removeprefix("File:"), renamed.get(title, title).removeprefix("File:")}
        info = (page.get("imageinfo") or [None])[0]
        if page.get("missing") or not info:
            out.update(dict.fromkeys(names))
            continue
        ext = info.get("extmetadata") or {}
        licence = _meta(ext, "LicenseShortName")
        non_free = (_meta(ext, "NonFree") or "").lower() in ("true", "1", "yes")
        if not licence or non_free:
            out.update(dict.fromkeys(names))
            continue
        image = {
            "image_url": info.get("thumburl") or info.get("url"),
            "image_author": strip_html(_meta(ext, "Artist")),
            "image_license": strip_html(licence),
            "image_license_url": _meta(ext, "LicenseUrl"),
            "image_page_url": info.get("descriptionurl"),
        }
        out.update(dict.fromkeys(names, image))
    return out


def fetch(client: HttpClient, filenames: list[str]) -> dict[str, dict[str, Any] | None]:
    out: dict[str, dict[str, Any] | None] = {}
    for chunk in sparql.chunks(sorted(set(filenames)), BATCH):
        params = {
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "800",
            "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl|NonFree",
            "titles": "|".join(f"File:{f}" for f in chunk),
        }
        _, text = client.request("GET", API, namespace="commons", params=params)
        out.update(parse_response(json.loads(text)))
    return out
