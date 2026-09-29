import { cityName, localizedName, type AttractionSummary, type City } from './api';

/** Lower-case, accent-free text for matching ("Jerónimos" → "jeronimos"). */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** 0 = name starts with the query, 1 = a word starts with it, 2 = contains it, null = no match. */
function matchRank(name: string, query: string): number | null {
  const text = normalizeSearch(name);
  if (text.startsWith(query)) return 0;
  if (text.split(/[\s\-'’(),.]+/).some((word) => word.startsWith(query))) return 1;
  return text.includes(query) ? 2 : null;
}

/** Best rank over several names (e.g. the English and Portuguese ones). */
function bestRank(names: readonly (string | null)[], query: string): number | null {
  const ranks = names
    .filter((n): n is string => !!n)
    .map((n) => matchRank(n, query))
    .filter((r): r is number => r !== null);
  return ranks.length ? Math.min(...ranks) : null;
}

/**
 * Attractions whose name (EN or PT, accents ignored) matches `query`: names starting with it
 * first, then a word starting with it, then any substring; ties by popularity, then by the
 * localised name. An empty query matches nothing.
 * @example searchAttractions(lisbon, 'jer', 'en', 8) // [Jerónimos Monastery, …]
 */
export function searchAttractions(
  items: readonly AttractionSummary[],
  query: string,
  language: string,
  limit = Infinity,
): AttractionSummary[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return items
    .map((item) => ({ item, rank: bestRank([item.nameEn, item.namePt], q) }))
    .filter((m): m is { item: AttractionSummary; rank: number } => m.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.item.popularity - a.item.popularity ||
        localizedName(a.item, language).localeCompare(localizedName(b.item, language), language),
    )
    .slice(0, limit)
    .map((m) => m.item);
}

/** Country matches rank after every city-name match ("ita" → Italian cities after "Ita…"). */
const COUNTRY_RANK_OFFSET = 3;

function cityRank(city: City, query: string): number | null {
  const byName = bestRank([city.nameEn, city.namePt], query);
  if (byName !== null) return byName;
  const byCountry = bestRank([city.countryNameEn, city.countryNamePt], query);
  return byCountry === null ? null : byCountry + COUNTRY_RANK_OFFSET;
}

/**
 * Cities whose name or country (EN or PT, accents ignored) matches `query`, best matches first
 * (same ranking as attractions; country matches last), ties by the localised name. An empty
 * query matches nothing.
 * @example searchCities(cities, 'amst', 'en') // [Amsterdam]
 */
export function searchCities(cities: readonly City[], query: string, language: string): City[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return cities
    .map((city) => ({ city, rank: cityRank(city, q) }))
    .filter((m): m is { city: City; rank: number } => m.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        cityName(a.city, language).localeCompare(cityName(b.city, language), language),
    )
    .map((m) => m.city);
}
