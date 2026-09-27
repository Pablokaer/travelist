import type { AttractionCategory } from '@wayfarer/shared';
import { useQuery } from '@tanstack/react-query';

import { supabase, unwrap } from '@/lib/supabase';

export type City = {
  slug: string;
  nameEn: string;
  namePt: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
  timezone: string | null;
  attractionCount: number;
};

export type AttractionSummary = {
  id: string;
  citySlug: string;
  nameEn: string;
  namePt: string | null;
  category: AttractionCategory;
  lat: number;
  lng: number;
  popularity: number;
  avgVisitMinutes: number;
  imageUrl: string | null;
  isUnesco: boolean;
};

export type AttractionDetail = AttractionSummary & {
  descriptionEn: string | null;
  descriptionPt: string | null;
  imageAuthor: string | null;
  imageLicense: string | null;
  imageLicenseUrl: string | null;
  imagePageUrl: string | null;
  website: string | null;
  wikipediaEn: string | null;
  wikipediaPt: string | null;
  openingHours: string | null;
  fee: string | null;
  wikidataId: string;
};

export const destinationKeys = {
  cities: ['cities'] as const,
  attractions: (city: string, categories: readonly string[]) =>
    ['attractions', city, [...categories].sort()] as const,
  attraction: (id: string) => ['attraction', id] as const,
};

export function localizedName(item: { nameEn: string; namePt: string | null }, language: string) {
  return language === 'pt' && item.namePt ? item.namePt : item.nameEn;
}

export function useCities() {
  return useQuery({
    queryKey: destinationKeys.cities,
    staleTime: 3600_000,
    queryFn: async (): Promise<City[]> => {
      const rows = unwrap(await supabase.from('city_list').select('*').order('name_en'));
      return rows.map((r) => ({
        slug: r.slug!,
        nameEn: r.name_en!,
        namePt: r.name_pt!,
        countryCode: r.country_code!,
        lat: r.lat!,
        lng: r.lng!,
        bbox: r.bbox as City['bbox'],
        timezone: r.timezone,
        attractionCount: r.attraction_count ?? 0,
      }));
    },
  });
}

export function useAttractions(city: City | undefined, categories: readonly AttractionCategory[]) {
  return useQuery({
    queryKey: destinationKeys.attractions(city?.slug ?? '', categories),
    enabled: !!city,
    staleTime: 3600_000,
    queryFn: async (): Promise<AttractionSummary[]> => {
      const [south, west, north, east] = city!.bbox;
      const rows = unwrap(
        await supabase.rpc('attractions_in_view', {
          min_lng: west,
          min_lat: south,
          max_lng: east,
          max_lat: north,
          categories: categories.length ? [...categories] : undefined,
          max_results: 500,
        }),
      );
      return rows
        .filter((r) => r.city_slug === city!.slug)
        .map((r) => ({
          id: r.id,
          citySlug: r.city_slug,
          nameEn: r.name_en,
          namePt: r.name_pt,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          popularity: r.popularity,
          avgVisitMinutes: r.avg_visit_minutes,
          imageUrl: r.image_url,
          isUnesco: r.is_unesco,
        }));
    },
  });
}

export function useAttraction(id: string | undefined) {
  return useQuery({
    queryKey: destinationKeys.attraction(id ?? ''),
    enabled: !!id,
    staleTime: 3600_000,
    queryFn: async (): Promise<AttractionDetail> => {
      const r = unwrap(
        await supabase.from('attraction_details').select('*').eq('id', id!).single(),
      );
      return {
        id: r.id!,
        citySlug: r.city_slug!,
        nameEn: r.name_en!,
        namePt: r.name_pt,
        category: r.category!,
        lat: r.lat!,
        lng: r.lng!,
        popularity: r.popularity ?? 0,
        avgVisitMinutes: r.avg_visit_minutes ?? 30,
        imageUrl: r.image_url,
        isUnesco: r.is_unesco ?? false,
        descriptionEn: r.description_en,
        descriptionPt: r.description_pt,
        imageAuthor: r.image_author,
        imageLicense: r.image_license,
        imageLicenseUrl: r.image_license_url,
        imagePageUrl: r.image_page_url,
        website: r.website,
        wikipediaEn: r.wikipedia_en,
        wikipediaPt: r.wikipedia_pt,
        openingHours: r.opening_hours,
        fee: r.fee,
        wikidataId: r.wikidata_id!,
      };
    },
  });
}
