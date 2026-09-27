import type { LineString, RouteResponse } from '@wayfarer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AttractionSummary } from '@/features/destinations/api';
import { check, supabase, unwrap } from '@/lib/supabase';

export type TripSummary = {
  id: string;
  name: string;
  citySlug: string;
  tripDate: string | null;
  distanceM: number | null;
  walkingSeconds: number | null;
  visitMinutes: number | null;
  stopCount: number;
  createdAt: string;
};

export type TripDetail = TripSummary & {
  geometry: LineString | null;
  isFallback: boolean;
  provider: string | null;
  stops: AttractionSummary[];
};

export const tripKeys = {
  all: ['trips'] as const,
  detail: (id: string) => ['trips', id] as const,
};

export function useTrips() {
  return useQuery({
    queryKey: tripKeys.all,
    queryFn: async (): Promise<TripSummary[]> => {
      const rows = unwrap(
        await supabase
          .from('trips')
          .select(
            'id, name, city_slug, trip_date, distance_m, walking_seconds, visit_minutes, created_at, trip_stops(count)',
          )
          .order('created_at', { ascending: false }),
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        citySlug: r.city_slug,
        tripDate: r.trip_date,
        distanceM: r.distance_m,
        walkingSeconds: r.walking_seconds,
        visitMinutes: r.visit_minutes,
        createdAt: r.created_at,
        stopCount: (r.trip_stops as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    },
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: tripKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<TripDetail> => {
      const trip = unwrap(
        await supabase
          .from('trips')
          .select('*, trip_stops(position, attraction_id)')
          .eq('id', id!)
          .single(),
      );
      const stopRows = [...trip.trip_stops].sort((a, b) => a.position - b.position);
      const ids = stopRows.map((s) => s.attraction_id);
      const details = unwrap(
        await supabase
          .from('attraction_details')
          .select(
            'id, city_slug, name_en, name_pt, category, lat, lng, popularity, avg_visit_minutes, image_url, is_unesco',
          )
          .in('id', ids),
      );
      const byId = new Map(details.map((d) => [d.id, d]));
      const stops = ids
        .map((aid) => byId.get(aid))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => ({
          id: d.id!,
          citySlug: d.city_slug!,
          nameEn: d.name_en!,
          namePt: d.name_pt,
          category: d.category!,
          lat: d.lat!,
          lng: d.lng!,
          popularity: d.popularity ?? 0,
          avgVisitMinutes: d.avg_visit_minutes ?? 30,
          imageUrl: d.image_url,
          isUnesco: d.is_unesco ?? false,
        }));
      return {
        id: trip.id,
        name: trip.name,
        citySlug: trip.city_slug,
        tripDate: trip.trip_date,
        distanceM: trip.distance_m,
        walkingSeconds: trip.walking_seconds,
        visitMinutes: trip.visit_minutes,
        createdAt: trip.created_at,
        stopCount: stops.length,
        geometry: (trip.route_geometry as LineString | null) ?? null,
        isFallback: trip.is_fallback,
        provider: trip.provider,
        stops,
      };
    },
  });
}

export function useSaveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      tripDate: string | null;
      citySlug: string;
      stops: AttractionSummary[];
      route: RouteResponse | null;
    }) =>
      unwrap(
        await supabase.rpc('save_trip', {
          p_city_slug: input.citySlug,
          p_name: input.name,
          p_attraction_ids: input.stops.map((s) => s.id),
          p_trip_date: input.tripDate ?? undefined,
          p_route_geometry: input.route?.geometry ?? undefined,
          p_distance_m: input.route ? Math.round(input.route.distanceM) : undefined,
          p_walking_seconds: input.route ? Math.round(input.route.walkingSeconds) : undefined,
          p_visit_minutes: input.stops.reduce((sum, s) => sum + s.avgVisitMinutes, 0),
          p_is_fallback: input.route?.isFallback ?? false,
          p_provider: input.route?.provider ?? undefined,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.all }),
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from('trips').delete().eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.all }),
  });
}
