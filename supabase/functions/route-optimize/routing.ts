// Routing providers for route-optimize: OpenRouteService (VROOM optimisation + walking
// directions) and the offline straight-line fallback from @wayfarer/shared.
import {
  estimateLegs,
  type LineString,
  optimizeOrder,
  type RouteLeg,
  type RoutePoint,
} from '@wayfarer/shared';

import type { FetchJson } from '../_shared/http.ts';

export type RoutingResult = { order: string[]; legs: RouteLeg[]; geometry: LineString };

/**
 * Orders `stops` into an open walking path. With `fixedStart` the first stop stays first;
 * otherwise the provider may start anywhere.
 */
export type RoutingProvider = (
  stops: readonly RoutePoint[],
  fixedStart: boolean,
) => Promise<RoutingResult>;

export const ORS_BASE_URL = 'https://api.openrouteservice.org';
export const ORS_TIMEOUT_MS = 8000;
export const ORS_ATTRIBUTION =
  '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors';
export const FALLBACK_ATTRIBUTION = 'Estimated straight-line route';

const lngLat = (p: RoutePoint): [number, number] => [p.lng, p.lat];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function fallbackFrom(stops: readonly RoutePoint[]): RoutingResult & { distance: number } {
  const ordered = optimizeOrder(stops);
  const legs = estimateLegs(ordered);
  return {
    order: ordered.map((p) => p.id),
    legs,
    geometry: { type: 'LineString', coordinates: ordered.map(lngLat) },
    distance: sum(legs.map((l) => l.distanceM)),
  };
}

/** Best start for an open path (tries every stop as the start; deterministic). */
export function bestStartFallback(stops: readonly RoutePoint[]): RoutingResult {
  let best: (RoutingResult & { distance: number }) | undefined;
  stops.forEach((start, i) => {
    const candidate = fallbackFrom([start, ...stops.filter((_, j) => j !== i)]);
    if (!best || candidate.distance < best.distance - 1e-6) best = candidate;
  });
  const { order, legs, geometry } = best!;
  return { order, legs, geometry };
}

export const fallbackRouting: RoutingProvider = (stops, fixedStart) => {
  if (fixedStart) {
    const { order, legs, geometry } = fallbackFrom(stops);
    return Promise.resolve({ order, legs, geometry });
  }
  return Promise.resolve(bestStartFallback(stops));
};

// ---------------------------------------------------------------------------
// OpenRouteService
// ---------------------------------------------------------------------------

type VroomStep = { type: string; id?: number; job?: number };
type VroomResponse = {
  code: number;
  error?: string;
  routes?: { vehicle: number; steps: VroomStep[] }[];
  unassigned?: { id: number }[];
};
type OrsDirections = {
  features?: {
    geometry?: { type: string; coordinates: number[][] };
    properties?: { segments?: { distance: number; duration: number }[] };
  }[];
};

/** Pure: stop order from a VROOM solution (start stop first, then jobs by step order). */
export function orderFromVroom(
  start: RoutePoint,
  jobs: readonly RoutePoint[],
  res: VroomResponse,
): RoutePoint[] {
  if (res.code !== 0) throw new Error(`ORS optimization error ${res.code}: ${res.error ?? ''}`);
  if (res.unassigned?.length) throw new Error('ORS optimization left stops unassigned');
  const steps = res.routes?.[0]?.steps ?? [];
  const visited = steps
    .filter((s) => s.type === 'job')
    .map((s) => {
      const idx = s.id ?? s.job;
      const stop = idx === undefined ? undefined : jobs[idx];
      if (!stop) throw new Error(`ORS optimization returned unknown job ${idx}`);
      return stop;
    });
  if (visited.length !== jobs.length || new Set(visited).size !== jobs.length) {
    throw new Error('ORS optimization did not visit every stop exactly once');
  }
  return [start, ...visited];
}

/** Pure: legs + geometry from an ORS GeoJSON directions response for `ordered` stops. */
export function routeFromDirections(
  ordered: readonly RoutePoint[],
  res: OrsDirections,
): RoutingResult {
  const feature = res.features?.[0];
  const segments = feature?.properties?.segments ?? [];
  if (segments.length !== ordered.length - 1) {
    throw new Error(`ORS directions returned ${segments.length} segments`);
  }
  const coords = feature?.geometry?.type === 'LineString' ? feature.geometry.coordinates : [];
  if (coords.length < 2) throw new Error('ORS directions returned no LineString geometry');
  return {
    order: ordered.map((p) => p.id),
    legs: segments.map((s, i) => ({
      fromId: ordered[i]!.id,
      toId: ordered[i + 1]!.id,
      distanceM: Math.round(s.distance),
      durationS: Math.round(s.duration),
    })),
    geometry: {
      type: 'LineString',
      coordinates: coords.map((c) => [c[0]!, c[1]!] as [number, number]),
    },
  };
}

export function createOrsRouting(deps: {
  apiKey: string;
  fetchJson: FetchJson;
  baseUrl?: string;
  timeoutMs?: number;
}): RoutingProvider {
  const base = deps.baseUrl ?? ORS_BASE_URL;
  const opts = {
    headers: { Authorization: deps.apiKey },
    timeoutMs: deps.timeoutMs ?? ORS_TIMEOUT_MS,
  };

  return async (stops, fixedStart) => {
    // VROOM needs a vehicle start or end; for a free start, pick it with the local heuristic
    // and let ORS order the rest on the real street network.
    const startId = fixedStart ? stops[0]!.id : bestStartFallback(stops).order[0]!;
    const start = stops.find((s) => s.id === startId)!;
    const jobs = stops.filter((s) => s !== start);

    const optimization = await deps.fetchJson<VroomResponse>(`${base}/optimization`, {
      ...opts,
      method: 'POST',
      body: {
        // Ordering only minimises walking, so visits have no service time.
        jobs: jobs.map((s, i) => ({ id: i, location: lngLat(s), service: 0 })),
        vehicles: [{ id: 0, profile: 'foot-walking', start: lngLat(start) }],
      },
    });
    const ordered = orderFromVroom(start, jobs, optimization);

    const directions = await deps.fetchJson<OrsDirections>(
      `${base}/v2/directions/foot-walking/geojson`,
      {
        ...opts,
        // The GeoJSON endpoint answers 406 unless GeoJSON is an accepted type.
        headers: { ...opts.headers, Accept: 'application/json, application/geo+json' },
        method: 'POST',
        body: {
          coordinates: ordered.map(lngLat),
          // Snap stops to the nearest walkable way however far it is (parks, squares).
          radiuses: ordered.map(() => -1),
        },
      },
    );
    return routeFromDirections(ordered, directions);
  };
}
