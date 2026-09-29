// POST /route-optimize — orders 2–12 stops into a walking route with legs and geometry.
import {
  CACHE_TTL,
  type RouteRequest,
  routeRequestSchema,
  type RouteResponse,
  routeResponseSchema,
} from '@wayfarer/shared';

import { type Cached, cacheKey } from '../_shared/cache.ts';
import {
  handleOptions,
  internalError,
  json,
  methodNotAllowed,
  parseJsonBody,
} from '../_shared/cors.ts';
import {
  FALLBACK_ATTRIBUTION,
  fallbackRouting,
  ORS_ATTRIBUTION,
  type RoutingProvider,
  type RoutingResult,
} from './routing.ts';

/** Fallback results are cached briefly, and only when no ORS key is configured. */
export const FALLBACK_TTL = 3600;

export type RouteDeps = {
  /** OpenRouteService provider; null when ORS_API_KEY is not configured. */
  ors: RoutingProvider | null;
  cached: Cached;
};

type Stored = RoutingResult & { provider: RouteResponse['provider'] };

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Canonical form of a request, used as the cache key and sent to the provider: coordinates
 * rounded to ~0.1 m, and the stops that the optimiser may reorder sorted by id. The same set of
 * places then hits the cache in any order — e.g. "Optimise" again after the app applied the
 * optimised order, or after reordering by hand — and gets the same deterministic answer.
 * @example normalizeRouteInput({ stops: [a, c, b], keepFirst: true }).stops // [a, b, c]
 */
export function normalizeRouteInput(input: RouteRequest) {
  const stops = input.stops.map((s) => ({ id: s.id, lat: round6(s.lat), lng: round6(s.lng) }));
  const [first, ...rest] = stops;
  return {
    stops: input.keepFirst ? [first!, ...rest.sort(byId)] : stops.sort(byId),
    keepFirst: input.keepFirst,
  };
}

function toResponse(input: RouteRequest, r: Stored): RouteResponse {
  const fallback = r.provider === 'fallback';
  return {
    order: r.order,
    legs: r.legs,
    geometry: r.geometry,
    distanceM: r.legs.reduce((a, l) => a + l.distanceM, 0),
    walkingSeconds: r.legs.reduce((a, l) => a + l.durationS, 0),
    visitMinutes: input.stops.reduce((a, s) => a + s.visitMinutes, 0),
    isFallback: fallback,
    provider: r.provider,
    attribution: fallback ? FALLBACK_ATTRIBUTION : ORS_ATTRIBUTION,
  };
}

export function createHandler(deps: RouteDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== 'POST') return methodNotAllowed();

    const body = await parseJsonBody(req, routeRequestSchema);
    if (!body.ok) return body.response;
    const input = body.data;

    try {
      const normalized = normalizeRouteInput(input);
      const stops = normalized.stops;
      const fallback = async (): Promise<Stored> => ({
        ...(await fallbackRouting(stops, input.keepFirst)),
        provider: 'fallback',
      });

      let result: Stored;
      if (deps.ors) {
        const ors = deps.ors;
        try {
          result = await deps.cached(
            await cacheKey('route:ors', normalized),
            CACHE_TTL.route,
            async (): Promise<Stored> => ({
              ...(await ors(stops, input.keepFirst)),
              provider: 'openrouteservice',
            }),
          );
        } catch (err) {
          // Transient ORS failure: answer with the estimate, but do not cache it.
          console.warn('ORS routing failed, using fallback:', err);
          result = await fallback();
        }
      } else {
        result = await deps.cached(
          await cacheKey('route:fallback', normalized),
          FALLBACK_TTL,
          fallback,
        );
      }
      return json(routeResponseSchema.parse(toResponse(input, result)));
    } catch (err) {
      return internalError(err);
    }
  };
}
