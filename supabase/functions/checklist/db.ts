import type { SupabaseClient } from '@supabase/supabase-js';
import type { VisaOption, VisaRequirement } from '@wayfarer/shared';

import type { ChecklistDb, CityRow, CountryRow } from './types.ts';

const COUNTRY_COLUMNS = [
  'code',
  'name_en',
  'name_pt',
  'currency_codes',
  'plug_types',
  'voltage',
  'frequency_hz',
  'driving_side',
  'calling_code',
  'emergency_number',
  'police_number',
  'ambulance_number',
  'fire_number',
  'languages',
  'timezones',
].join(',');

export function supabaseChecklistDb(client: SupabaseClient): ChecklistDb {
  return {
    async getCity(slug) {
      const { data, error } = await client
        .from('city_list')
        .select('slug,name_en,name_pt,country_code,lat,lng,timezone')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return (data as CityRow | null) ?? null;
    },
    async getCountries(codes) {
      const { data, error } = await client.from('countries').select(COUNTRY_COLUMNS).in(
        'code',
        codes,
      );
      if (error) throw error;
      return (data ?? []) as unknown as CountryRow[];
    },
    async getVisaOptions(destination, passports) {
      const { data, error } = await client
        .from('visa_requirements')
        .select('passport,requirement,max_stay_days')
        .eq('destination', destination)
        .in('passport', passports);
      if (error) throw error;
      return (data ?? []).map(
        (r: { passport: string; requirement: VisaRequirement; max_stay_days: number | null }) => ({
          nationality: r.passport,
          requirement: r.requirement,
          maxStayDays: r.max_stay_days,
        } satisfies VisaOption),
      );
    },
  };
}
