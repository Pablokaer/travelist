import json

from wayfarer_pipeline import city_summaries, seed
from wayfarer_pipeline.config import load_cities


class FakeWikiClient:
    """Answers the sitelinks SPARQL query and Wikipedia REST summaries from canned data."""

    def __init__(self, bindings: list[dict], summaries: dict[str, dict]):
        self.bindings = bindings
        self.summaries = summaries
        self.urls: list[str] = []

    def request(self, method: str, url: str, **kwargs) -> tuple[int, str]:
        self.urls.append(url)
        if "query.wikidata.org" in url:
            return 200, json.dumps({"results": {"bindings": self.bindings}})
        if url in self.summaries:
            return 200, json.dumps(self.summaries[url])
        return 404, "{}"


def _uri(value: str) -> dict:
    return {"type": "uri", "value": value}


AMSTERDAM_EN = "https://en.wikipedia.org/api/rest_v1/page/summary/Amsterdam"
AMSTERDAM_PT = "https://pt.wikipedia.org/api/rest_v1/page/summary/Amesterd%C3%A3o"


def _client() -> FakeWikiClient:
    return FakeWikiClient(
        bindings=[
            {
                "item": _uri("http://www.wikidata.org/entity/Q727"),
                "en": _uri("https://en.wikipedia.org/wiki/Amsterdam"),
                "pt": _uri("https://pt.wikipedia.org/wiki/Amesterd%C3%A3o"),
            },
            {"item": _uri("http://www.wikidata.org/entity/Q84")},
        ],
        summaries={
            AMSTERDAM_EN: {"type": "standard", "extract": "Amsterdam is the capital.  "},
            AMSTERDAM_PT: {"type": "disambiguation", "extract": "Amesterdão pode referir-se a"},
        },
    )


def test_article_titles_come_from_wikidata_sitelinks():
    titles = city_summaries.article_titles(_client(), ["Q727", "Q84"])
    assert titles == {"Q727": ("Amsterdam", "Amesterdão"), "Q84": (None, None)}


def test_summary_is_the_trimmed_extract_of_a_standard_page():
    client = _client()
    assert city_summaries.summary(client, "en", "Amsterdam") == "Amsterdam is the capital."
    assert AMSTERDAM_EN in client.urls


def test_disambiguation_and_missing_pages_have_no_summary():
    assert city_summaries.summary(_client(), "pt", "Amesterdão") is None
    assert city_summaries.summary(_client(), "en", "Nowhere") is None


def test_build_keys_every_city_by_slug():
    config = load_cities()
    amsterdam = config.get("amsterdam")
    london = config.get("london")
    config.cities = [amsterdam, london]
    built = city_summaries.build(_client(), config)
    assert built["amsterdam"] == {
        "wikipedia_en": "Amsterdam",
        "wikipedia_pt": "Amesterdão",
        "summary_en": "Amsterdam is the capital.",
        "summary_pt": None,
    }
    assert built["london"] == {
        "wikipedia_en": None,
        "wikipedia_pt": None,
        "summary_en": None,
        "summary_pt": None,
    }


def test_cities_seed_carries_the_summaries():
    config = load_cities()
    config.cities = [config.get("amsterdam")]
    summaries = {
        "amsterdam": {
            "wikipedia_en": "Amsterdam",
            "wikipedia_pt": None,
            "summary_en": "Canals and bikes.",
            "summary_pt": None,
        }
    }
    sql = seed.cities_sql(config, summaries)
    assert "summary_en, summary_pt, wikipedia_en, wikipedia_pt" in sql
    assert "'Canals and bikes.', null, 'Amsterdam', null" in sql


def test_cities_seed_without_a_summary_uses_nulls():
    config = load_cities()
    config.cities = [config.get("amsterdam")]
    assert "null, null, null, null" in seed.cities_sql(config, {})
