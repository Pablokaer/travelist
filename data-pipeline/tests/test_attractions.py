import datetime as dt
import json
from pathlib import Path

import pytest

from wayfarer_pipeline.attractions import commons, overpass, pageviews
from wayfarer_pipeline.attractions.categories import AVG_VISIT_MINUTES, classify
from wayfarer_pipeline.attractions.pipeline import (
    dedupe,
    is_notable,
    normalize_name,
    popularity_scores,
    similar_names,
    valid_name,
)
from wayfarer_pipeline.attractions.wikidata import commons_filename

FIXTURES = Path(__file__).parent / "fixtures"


# -- categories ---------------------------------------------------------------------------
TYPE_ROOTS = {
    "Q1": ["Q33506"],  # museum
    "Q2": ["Q16560"],  # palace
    "Q3": ["Q32815", "Q1370598"],  # mosque → landmark
    "Q4": ["Q16970", "Q1370598"],  # church building (also a structure of worship)
    "Q5": ["Q57821"],  # fortification → castle
    "Q6": [],  # e.g. office building
    "Q7": ["Q12518"],  # tower
    "Q8": ["Q1440300", "Q12518"],  # observation tower
    "Q9": ["Q16560", "Q19860854"],  # destroyed palace
}


@pytest.mark.parametrize(
    ("types", "category"),
    [
        ({"Q1"}, "museum"),
        ({"Q1", "Q2"}, "palace"),  # palace housing a museum
        ({"Q3"}, "landmark"),
        ({"Q4"}, "church"),
        ({"Q5", "Q7"}, "castle"),
        ({"Q7"}, "landmark"),
        ({"Q8"}, "viewpoint"),
        ({"Q6"}, None),
        ({"Q9"}, None),  # no longer exists
        (set(), None),
    ],
)
def test_classify(types, category):
    assert classify(types, TYPE_ROOTS) == category


def test_avg_visit_minutes_defaults():
    assert AVG_VISIT_MINUTES["museum"] == 90 and AVG_VISIT_MINUTES["viewpoint"] == 15
    assert all(5 <= m <= 600 for m in AVG_VISIT_MINUTES.values())


# -- popularity ---------------------------------------------------------------------------
def _item(qid, views=0, sitelinks=1, **kw):
    return {"wikidata_id": qid, "pageviews": views, "sitelinks": sitelinks, **kw}


def test_popularity_log_scaled_within_city():
    items = [
        _item("Q1", views=1_000_000),
        _item("Q2", views=10_000),
        _item("Q3", views=100),
        _item("Q4", views=0, sitelinks=50),
        _item("Q5", views=0, sitelinks=1),
    ]
    s = popularity_scores(items)
    assert s["Q1"] == 100 and s["Q3"] == 5
    assert s["Q2"] == round(5 + 95 * 0.5)  # halfway on the log scale
    assert s["Q4"] == 5 and 0 <= s["Q5"] < s["Q4"]
    assert all(0 <= v <= 100 for v in s.values())


def test_popularity_single_item_and_empty():
    assert popularity_scores([_item("Q1", views=10)]) == {"Q1": 100}
    assert popularity_scores([]) == {}


# -- dedupe -------------------------------------------------------------------------------
def _poi(qid, name, lat, lng, sitelinks, osm=None):
    return {
        "wikidata_id": qid,
        "name_en": name,
        "lat": lat,
        "lng": lng,
        "sitelinks": sitelinks,
        "osm_id": osm,
    }


