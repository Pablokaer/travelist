// Real providers for the checklist: Open-Meteo (weather), Frankfurter / ExchangeRate-API (FX)
// and Global Affairs Canada (travel advisories). Each takes an injectable fetcher and cache.
import { CACHE_TTL, type WeatherDay } from '@wayfarer/shared';

import { type Cached, cacheKey } from '../_shared/cache.ts';
import { type FetchJson, HttpError } from '../_shared/http.ts';
import type { Advisory, AdvisoryProvider, Climate, FxProvider, WeatherProvider } from './types.ts';

const CLIMATE_TTL = 30 * 24 * 3600;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Open-Meteo
// ---------------------------------------------------------------------------

type OpenMeteoDaily = {
  daily?: {
    time: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    weather_code?: (number | null)[];
  };
};

const at = (arr: (number | null)[] | undefined, i: number): number | null => arr?.[i] ?? null;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Pure: averages for one month from an Open-Meteo archive `daily` block. */
export function climateFromDaily(
  daily: NonNullable<OpenMeteoDaily['daily']>,
  month: number,
): Climate {
  const mins: number[] = [];
  const maxs: number[] = [];
  const precip: number[] = [];
  const rainyByYear = new Map<string, number>();
  daily.time.forEach((date, i) => {
    if (Number(date.slice(5, 7)) !== month) return;
    const year = date.slice(0, 4);
    if (!rainyByYear.has(year)) rainyByYear.set(year, 0);
    const lo = at(daily.temperature_2m_min, i);
    const hi = at(daily.temperature_2m_max, i);
    const p = at(daily.precipitation_sum, i);
    if (lo != null) mins.push(lo);
    if (hi != null) maxs.push(hi);
    if (p != null) {
      precip.push(p);
      if (p >= 1) rainyByYear.set(year, rainyByYear.get(year)! + 1);
    }
  });
  if (!mins.length || !maxs.length || !precip.length) {
    throw new Error('no climate data for the travel month');
  }
  return {
    month,
    years: rainyByYear.size,
    avgMinC: round1(mean(mins)),
    avgMaxC: round1(mean(maxs)),
    avgPrecipitationMm: round1(mean(precip)),
    avgRainyDays: round1(mean([...rainyByYear.values()])),
  };
}

