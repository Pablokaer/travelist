import { routeResponseSchema, type RouteRequest, type RouteResponse } from '@wayfarer/shared';
import { useMutation } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { AttractionSummary } from '@/features/destinations/api';
import { supabase } from '@/lib/supabase';

export async function optimizeRoute(
  stops: AttractionSummary[],
  keepFirst = true,
): Promise<RouteResponse> {
  const body: RouteRequest = {
    keepFirst,
    stops: stops.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      visitMinutes: s.avgVisitMinutes,
    })),
  };
  const { data, error } = await supabase.functions.invoke('route-optimize', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.text().catch(() => '');
      throw new Error(detail || error.message);
    }
    throw error;
  }
  return routeResponseSchema.parse(data);
}

/**
 * Optimises every route of the selection independently (each keeps its first stop).
 * @example optimizeRoutes.mutate([routeA, routeB]) // → [responseA, responseB]
 */
export function useOptimizeRoutes() {
  return useMutation({
    mutationFn: (routes: AttractionSummary[][]) =>
      Promise.all(routes.map((stops) => optimizeRoute(stops, true))),
  });
}

/**
 * Which routes "Optimise" should send: the ones without a result for their current order (a
 * changed route of a split keeps the others' answers). When every route is already optimised,
 * all of them — the server answers those from its cache.
 * @example routesToOptimize([resultA, null, resultC]) // [1]
 */
export function routesToOptimize(results: readonly (RouteResponse | null)[]): number[] {
  const all = results.map((_, i) => i);
  const pending = all.filter((i) => results[i] == null);
  return pending.length > 0 ? pending : all;
}
