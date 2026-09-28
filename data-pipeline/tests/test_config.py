from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from wayfarer_pipeline.config import load_cities

LAUNCH_CITIES = {
    "london",
    "paris",
    "istanbul",
    "rome",
    "prague",
    "amsterdam",
    "barcelona",
    "milan",
    "vienna",
    "madrid",
    "lisbon",
    "porto",
    # added 2026-09-28
    "berlin",
    "venice",
    "florence",
    "munich",
    "dublin",
    "athens",
    "budapest",
    "edinburgh",
    "brussels",
    "copenhagen",
    "stockholm",
    "nice",
    "seville",
    "krakow",
    "warsaw",
    "naples",
    "valencia",
    "zurich",
    "antalya",
    "oslo",
}


def test_launch_cities_config_is_valid():
    config = load_cities()
    assert {c.slug for c in config.cities} == LAUNCH_CITIES


def test_norway_country_code_survives_yaml():
    # A bare NO is parsed by YAML as boolean false; cities.yaml must quote it.
    assert load_cities().get("oslo").country_code == "NO"


def test_every_city_has_a_timezone():
    assert all(c.timezone for c in load_cities().cities)


def test_get_unknown_city_lists_known_ones():
    with pytest.raises(KeyError, match="lisbon"):
        load_cities().get("atlantis")


def _write(tmp_path: Path, city: dict) -> Path:
    path = tmp_path / "cities.yaml"
    path.write_text(yaml.safe_dump({"version": 1, "cities": [city]}), encoding="utf-8")
    return path


BASE = {
    "slug": "testville",
    "name": {"en": "Testville", "pt": "Testelândia"},
    "country_code": "PT",
    "wikidata_id": "Q1",
    "osm_relation_id": None,
    "center": [38.7, -9.1],
    "bbox": [38.6, -9.2, 38.8, -9.0],
}


def test_new_city_is_config_only(tmp_path):
    assert load_cities(_write(tmp_path, BASE)).get("testville").name.pt == "Testelândia"


@pytest.mark.parametrize(
    "override",
    [
        {"center": [40.0, -9.1]},  # outside bbox
        {"bbox": [38.8, -9.2, 38.6, -9.0]},  # south > north
        {"country_code": "pt"},
        {"wikidata_id": "597"},
        {"slug": "Test Ville"},
    ],
)
def test_invalid_city_is_rejected(tmp_path, override):
    with pytest.raises(ValidationError):
        load_cities(_write(tmp_path, {**BASE, **override}))