export function createOpenMeteo(deps: { fetchJson: FetchJson; cached: Cached }): WeatherProvider {
  const coord = (n: number) => round2(n).toFixed(2);
  return {
    async forecast({ lat, lng, start, end }) {
      const input = { lat: coord(lat), lng: coord(lng), start, end };
      return deps.cached(await cacheKey('weather:forecast', input), CACHE_TTL.weather, async () => {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({
          latitude: input.lat,
          longitude: input.lng,
          daily:
            'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code',
          timezone: 'auto',
          start_date: start,
          end_date: end,
        }).toString();
        const res = await deps.fetchJson<OpenMeteoDaily>(url.toString());
        const d = res.daily;
        if (!d?.time?.length) throw new Error('empty forecast');
        return d.time.map(
          (date, i): WeatherDay => ({
            date,
            tempMinC: at(d.temperature_2m_min, i),
            tempMaxC: at(d.temperature_2m_max, i),
            precipitationMm: at(d.precipitation_sum, i),
            precipitationProbability: at(d.precipitation_probability_max, i),
            weatherCode: at(d.weather_code, i),
          }),
        );
      });
    },

    async climate({ lat, lng, month, fromYear, toYear }) {
      const input = { lat: coord(lat), lng: coord(lng), month, fromYear, toYear };
      return deps.cached(await cacheKey('weather:climate', input), CLIMATE_TTL, async () => {
        // One request spanning the travel month of every year; other months are filtered out.
        const url = new URL('https://archive-api.open-meteo.com/v1/archive');
        url.search = new URLSearchParams({
          latitude: input.lat,
          longitude: input.lng,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
          timezone: 'auto',
          start_date: `${fromYear}-${String(month).padStart(2, '0')}-01`,
          end_date: lastDayOfMonth(toYear, month),
        }).toString();
        const res = await deps.fetchJson<OpenMeteoDaily>(url.toString(), { timeoutMs: 10000 });
        if (!res.daily?.time?.length) throw new Error('empty climate archive');
        return climateFromDaily(res.daily, month);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1';
export const FRANKFURTER_PROVIDER = 'Frankfurter (European Central Bank)';
export const ER_API_PROVIDER = 'Rates By Exchange Rate API (https://www.exchangerate-api.com)';

type FrankfurterLatest = { base: string; date: string; rates: Record<string, number> };
type ErApiLatest = {
  result: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
};

export function createFx(deps: {
  fetchJson: FetchJson;
  cached: Cached;
  frankfurterBaseUrl?: string;
}): FxProvider {
  const base = (deps.frankfurterBaseUrl ?? FRANKFURTER_BASE_URL).replace(/\/+$/, '');

  async function frankfurter(from: string, to: string) {
    const q = new URLSearchParams({ base: from, symbols: to });
    try {
      const res = await deps.fetchJson<FrankfurterLatest>(`${base}/latest?${q}`);
      const rate = res.rates?.[to];
      return typeof rate === 'number' ? { rate, date: res.date ?? null } : null;
    } catch (err) {
      // Unsupported currencies answer 404 (or 422 on older Frankfurter versions).
      if (err instanceof HttpError && (err.status === 404 || err.status === 422)) return null;
      throw err;
    }
  }

  async function erApi(from: string, to: string) {
    const res = await deps.fetchJson<ErApiLatest>(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
    );
    const rate = res.result === 'success' ? res.rates?.[to] : undefined;
    if (typeof rate !== 'number') return null;
    const date = res.time_last_update_unix
      ? new Date(res.time_last_update_unix * 1000).toISOString().slice(0, 10)
      : null;
    return { rate, date };
  }

  return async (from, to) => {
    return deps.cached(await cacheKey('fx', { from, to }), CACHE_TTL.fx, async () => {
      let primaryError: unknown;
      try {
        const q = await frankfurter(from, to);
        if (q) return { ...q, provider: FRANKFURTER_PROVIDER };
      } catch (err) {
        primaryError = err;
      }
      try {
        const q = await erApi(from, to);
        if (q) return { ...q, provider: ER_API_PROVIDER };
      } catch (err) {
        throw primaryError ?? err;
      }
      if (primaryError) throw primaryError;
      return null;
    });
  };
}

// ---------------------------------------------------------------------------
// Global Affairs Canada travel advisories
// ---------------------------------------------------------------------------

export const GAC_INDEX_URL = 'https://data.international.gc.ca/travel-voyage/index-alpha-eng.json';

type GacEntry = {
  'advisory-state'?: number;
  'has-regional-advisory'?: number | boolean;
  'date-published'?: { date?: string; asp?: string };
  eng?: { 'advisory-text'?: string; 'url-slug'?: string };
};

/** Pure: compacts the ~300 kB GAC index to the fields we use (what gets cached). */
export function compactAdvisoryIndex(
  raw: { data?: Record<string, GacEntry> },
): Record<string, Advisory> {
  const out: Record<string, Advisory> = {};
  for (const [code, e] of Object.entries(raw.data ?? {})) {
    const level = e['advisory-state'];
    const slug = e.eng?.['url-slug'];
    if (typeof level !== 'number' || level < 0 || level > 3 || !slug) continue;
    const published = e['date-published']?.date;
    out[code.toUpperCase()] = {
      level,
      hasRegionalAdvisory: Boolean(e['has-regional-advisory']),
      textEn: e.eng?.['advisory-text'] ?? '',
      urlSlug: slug,
      // "2026-09-24 08:53:35" (Ottawa local time) → keep the calendar date.
      publishedAt: published ? published.slice(0, 10) : null,
    };
  }
  return out;
}

export function createGacAdvisory(
  deps: { fetchJson: FetchJson; cached: Cached },
): AdvisoryProvider {
  return async (code) => {
    const index = await deps.cached('advisory:gac-index', CACHE_TTL.advisory, async () => {
      // The GAC endpoint is slow (7–12 s observed); it is fetched at most once a day.
      const raw = await deps.fetchJson<{ data?: Record<string, GacEntry> }>(GAC_INDEX_URL, {
        timeoutMs: 20000,
      });
      const compact = compactAdvisoryIndex(raw);
      if (!Object.keys(compact).length) throw new Error('empty advisory index');
      return compact;
    });
    return index[code] ?? null;
  };
}
