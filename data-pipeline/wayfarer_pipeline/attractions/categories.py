"""Wikidata class roots → ``public.attraction_category`` enum.

An item belongs to a category when one of its P31 classes is (a subclass of) a root, via
``wdt:P279*``. When several categories match, the first in ``PRIORITY`` wins.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

CATEGORIES = (
    "museum",
    "monument",
    "church",
    "castle",
    "viewpoint",
    "landmark",
    "park",
    "palace",
    "other",
)

# Most specific / most useful for visitors first.
PRIORITY = (
    "castle",
    "palace",
    "church",
    "museum",
    "viewpoint",
    "park",
    "monument",
    "landmark",
    "other",
)

ROOTS: dict[str, str] = {
    # museum
    "Q33506": "museum",  # museum
    "Q207694": "museum",  # art museum
    # monument
    "Q4989906": "monument",  # monument
    "Q5003624": "monument",  # memorial
    "Q179700": "monument",  # statue
    "Q483453": "monument",  # fountain
    "Q860861": "monument",  # sculpture (e.g. The Little Mermaid)
    # church (Christian buildings only; other places of worship are landmarks)
    "Q16970": "church",  # church building
    "Q2977": "church",  # cathedral
    "Q163687": "church",  # basilica
    "Q108325": "church",  # chapel
    "Q44613": "church",  # monastery
    "Q160742": "church",  # abbey
    # castle
    "Q23413": "castle",  # castle
    "Q57821": "castle",  # fortification
    "Q88291": "castle",  # citadel
    # viewpoint
    "Q6017969": "viewpoint",  # scenic viewpoint
    "Q1440300": "viewpoint",  # observation tower
    # park
    "Q22698": "park",  # park
    "Q1107656": "park",  # garden
    "Q167346": "park",  # botanical garden
    # palace
    "Q16560": "palace",  # palace
    # landmark
    "Q570116": "landmark",  # tourist attraction
    "Q2319498": "landmark",  # architectural landmark
    "Q174782": "landmark",  # square
    "Q12280": "landmark",  # bridge
    "Q12518": "landmark",  # tower
    "Q839954": "landmark",  # archaeological site
    "Q1081138": "landmark",  # historic site
    "Q1370598": "landmark",  # structure of worship (mosques, synagogues, temples, …)
    "Q32815": "landmark",  # mosque
    "Q34627": "landmark",  # synagogue
    "Q44539": "landmark",  # temple
    "Q39614": "landmark",  # cemetery
    "Q7138926": "landmark",  # parliament building (e.g. Hungarian Parliament)
    "Q25550691": "landmark",  # city hall (e.g. Stockholm, Oslo, Vienna, Belfast)
    "Q88372": "landmark",  # promenade (e.g. Promenade des Anglais)
    # other
    "Q43501": "other",  # zoo
    "Q2281788": "other",  # public aquarium
    "Q194195": "other",  # amusement park
    "Q153562": "other",  # opera house
    "Q1060829": "other",  # concert hall (e.g. Elbphilharmonie)
    "Q24354": "other",  # theatre building
    "Q37654": "other",  # market
}

# Items under these classes are never attractions (they no longer exist)...
EXCLUDED_ROOTS = frozenset({"Q19860854"})  # destroyed building or structure
# ...unless they are visitable ruins (e.g. the Parthenon is a "former temple" and an
# archaeological site).
EXCLUSION_OVERRIDES = frozenset({"Q839954"})  # archaeological site

AVG_VISIT_MINUTES: dict[str, int] = {
    "museum": 90,
    "monument": 20,
    "church": 30,
    "castle": 90,
    "viewpoint": 15,
    "landmark": 20,
    "park": 45,
    "palace": 75,
    "other": 30,
}

assert set(ROOTS.values()) <= set(CATEGORIES) == set(PRIORITY) == set(AVG_VISIT_MINUTES)


def classify(types: Iterable[str], type_roots: Mapping[str, Iterable[str]]) -> str | None:
    """Category for an item given its P31 classes and the roots each class falls under.

    Returns ``None`` when no class reaches a root (the item is not an attraction)."""
    roots = {root for t in types for root in type_roots.get(t, ())}
    if roots & EXCLUDED_ROOTS and not roots & EXCLUSION_OVERRIDES:
        return None
    found = {ROOTS[root] for root in roots if root in ROOTS}
    for category in PRIORITY:
        if category in found:
            return category
    return None
