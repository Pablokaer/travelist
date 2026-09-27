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

export function useOptimizeRoute() {
  return useMutation({
    mutationFn: ({ stops, keepFirst }: { stops: AttractionSummary[]; keepFirst: boolean }) =>
      optimizeRoute(stops, keepFirst),
  });
}
