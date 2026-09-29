// Attraction reviews (D-028): read through `list_attraction_reviews` and the
// `attraction_rating_summary` view, written through `save_review` (create or edit) and a plain
// delete. RLS lets each user change only their own review.
import type { ReviewForm } from '@wayfarer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, supabase, unwrap } from '@/lib/supabase';

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  /** The author's public display name; null when they never set one. */
  authorName: string | null;
  /** True for the signed-in user's own review. */
  isOwn: boolean;
};

export type RatingSummary = { count: number; average: number | null };

/** A `list_attraction_reviews` row. The generated type misses that name and comment can be null. */
type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  is_own: boolean;
};

type SummaryRow = { review_count: number | null; rating_avg: number | null };
type CitySummaryRow = SummaryRow & { attraction_id: string | null };

export const reviewKeys = {
  list: (attractionId: string) => ['reviews', attractionId] as const,
  summary: (attractionId: string) => ['reviews', attractionId, 'summary'] as const,
  city: (citySlug: string) => ['reviews', 'city', citySlug] as const,
};

/**
 * Maps a `list_attraction_reviews` row.
 * @example reviewFromRow(row).authorName // 'Carla'
 */
export function reviewFromRow(r: ReviewRow): Review {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorName: r.author_name,
    isOwn: r.is_own,
  };
}

/**
 * Maps an `attraction_rating_summary` row; no row means no reviews.
 * @example summaryFromRow(null) // { count: 0, average: null }
 */
export function summaryFromRow(r: SummaryRow | null): RatingSummary {
  return { count: r?.review_count ?? 0, average: r?.rating_avg ?? null };
}

/**
 * Indexes a city's rated places by attraction id (places without reviews have no entry).
 * @example ratingsByAttraction(rows).get(id) // { count: 2, average: 3.5 }
 */
export function ratingsByAttraction(rows: readonly CitySummaryRow[]): Map<string, RatingSummary> {
  return new Map(
    rows.filter((r) => r.attraction_id).map((r) => [r.attraction_id!, summaryFromRow(r)]),
  );
}

/** Average rating and review count of every rated place of a city, for the city page cards. */
export function useCityRatings(citySlug: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.city(citySlug ?? ''),
    enabled: !!citySlug,
    queryFn: async (): Promise<Map<string, RatingSummary>> => {
      const rows = unwrap(
        await supabase
          .from('attraction_rating_summary')
          .select('attraction_id, review_count, rating_avg')
          .eq('city_slug', citySlug!)
          .gt('review_count', 0),
      );
      return ratingsByAttraction(rows);
    },
  });
}

/** An attraction's reviews, newest first (up to 50). */
export function useAttractionReviews(attractionId: string) {
  return useQuery({
    queryKey: reviewKeys.list(attractionId),
    queryFn: async (): Promise<Review[]> => {
      const rows = unwrap(
        await supabase.rpc('list_attraction_reviews', { p_attraction_id: attractionId }),
      );
      return (rows as ReviewRow[]).map(reviewFromRow);
    },
  });
}

/** Average rating and number of reviews of an attraction. */
export function useRatingSummary(attractionId: string) {
  return useQuery({
    queryKey: reviewKeys.summary(attractionId),
    queryFn: async (): Promise<RatingSummary> => {
      const { data, error } = await supabase
        .from('attraction_rating_summary')
        .select('review_count, rating_avg')
        .eq('attraction_id', attractionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return summaryFromRow(data);
    },
  });
}

/** Refetches the list, the summary (both prefix `['reviews', id]`) and the city cards' ratings. */
function useInvalidateReviews(attractionId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: reviewKeys.list(attractionId) }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'city'] }),
    ]);
}

/**
 * Publishes the caller's review of an attraction, or updates it when there is one.
 * @example saveReview.mutate({ rating: 5, comment: 'Worth the climb' })
 */
export function useSaveReview(attractionId: string) {
  const invalidate = useInvalidateReviews(attractionId);
  return useMutation({
    mutationFn: async (form: ReviewForm) => {
      unwrap(
        await supabase.rpc('save_review', {
          p_attraction_id: attractionId,
          p_rating: form.rating,
          p_comment: form.comment.trim() || undefined,
        }),
      );
    },
    onSuccess: invalidate,
  });
}

/** Deletes the caller's review of an attraction (RLS: only their own row can match). */
export function useDeleteReview(attractionId: string) {
  const invalidate = useInvalidateReviews(attractionId);
  return useMutation({
    mutationFn: async (reviewId: string) => {
      check(await supabase.from('attraction_reviews').delete().eq('id', reviewId));
    },
    onSuccess: invalidate,
  });
}
