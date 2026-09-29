// The city page "About" text (D-036): the lead of the city's Wikipedia article, stored on
// `cities` by the data pipeline, shown with its CC BY-SA source link.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { wikipediaUrl } from '@/lib/wikipedia';

type CityAboutRow = {
  summary_en: string | null;
  summary_pt: string | null;
  wikipedia_en: string | null;
  wikipedia_pt: string | null;
};

/** The summary to show and the article it comes from (always the same language). */
export type CityAbout = { summary: string | null; sourceUrl: string | null };

function about(summary: string | null, language: 'en' | 'pt', title: string | null): CityAbout {
  return { summary, sourceUrl: title ? wikipediaUrl({ language, title }) : null };
}

/**
 * The summary in the app language, else the other one; its source link matches it.
 * @example cityAboutFromRow(row, 'pt').sourceUrl // 'https://pt.wikipedia.org/wiki/Lisboa'
 */
export function cityAboutFromRow(row: CityAboutRow | null, language: string): CityAbout {
  if (row?.summary_pt && language === 'pt') return about(row.summary_pt, 'pt', row.wikipedia_pt);
  if (row?.summary_en) return about(row.summary_en, 'en', row.wikipedia_en);
  if (row?.summary_pt) return about(row.summary_pt, 'pt', row.wikipedia_pt);
  return { summary: null, sourceUrl: null };
}

/** The About text of a city in the app language. */
export function useCityAbout(citySlug: string | undefined, language: string) {
  return useQuery({
    queryKey: ['cityAbout', citySlug ?? ''],
    enabled: !!citySlug,
    staleTime: 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('summary_en, summary_pt, wikipedia_en, wikipedia_pt')
        .eq('slug', citySlug!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    select: (row) => cityAboutFromRow(row, language),
  });
}