def test_dedupe_by_distance_and_name():
    items = [
        _poi("Q10", "Belém Tower", 38.69157, -9.21596, 80),
        _poi("Q11", "Belem tower", 38.69170, -9.21590, 3),  # ~15 m, same name → dropped
        _poi("Q12", "Belém Palace", 38.69180, -9.21600, 40),  # close but different name
        _poi("Q13", "Belém Tower", 38.70500, -9.21596, 2),  # same name but 1.5 km away
        _poi("Q14", "Some chapel", 38.7, -9.1, 5, osm="way/1"),
        _poi("Q15", "Other name", 38.8, -9.0, 9, osm="way/1"),  # same OSM element
        _poi("Q10", "Belém Tower", 38.69157, -9.21596, 80),  # same wikidata id
    ]
    kept, dropped = dedupe(items)
    assert sorted(i["wikidata_id"] for i in kept) == ["Q10", "Q12", "Q13", "Q15"]
    assert sorted(dropped) == [("Q11", "Q10"), ("Q14", "Q15")]


def test_name_similarity():
    assert normalize_name("Mosteiro dos Jerónimos!") == "mosteiro dos jeronimos"
    assert similar_names("St Paul's Cathedral", "St. Paul’s Cathedral")
    assert not similar_names("Louvre", "Musée d'Orsay")


def test_notability_and_names():
    assert is_notable({"sitelinks": 3})
    assert is_notable({"sitelinks": 1, "wikipedia_pt": "Elevador de Santa Justa"})
    assert not is_notable({"sitelinks": 2, "wikipedia_en": None, "wikipedia_pt": None})
    assert valid_name("Colosseum", "Q10285")
    assert not valid_name("Q10285", "Q10285") and not valid_name(None, "Q1")


# -- Commons ------------------------------------------------------------------------------
def test_commons_parse_fixture():
    doc = json.loads((FIXTURES / "commons_imageinfo.json").read_text(encoding="utf-8"))
    out = commons.parse_response(doc)
    tower = out["Torre de Belém (Lisboa).jpg"]
    assert tower == {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tower.jpg/800px-Tower.jpg",
        "image_author": "José Silva & Friends",
        "image_license": "CC BY-SA 4.0",
        "image_license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "image_page_url": "https://commons.wikimedia.org/wiki/File:Torre_de_Bel%C3%A9m_(Lisboa).jpg",
    }
    assert out["Missing.jpg"] is None
    assert out["NonFree.jpg"] is None
    assert out["Public domain.jpg"]["image_license_url"] is None


def test_strip_html():
    assert commons.strip_html('<a href="x">Jane</a>&nbsp;<b>Doe</b>') == "Jane Doe"
    assert commons.strip_html("<span></span>") is None
    assert len(commons.strip_html("x" * 1000)) == commons.MAX_AUTHOR_CHARS


def test_commons_filename():
    url = "http://commons.wikimedia.org/wiki/Special:FilePath/Torre%20de%20Bel%C3%A9m.jpg"
    assert commons_filename(url) == "Torre de Belém.jpg"
    assert commons_filename(None) is None


# -- Overpass / pageviews -----------------------------------------------------------------
def test_overpass_index_prefers_element_with_hours():
    elements = [
        {"type": "node", "id": 5, "tags": {"wikidata": "Q1", "name:pt": "Torre"}},
        {"type": "way", "id": 7, "tags": {"wikidata": "Q1", "opening_hours": "Tu-Su 10:00-18:00"}},
        {"type": "relation", "id": 9, "tags": {"wikidata": "Q2;Q3", "fee": "yes"}},
    ]
    idx = overpass.index_by_wikidata(elements)
    assert idx["Q1"]["osm_id"] == "way/7"
    assert idx["Q1"]["opening_hours"] == "Tu-Su 10:00-18:00"
    assert idx["Q3"] == idx["Q2"] and idx["Q2"]["fee"] == "yes"


def test_pageview_month_range_and_url():
    assert pageviews.month_range(dt.date(2026, 9, 27)) == ("2025090100", "2026083100")
    assert pageviews.month_range(dt.date(2026, 1, 5)) == ("2025010100", "2025123100")
    url = pageviews.article_url("en.wikipedia", "St Paul's Cathedral/x", "a", "b")
    assert url.endswith("/en.wikipedia/all-access/user/St_Paul%27s_Cathedral%2Fx/monthly/a/b")
